# Bitácora histórica (append-only)

> Al cerrar cada sesión, su resumen se añade acá. No edites entradas
> anteriores; solo añadís al final.

Formato:

```
## AAAA-MM-DD — <tarea o tema>
- **Agente:** <quién>
- **Plan:** <1-2 líneas>
- **Cambios:** <archivos/áreas tocadas>
- **Verificación:** <qué corrió, resultado>
- **Cierre:** <estado final, próximo paso>
```

> Contexto anterior a este archivo: ver `RESUMEN_TRABAJO.md`, el historial de
> git y la memoria del proyecto. Desde acá, la bitácora de sesiones vive
> en este archivo.

---

## 2026-09-09 — Montaje del harness
- **Agente:** Claude Sonnet 5
- **Plan:** analizar `~/ejemplo-harness-subagentes`, extraer una plantilla
  reutilizable (`~/harness-template`) e instanciarla en bitacora (modelo
  híbrido).
- **Cambios:** `AGENTS.md`, `CLAUDE.md`, `CHECKPOINTS.md`, `verificar.sh`,
  `trabajo_list.json`, `progress/`, `docs/harness/*`, `.claude/settings.json`,
  `.claude/agents/{lider,implementador,revisor}.md`.
- **Verificación:** `./verificar.sh` verde (tsc backend/shared/web/mobile,
  17 tests de shared, audit:tenant en baseline 6, migraciones sin huecos;
  lint web en WARN conocido → tarea #1).
- **Cierre:** arnés operativo. `trabajo_list.json` con 6 tareas pending.

## 2026-09-09 — Tarea #7: tenant_baseline_cero
- **Agente:** Claude Sonnet 5 (directo)
- **Plan:** revisar a mano los 6 hallazgos baseline de `audit:tenant` y
  marcar los legítimos con `// tenant-ok:`.
- **Cambios:** `backend/src/routes/authLogin.ts` (:59), `mfa.ts` (3 comentarios
  cubriendo :37/:86/:152/:163), `trabajos.ts` (:1057). `verificar.sh`
  `BASELINE_TENANT` 6→0. `trabajo_list.json` #7.
- **Revisión:** los 6 operan sobre la fila del usuario autenticado
  (`req.userId` del JWT) o sobre una OS ya acotada por
  `obtenerOCrearOrden/trabajoExiste(req.empresaId!)`. Ninguno es un agujero
  de aislamiento; son data por-usuario o id ya validado arriba.
- **Verificación:** `npm run audit:tenant` → "Sin hallazgos.", exit 0.
  `./verificar.sh` verde (paso 7 en [OK], 0 hallazgos).
- **Cierre:** #7 `done`. Baseline de aislamiento = 0.

## 2026-09-11 → 2026-09-23 — Sesiones acumuladas (tareas 1–6, 8–98)
- **Agente:** varios (Claude, directo y con subagentes)
- **Plan:** `progress/current.md` no se vació al cerrar cada sesión y
  llegó a ~6.600 líneas. Se archivó completo, sin editar, en
  `progress/archivo/current_2026-09-11_a_2026-09-23.md` (detalle de
  cada tarea, decisiones, incidentes y comandos usados).
- **Cambios:** tareas cerradas en ese período (estado real en
  `trabajo_list.json`):
  - #1 Arreglar eslint en web (Next 16)
  - #2 Workflow de CI que corre verificar.sh en cada push/PR
  - #3 Rotar la key del deploy hook de Render expuesta
  - #4 Smoke test de arranque del backend + 2-3 endpoints críticos
  - #5 E2E en prod: Mantención de flota + rediseño de PDF de OS
  - #6 Regenerar CONTEXTO_PROYECTO.md
  - #8 Sistema de diseño unificado (tokens + packages/ui) y re-migración
  - #9 Edición de Viajes (Admin/Supervisor) + fotos inicio/término en OS
  - #10 Flujo de mantención de equipo: bug real de subida + detalle con fotos editables
  - #11 Bug real (prod): sync de fotos se apila y el registro nunca se crea
  - #12 Regresión real del fix 11: 'Reintentar ahora' bloqueado en silencio
  - #13 Elegir foto de galería (no solo cámara) + eliminar en todas las pantallas de fotos
  - #14 Módulo Levantamientos — Paso 0 (auditoría, sin código)
  - #15 Módulo Levantamientos — implementación (Pasos 1-5)
  - #16 Levantamientos (web): Admin puede editar, subir/eliminar fotos y eliminar el levantamiento
  - #17 Levantamientos (mobile): agregar cola offline — corrige una simplificación apurada
  - #18 Storybook para packages/ui
  - #19 Checklist distinto para mantención diaria vs. programa (6 meses) + PDF completo
  - #20 Bug real: banner "Sin conexión" falso con señal real (5G, 4 barras)
  - #21 Sistema visual movil v2 -- Paso 0 (auditoria) + primitivas + piloto Mas
  - #22 Sistema visual movil v2 -- piloto 2: Hoy
  - #23 Sistema visual movil v2 -- piloto 3: detalle de OS (TrabajoDetalleScreen)
  - #24 URGENTE: reparar deploy de Render roto desde el 9-sep
  - #25 Sistema visual movil v2 -- piloto 4 (ultimo): ficha de cliente
  - #26 Persona de contacto en Clientes (contacto_nombre)
  - #27 Estandarizar campos de dinero/ciudad/hora/fecha (web + mobile)
  - #28 Firma rota (mobile), folio de OS invisible en Hoy, naming Trabajo->OS
  - #29 Fotos de viaje y mantención atoradas en la cola (nunca llegan al backend)
  - #30 Migrar Agenda/Clientes al sistema visual v2, conectar color_secundario, arreglar gap del Portal del Cliente y el boton Asistente
  - #31 Migrar TODAS las pantallas mobile restantes al sistema visual v2 (homologar toda la app)
  - #32 Optimizar GET /api/clientes -- mover agregados a SQL (RPC clientes_resumen)
  - #33 Optimizar #2 de la revision de rendimiento -- descuento/reversion de stock en 1 RPC atomica
  - #34 Optimizar #3 de la revision de rendimiento -- revisarCobrosCliente en 1 query batch
  - #35 Hallazgo menor de la revision de rendimiento -- <img> a next/image en todo el web
  - #36 Documentar el problema estructural de numeracion de migraciones (sin renumerar)
  - #37 Migrar informes/secciones/*.tsx y componentes.tsx al sistema visual v2
  - #38 Parte A -- tipo de campo 'foto' en Tipos de trabajo (fotos incrustadas en el formulario de OS)
  - #39 Parte B -- que secciones muestra el informe/PDF de OS (configurable por empresa)
  - #40 Etapas de cotizacion configurables por empresa (pendiente grande, retomado)
  - #41 Distinguir tipo de item en la Pizarra + folio propio por tipo (OS/CIT/VIA/LEV)
  - #42 Deslizar entre las 4 pestanas (Pizarra/Agenda/Clientes/Mas)
  - #43 Migrar web/dashboard/agenda/page.tsx al sistema de diseno ds- (hallazgo 2)
  - #44 Tema visual 'Taller' (punto 7, antes solo maqueta) + duracion de cita configurable en empresa
  - #45 Informes personalizados -- v1 acotada (catalogo de widgets existentes + tabla nueva)
  - #46 Resolver las vulnerabilidades pendientes de npm audit (deferidas de sesiones anteriores)
  - #47 Icono nuevo (libro azul) + tema "Confianza" (investigacion de mercado con imagenes antes)
  - #48 CRITICO: el build de produccion en Vercel llevaba ~1 dia roto (recharts sin @reduxjs/toolkit)
  - #49 Fix: flash de pantalla vacia al entrar a /dashboard/levantamientos
  - #50 Fix safe-area inferior (Android edge-to-edge) + componente compartido QuickAccessCard
  - #51 Tema (colores) por empresa en mobile + selector en Perfil + build APK
  - #52 Nuevo gasto: reordenar descripción/foto + mostrar folio de OS en el picker
  - #53 Levantamiento: header + folio · Nuevo gasto: crear proveedor/categoría · Selector de día: hoy marcado
  - #54 Sidebar web: Levantamientos antes que Órdenes de servicio
  - #55 Levantamiento: fecha de visita + aparece en Pizarra y Agenda (mobile) si está asignado
  - #56 Folio correlativo: Cliente, Pack de sesiones, Gasto, Proveedor, Cobro
  - #57 Personas: invitar en modal · Perfiles: roles plegables · Plantillas: encabezado con niveles
  - #58 Agenda: menú +Nuevo (Cita/OS/Levantamiento) · Levantamiento: hora de visita · Tipos de documento: eliminar + sugerencias
  - #59 Unificar Tipo de OS y Tipo de Trabajo en un solo catálogo (Tipo de OS/Trabajo)
  - #60 Portal del cliente movido a Configuración · fix: toggle de Inventario quedaba pegado en 'sin productos'
  - #61 Form rápido de Nueva Tarea (Agenda): agrega 'Crear Levantamiento' junto a 'Crear Orden de Servicio'
  - #62 Costo, precio mayorista y precio minorista (opcional por empresa) en Catálogo, OS y Cotización
  - #63 Fix: borrar una OS daba 500 (ordenes_servicio.trabajo_id sin ON DELETE CASCADE)
  - #64 Build local APK 1.10.9 (versionCode 50)
  - #65 Mobile: el Admin ve Levantamientos en 'Más' (antes solo función Técnico/Chofer)
  - #66 Super-Admin: Restablecer contraseña también confirma el email (email_confirm: true)
  - #67 Pizarra (mobile): toggle Día/Semana para ver las actividades del día o de la semana
  - #68 Super-Admin (empresa): "Perfiles y permisos" y "Feature flags (beta)" pasan a ser retráctiles, colapsadas por defecto
  - #69 Super-Admin (empresa): el resto de las tarjetas también pasan a ser retráctiles
  - #70 Super-Admin: "Equipo" abierta por defecto + opción de contraseña personalizada al restablecer
  - #71 Super-Admin: se quita Feature flags (beta) de la página + panel de restablecer contraseña más minimalista
  - #72 Super-Admin: nueva pantalla "Salud" — dashboard global de monitoreo/observabilidad
  - #73 Salud (Super-Admin): 4 gráficos mensuales — IA, OS creadas, errores/requests lentos, storage
  - #74 Se agrega "Editar" a 3 catálogos simples que solo tenían Eliminar (tipos-documento, centros-costo, unidades-medida)
  - #75 Se agrega el botón "Eliminar orden de servicio" a la ficha de OS (backend ya lo soportaba)
  - #76 La OS gana un campo "Orden de compra del cliente" (referencia libre, siempre visible en el PDF)
  - #77 La ficha de OS muestra "Cliente" como su propio campo en Detalle (antes solo aparecía chico en el subtítulo)
  - #78 Feature completa: Rendiciones (fondo por rendir / caja chica) — migración + backend + web + mobile
  - #79 Mobile: editar/ver foto del gasto propio en una rendición en borrador + agrupar Gastos/Rendiciones en el menú Más
  - #80 Mobile: doble tap en Agenda (Mes) para nueva cita + grupo Administración de Más con iconos grandes
  - #81 Mobile: bajar un poco el boton flotante del Asistente (molestaba la visual)
  - #82 Dividir el modulo financiero en 3 activables independientes: Gastos/Rendiciones, Cobros, Cotizaciones
  - #83 Migrar la landing publica y el Logo compartido al sistema de diseno (se sentian dos apps distintas)
  - #84 Levantamientos: direccion del cliente + investigar bug 1 1 en materiales + descripcion por foto
  - #85 FASE 1 (spec grande de colaborador/OS/agenda): bug critico Marcar cotizado externamente siempre falla
  - #86 FASE 2 (spec grande): Colaborador solo ve sus clientes; Asistente IA exclusivo de Admin
  - #87 FASE 3 (parte 1/2 - backend+PDF): fotos con descripcion en OS, sacar firma del colaborador, cliente no disponible
  - #88 FASE 3 (parte 2/3): flujo de OS a 3 pasos en mobile (Iniciar/Ejecutar/Cerrar) + llegada/salida visible en web
  - #89 FASE 3 (parte 3/3): versionado de PDF con Informe IA revisable
  - #90 FASE 4: Admin agrega materiales a un levantamiento ya completado por el técnico
  - #91 FASE 5.1: colaborador solo ve sus propios gastos (Gastos y Rendición)
  - #92 FASE 5.2: colaborador ve su equipo/vehículo asignado con documentos y alertas de vencimiento
  - #93 FASE 5.3: "Mis trabajos" (historial), Agenda gris para completados, Admin ve historial ajeno
  - #94 FASE 6: Agenda — filtro por tipo + leyenda de colores (diagnóstico + centralización)
  - #95 FASE 7: menú web Inventario — análisis (sin cambios de código)
  - #96 Sistema de diseño: tonos "peligro"/"advertencia" reales (cierra deuda técnica de la Fase 5.2/6)
  - #97 Super-Admin elige el tema visual (Faena/Taller/Confianza) de cada empresa
  - #98 Super-Admin elige su propio estilo visual (web + mobile)
- **Verificación:** cada tarea cerró con `./verificar.sh` en verde (ver
  el archivo archivado y `resolution` en `trabajo_list.json`).
- **Cierre:** 98/98 tareas `done`. Migraciones 123–127 aplicadas en dev
  y prod (verificado 23-sep). Pendientes que no son código: unidad "1"
  de Hidroservi (la corrige un admin de esa empresa); build EAS cuando
  se pida. Siguiente tarea de código: paridad de Agenda web/mobile.

## 2026-09-23 — Sesión: estilos, Agenda, OS/PDF, ventas, flota, panel Salud (tareas 97–111)
- **Agente:** Claude (directo; subagentes Explore solo para el análisis de las 6 mejoras)
- **Plan:** pendientes de la usuaria + 6 mejoras (OS, PDF, ventas, flota) con
  análisis previo confirmado, y seguimiento de PRs hasta prod.
- **Cambios (PR #1 a #4, todos mergeados a main):**
  - 97/98: Super-Admin elige el tema por empresa y su propio estilo (migración 127).
  - 99: Agenda con paridad web/mobile (web muestra Levantamientos, mobile OS).
  - 100–102: fotos de OS agrupadas por categoría con descripción editable;
    comentarios del técnico bajo las fotos; informe IA bajo las fotos en el PDF.
  - 103: permisos de escritura en /api/equipos (antes sin ningún chequeo).
  - 104: Nueva OS sin "Tipo de OS" ni mapa; Rutas sin "Tipo de tarea".
  - 105/107: acción `registrar_venta` (Admin + Supervisor, migración 129).
  - 106: eventos semanales de flota (migración 128, índice validado con EXPLAIN ANALYZE).
  - 108: panel Salud con Vercel/Render/Cloudflare (faltan los tokens en Render).
  - 109: detalles menores (ítems reales en Mantención, Documentos con roles dinámicos).
  - 110: el estilo del Super-Admin no guardaba → era una extensión del navegador
    que reescribía el preflight CORS (sin PATCH); PR #3 dejó el error visible.
  - Infra: variables Preview en Vercel (los previews de PR ya construyen);
    migraciones 126–129 anotadas y aplicadas en dev y prod.
  - Decisiones: builds mobile solo locales (usuario `cquiroz`), documentado.
- **Verificación:** `./verificar.sh` en verde en cada commit; CI verde en cada PR;
  deploys de Render (live) y Vercel (READY) verificados tras cada merge.
- **Cierre / próximos pasos:**
  - Usuaria: build mobile 1.10.16 en `cquiroz` (llave de release nueva →
    reinstalar una vez en cada teléfono); tokens del panel Salud; pruebas en prod;
    quitar la extensión CORS del navegador.
  - Decisiones abiertas: Google Play prueba interna (US$25); categorías de
    empresa con productos + venta desde cita (maqueta enviada, no aplicada).
  - Deuda técnica: tarea 111 (proteger main en GitHub, evaluar repo privado).

## 2026-09-24 — Sesión: infra, mejoras post-auditoría y build 1.10.17 (tareas 112–123)
- **Agente:** Claude (directo, sin subagentes)
- **Cambios:**
  - 112: feedback de 1.10.16 (Asistente 96→72, chips de Agenda en scroll, "Nueva OS" neutro).
  - 113: "Mi plan" en mobile, solo lectura y solo Admin (pago en la web por Google Play).
  - 114: se borró `keep-warm.yml` (Render en Starter pago).
  - 116: límites de OS/usuarios en todas las rutas + contador de storage que descuenta.
  - 117: 403 con code `LIMITE_PLAN`; la cola offline mobile muestra el mensaje real.
  - 118: migración 130 cierra el acceso directo PostgREST; aplicada en dev y prod por la usuaria.
  - 119: crash al abrir una OS (hooks después de return anticipado) + regla rules-of-hooks en verificar.sh.
  - 123: build local APK 1.10.17 (versionCode 58) → `~/builds/apk/bitacora-1.10.17-vc58.apk`,
    firmado con la llave de release (huellas verificadas), URLs de prod.
- **Verificación:** `./verificar.sh` en verde (con Node 22; la Mac tiene Node 20.8
  global y los tests de backend / RN 0.86 necesitan más nuevo).
- **Cierre / próximos pasos:**
  - Usuaria: instalar 1.10.17 encima de 1.10.16 y probar abrir una OS, Mi plan y
    el mensaje de límite offline.
  - Pendientes: 115 (Render → Oregón), 120 (paginación etapa A), 121 (deuda
    paginación real), 122 (IA en fotos solo Pro/Empresa a pedido del Admin), 111.
  - Sugerido: actualizar Node global a 22 en la Mac (`brew install node@22`).
  - Hallazgos de infra para precios: Supabase org en FREE (sin backups), Vercel
    en cuenta personal (probable Hobby = sin uso comercial). Ver `docs/DEUDA_TECNICA.md`.

## 2026-09-24 — Tarea 122: IA en fotos solo Pro, a pedido del Admin, con Haiku
- **Agente:** Claude (directo, sin subagentes)
- **Cambios:**
  - Se eliminó el análisis automático al subir foto (y la env `ANALISIS_FOTOS_IA_ACTIVO`).
  - Nueva ruta `POST /api/trabajos/:id/fotos/:fotoId/analizar`: solo Admin, solo planes de
    `PLANES_CON_ANALISIS_FOTOS_IA` (packages/shared/src/limites.ts, hoy `["pro"]`), 403
    `LIMITE_PLAN` si no; no sobre OS finalizada; cuenta contra el tope mensual de IA.
  - `analizarFoto` pasa de Sonnet 5 a Haiku 4.5 (`claude-haiku-4-5`): $1/$5 vs $2/$10 por MTok.
  - Web (detalle OS): botón "Analizar con IA" por foto (Admin + Pro) y aviso de alerta.
  - Mobile sin cambios: ya muestra resumen/alerta cuando existen.
- **Verificación:** `./verificar.sh` en verde (Node 22 de la caché de npx; la Mac sigue en 20.8).
- **Pendiente / a confirmar:**
  - No existe plan "Empresa" en el código — cuando se cree, sumarlo a `PLANES_CON_ANALISIS_FOTOS_IA`.
  - Si Render prod tiene `ANALISIS_FOTOS_IA_ACTIVO` seteada, ya no se usa: se puede borrar.
  - Probar en prod con una empresa Pro tras el deploy (calidad de Haiku en fotos reales).

## 2026-09-24 — Mejoras Viajes Parte A (tareas 130-134) + revisión
- **Agente:** Claude Opus 5.5 (implementación directa + subagente revisor)
- **Plan:** Rutas dentro de Viajes, eliminar clientes, editar monto con historial, asignar chofer con hora/aviso/agenda, cobro multi-viaje con PDF.
- **Cambios:** backend (viajes, misViajes, cobros, clientes, auditoriaEmpresa, generarPdfCobro, viajesMontos/Asignacion/Cobros), shared, web (viajes, agenda, cobros, clientes, menú), mobile (sin build), migraciones 134-136.
- **Verificación:** verificar.sh verde; tests unitarios nuevos; E2E DEV 45/45 + 4/4 de la revisión.
- **Cierre:** tareas 130-134 blocked hasta migraciones 134-136 en prod; deuda en tarea 136. Siguiente: viáticos (137).

## 2026-09-24 — Viáticos por viaje (tarea 137)
- **Agente:** Claude Opus 5.5 (implementación directa + subagente revisor)
- **Plan:** viático local/interregional por viaje como gasto "Viáticos" del chofer, con resumen semanal/mensual y marcar pagado.
- **Cambios:** migración 137; shared (tipos, regionMetropolitana); backend (viajesViaticos.ts, viajes, misViajes, gastos); web (CampoViatico, Configuración › Viajes, Gastos › Viáticos); mobile (solo lectura, sin build).
- **Verificación:** verificar.sh verde; E2E DEV 26/26 + regresión 49/49; EXPLAIN ANALYZE con Index Scan; revisión con correcciones aplicadas.
- **Cierre:** blocked hasta migraciones 134-137 en prod. Siguiente: tarifas por tramo/km en Viajes y Cotización de viaje; auditoría de índices propuesta a la usuaria.

## 2026-09-24 — Contador fusionado en Supervisor (tarea 138)
- **Agente:** Claude Opus 5.5
- **Plan:** dejar un solo rol (Supervisor) que contenga al Contador; 2FA opcional (decisión de la usuaria).
- **Cambios:** migración 138; Rol sin "contador" en shared/backend/web/mobile; /me/mfa con `exigido`; CLAUDE.md y arquitectura.md.
- **Verificación:** verificar.sh verde; E2E DEV 138 9/9 + regresión 131-134/137/review verde.
- **Cierre:** blocked hasta migraciones 134-138 en prod. Pendiente de OK: auditoría de índices; siguiente del plan: Tarifas por tramo/km.

## 2026-09-24 — Publicación Viajes A + viáticos + fusión de roles
- **Agente:** Claude Opus 5.5
- **Cambios:** la usuaria corrió en prod las migraciones 134-138 (verificadas por SELECT; 0 usuarios contador). main 1c304bc → 8b95e9c (fast-forward, 13 commits).
- **Verificación:** verificar.sh verde; Render deploy dep-daqpegbl550s73cqock0 live (sin errores en logs, conecta a yjbskbskyadxjooxngjv); Vercel dpl_8vDCHpkgtpLK68yQ73mm85KjJcjV READY; /health 200 y rutas nuevas responden 401 sin sesión.
- **Cierre:** tareas 130-134, 137, 138 done. Pendiente: build mobile (a pedido), auditoría de índices (espera OK), tarifas por tramo/km + cotización de viaje, limpiar usuarios QA de DEV, planes en Flow + FLOW_PLAN_ID_* en Render, deuda 127/128/136.
