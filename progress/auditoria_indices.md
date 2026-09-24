# Auditoría de índices y planes de ejecución — 24-sep-2026

Solo lectura. No se cambió nada en ninguna base. Fuentes:
- **Inventario de índices:** las 138 migraciones reproducidas en orden → 93 tablas, 286 índices, 188 claves foráneas.
- **Inventario de consultas:** backend → 89 tablas, 626 patrones, 142 en rutas calientes.
- **Advertencias de rendimiento de Supabase** en prod y DEV.
- **Estadísticas reales de prod:** `pg_stat_user_tables` y `pg_stat_statements`.

Los inventarios completos están en el scratchpad de la sesión (`auditoria/indices_inventario.md`, `auditoria/consultas_inventario.md`).

## 1. Diagnóstico: hoy no hay un problema de rendimiento

- **Prod es muy chico.** La tabla con más filas es `requests_lentos` (672); `notificaciones` tiene 39, `usuarios` 10 y `trabajos` 9. Con tablas así, Postgres lee la tabla completa aunque exista un índice, y hace bien. Por eso se ven muchos `seq_scan`.
- **Ninguna consulta de la app aparece entre las 20 más costosas.** El tiempo se va en consultas internas de Supabase (panel, PostgREST, Auth), todas con un promedio de 0,05 a 0,2 ms por llamada.
- **RLS:** Supabase no reporta políticas lentas (ni `auth_rls_initplan` ni políticas permisivas duplicadas).

Conclusión: todo lo que sigue es **preventivo**, para que la app aguante cuando las empresas tengan miles de filas. Se prioriza por frecuencia real en prod: notificaciones (60 mil lecturas), usuarios (46 mil), empresas (26 mil), trabajos (21 mil) y facturas (21 mil).

## 2. Índices nuevos para consultas frecuentes (prioridad alta)

| # | Índice propuesto | Consulta que lo necesita | Hoy |
|---|---|---|---|
| A1 | `notificaciones (empresa_id, usuario_id, creado_en desc)` | Campana: últimas notificaciones del usuario (`notificacionesFeed.ts:129`), cada 60 s por usuario conectado | El índice existente tiene `leido` en medio y no sirve para ordenar por fecha sin filtrar por leído |
| A2 | `notificaciones (empresa_id, tipo, entidad_id)` | Evitar avisos duplicados de vencimientos (`notificacionesFeed.ts:18`), una por cada documento o cobro revisado | Sin índice |
| A3 | `notificaciones_cliente_log (empresa_id, tipo, entidad_id)` | Evitar avisos duplicados a clientes (cumpleaños en cada `/api/me`, cotizaciones, cobros) | Solo `(empresa_id, creado_en)` |
| A4 | `facturas (empresa_id, fecha_emision)` | Dashboard e informes por rango de fechas (6 consultas en `agregacionesDashboard.ts`) y la lista de Cobros | Solo `(empresa_id, estado)` |
| A5 | `ordenes_servicio (empresa_id, finalizada_en) where finalizada_en is not null` | Dashboard: OS finalizadas por período (`agregacionesDashboard.ts:439`) | Sin índice |
| A6 | `trabajos (empresa_id, responsable_id, fecha desc)` | App del técnico: "Mis trabajos" (`misTrabajos.ts:63`) y la lista de OS por responsable | Solo `responsable_id` suelto |
| A7 | `viajes (empresa_id, chofer_id, fecha desc) where chofer_id is not null` | Pizarra y Agenda del chofer (`misViajes.ts:41`) | Solo `chofer_id` suelto |

## 3. Claves foráneas sin índice (19) — prioridad media

Pesan al **borrar o desactivar el registro padre**, porque Postgres revisa la tabla hija completa. Por ejemplo, eliminar un cliente (tarea 131) revisa `levantamientos.cliente_id` sin índice. También al hacer los joins. Son tablas chicas, así que el costo de escritura es mínimo:

- **Cliente, técnico y auditoría:**
  - `levantamientos (cliente_id)`, `(tecnico_id)`, `(creado_por)`
  - `levantamiento_fotos (empresa_id)`, `(subida_por)`
  - `levantamiento_materiales (empresa_id)`, `(agregado_por)`
- **Rendiciones:** `rendiciones (colaborador_id)`, `(aprobado_por)`, `(creado_por)`
- **Flota:** `eventos_flota (equipo_id)`, `(reportado_por)`
- **OS y cotizaciones:**
  - `os_pdf_versiones (empresa_id)`, `(creado_por)`
  - `presupuestos (etapa_id)`
  - `tipos_os_trabajo (checklist_template_id)`
- **Auditoría:** `auditoria_empresa (usuario_id)`
- **Índices solo parciales, que no sirven para la clave foránea:** `analisis_fotos (empresa_id)`, `datos_laborales (empresa_id)`

## 4. Índices redundantes — borrar (5)

Otro índice ya cubre las mismas columnas y se usa en su lugar. Borrarlos ahorra espacio y escrituras:

| Borrar | Lo cubre |
|---|---|
| `catalogo_item_tipos_equipo_catalogo_item_id_idx` | UNIQUE (catalogo_item_id, tipo_equipo) |
| `catalogo_kit_items_kit_idx` | UNIQUE (kit_id, item_id) |
| `empresa_rol_modulos_empresa_idx` | PK (empresa_id, rol_slug, modulo) |
| `idx_rendiciones_empresa` | `idx_rendiciones_colaborador` (empresa_id, colaborador_id) |
| `os_pdf_versiones_orden_servicio_id_version_idx` | UNIQUE (orden_servicio_id, version) |

**No** se borran los 88 "índices sin usar" que reporta Supabase. Con este volumen de datos nunca se usarían, pero sí servirán cuando crezca.

## 5. Mejoras de código (no son índices) — prioridad media

- **C1. Cumpleaños de clientes:** hoy se revisan en **cada** `GET /api/me`, sin límite (`server.ts:204` → `cumpleanosClientes.ts`). Cada navegación del dashboard lee todos los clientes activos de la empresa. Propuesta: revisar una vez por empresa y por día, con una marca en memoria, igual que la limpieza de retención (throttle de 1 h).
- **C2. Webhook de WhatsApp:** por cada mensaje entrante lee **todos** los colaboradores con teléfono de **todas** las empresas y compara el número en memoria (`whatsapp.ts:43`). Hoy son pocos; con cientos de empresas sería lento. Propuesta: guardar el teléfono normalizado en una columna `usuarios.telefono_norm` con índice, y buscar por igualdad.

## 6. Cómo se aplicaría (pendiente de OK)

1. **Migración 139** (solo índices, no toca datos):
   - `create index if not exists` para A1–A7 y las 19 claves foráneas (ahí van los `empresa_id` que faltan; `idempotencia` y `requests_lentos` no lo necesitan porque nunca se consultan por empresa);
   - `drop index if exists` para los 5 redundantes.
   - En prod son tablas chicas, así que crearlos tarda milisegundos y no bloquea a los usuarios.
2. **Validación:** `EXPLAIN ANALYZE` en DEV de cada consulta de A1–A7, con `enable_seqscan = off`, para confirmar que Postgres usa el índice nuevo. Es la regla del proyecto para índices nuevos.
3. **C1 y C2 como tareas aparte**, con sus pruebas.
4. **Prod:** la migración la corre la usuaria, como siempre.
