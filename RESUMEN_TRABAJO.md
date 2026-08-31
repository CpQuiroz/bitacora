# Resumen de trabajo — Fusión Vehículos → Equipos

Rama: `feat/fusion-vehiculos-equipos` (desde `main`), no mergeada, sin
push a ningún remoto.

## Qué se hizo

Vehículos dejó de ser tabla/módulo separado. Ahora es una categoría
(`categoria = "Vehículo"`) dentro de `equipos`, con sus campos propios
(`patente`, `tipo_vehiculo`, `capacidad_carga`, `anio`) opcionales.

### Modelo de datos (`supabase/migrations/52_fusion_vehiculos_equipos.sql`, ya aplicada)

- `equipos.cliente_id` pasó a **opcional**: `null` = activo propio de
  la empresa (ej. un vehículo de la flota propia); con cliente = activo
  del cliente, comportamiento de siempre.
- 4 columnas nuevas en `equipos`: `patente`, `anio`, `tipo_vehiculo`,
  `capacidad_carga` — todas nullable, solo se usan cuando
  `categoria = "Vehículo"`.
- Índice único parcial `(empresa_id, patente) where patente is not null`
  — mantiene la unicidad de patente sin restringir a los equipos que no
  son vehículo.
- Los datos de `vehiculos` se migraron a `equipos` **preservando el
  mismo `id`**, así todo lo que ya apuntaba a ese id (documentos,
  asignaciones, viajes) sigue resolviendo sin tener que reescribirlo.
- `vehiculo_asignaciones.vehiculo_id` y `viajes.vehiculo_id` se
  renombraron a `equipo_id` y sus FK ahora apuntan a `equipos(id)` (no
  se renombró la tabla `vehiculo_asignaciones` — no era parte de lo
  pedido).
- `documentos.entidad_tipo = 'vehiculo'` **no cambió** — es una
  etiqueta semántica ("este documento es de un vehículo"), no un
  nombre de tabla, y sigue siendo correcta.
- La tabla `vehiculos` **no se borró** — queda existente y sin uso
  activo, para poder hacer rollback. Se puede eliminar en una
  migración posterior una vez confirmado que todo funciona.

### Backend

- `backend/src/routes/equipos.ts` — absorbió todo lo que antes vivía
  en `vehiculos.ts` (ahora borrado): CRUD con los campos nuevos,
  `GET /:id/asignaciones`, `POST /:id/asignar`, `POST /:id/desasignar`,
  y los helpers `asignacionVigentePorEquipo`/`equipoAsignadoAColaborador`
  (antes `...PorVehiculo`/`vehiculoAsignadoA...`).
- **Bug encontrado y corregido** al mover esa lógica: `desasignar()`
  ponía `hasta = hoy`, pero la consulta de "asignación vigente" usaba
  `hasta >= hoy`, así que un vehículo desasignado seguía apareciendo
  como asignado el resto del día — recién se reflejaba al día
  siguiente. Cambiado a `hasta > hoy`. Preexistía en el `vehiculos.ts`
  original (no es una regresión de esta fusión), lo encontré
  verificando el flujo en vivo.
- `rutasPlanificadas.ts`, `notificacionesFeed.ts`, `usuarios.ts` (
  `/me/vehiculo`), `documentos.ts` (`/por-vencer`): actualizados para
  consultar `equipos` en vez de `vehiculos`.
- `viajes.ts`: `vehiculo_id` → `equipo_id` en request/response
  (columna y alias del `select`).
- `server.ts`: ya no monta `/api/vehiculos`.
- **Nota de alcance no resuelta**: `equiposRouter` no tiene
  `requiereModulo(...)` propio (a diferencia del `vehiculosRouter`
  viejo, que exigía el módulo `"flota"`) — esto ya era así en
  `equipos.ts` antes de esta tarea, no lo introduje yo, pero ahora
  que absorbe asignación vehículo↔colaborador (antes protegida por
  `"flota"`) es más relevante. No lo cambié por no ser parte de lo
  pedido — queda para que lo definan.

### Frontend

- `web/src/app/dashboard/registros/equipos/page.tsx` — reescrita:
  - Cliente ahora opcional, con opción explícita "Sin cliente — activo
    propio de la empresa".
  - Selector de categoría (`Vehículo`, `Maquinaria`, `Herramienta`,
    `Otro` — cualquier valor libre ya guardado se sigue mostrando y no
    se pierde).
  - Al elegir "Vehículo" aparecen los campos propios (patente, tipo,
    capacidad de carga, año).
  - Filtro por categoría en el listado (además de los chips
    Todos/Activos/Inactivos ya existentes) y columnas nuevas
    Patente/Asignado a.
  - Para equipos categoría Vehículo: botón **Asignación** (modal con
    asignar/reasignar/desasignar + historial — reemplaza la ficha
    aparte que tenía Vehículos) y botón **Documentos** (mismo
    `DocumentoForm` que antes vivía en esa ficha, en un modal).
- `web/src/app/dashboard/flota/vehiculos/` (lista + ficha por id) —
  **eliminado**. `web/src/components/DashboardShell.tsx` — sacada la
  entrada "Vehículos" del sidebar de Flota.
- `web/src/app/dashboard/flota/colaboradores/page.tsx`,
  `.../rutas/nueva/page.tsx`, `.../perfil/page.tsx` — pasaron de
  `/api/vehiculos` + tipo `Vehiculo` a `/api/equipos` + tipo `Equipo`
  (filtrando `categoria === "Vehículo"` donde corresponde).
- `web/src/app/dashboard/flota/documentos-por-vencer/page.tsx` — el
  link de un documento de vehículo ya no apunta a una ficha por id
  (no existe más); manda a la lista de Equipos.

### App móvil

Revisé — **cero referencias** a Vehículos como entidad en `mobile/`.
No requiere ningún ajuste.

### Documentación

`docs/1_ERD_Bitacora.mermaid` actualizado: sin entidad VEHICULOS
separada (nunca la tuvo, de hecho — el ERD ya solo mostraba EQUIPOS),
agregadas las relaciones `EMPRESAS→EQUIPOS` (propios), `CLIENTES→EQUIPOS`
marcada opcional, `USUARIOS→EQUIPOS` (asignación) y `EQUIPOS→VIAJES`.

## Cómo se verificó

`npx tsc --noEmit` limpio en `backend` y `web`. Grep final sin
referencias colgantes a `/api/vehiculos`, `from("vehiculos")`,
`vehiculosRouter` ni a las rutas de frontend borradas.

Verificación en vivo contra los servidores corriendo, con datos 100%
desechables (empresa, cliente, colaborador, creados y borrados en la
misma corrida): equipo de cliente se crea igual que siempre; equipo
"Vehículo" propio de la empresa se crea con `cliente_id: null` y sus
campos propios; `GET /api/equipos` trae `asignacion_vigente`; asignar
→ se refleja en el detalle y en `/api/usuarios/me/vehiculo` del
colaborador; historial de asignaciones correcto; desasignar libera
inmediatamente (el bug de arriba, ya corregido); un documento cargado
con `entidad_tipo=vehiculo` se resuelve correctamente desde `equipos`
en `/api/documentos/por-vencer`; un viaje creado con `equipo_id`
devuelve el equipo esperado en el `select` anidado. Las 12
verificaciones pasaron. No hice click-through de la UI con Playwright
(la reescritura de la página de Equipos es code-review-able y reusa
patrones ya probados del proyecto — Modal, DocumentoForm, chips de
filtro — pero si querés que la recorra en el navegador antes de
mergear, avisame).

## Decisiones que tuve que tomar (no estaban explícitas en el prompt)

- `equipos.nombre` es `NOT NULL` y `vehiculos` no tenía un campo
  "nombre" propio — para los vehículos migrados usé la patente como
  nombre.
- La tabla `vehiculo_asignaciones` mantuvo su nombre (solo se renombró
  su columna `vehiculo_id` → `equipo_id`) — el prompt pedía renombrar
  la columna, no la tabla.
- El historial de asignaciones (antes en la ficha separada de un
  vehículo) se conservó como parte del modal "Asignación" en vez de
  crear una ficha/ruta por id para Equipos — Equipos nunca tuvo ficha
  propia (lista + edición inline), así que no agregué una solo para
  esto.
