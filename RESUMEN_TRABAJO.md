# Resumen de trabajo

Este documento cubre las dos últimas tandas mergeadas a `main`: la
fusión Vehículos→Equipos y la ventana de cancelación de Agenda Pro.
Ambas se implementaron en ramas separadas y ya están mergeadas.

---

# Tanda 1 — Fusión Vehículos → Equipos

Rama: `feat/fusion-vehiculos-equipos` (mergeada a `main`).

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
verificaciones pasaron.

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

---

# Tanda 2 — Agenda Pro: ventana de cancelación y asistencia de paquetes

Rama: `feat/agenda-pro-cancelacion` (mergeada a `main`).

## Contexto

Adenda al spec "Agenda Pro — Gestión de paquetes de sesiones": la base
de paquetes/saldo automático y la activación opcional del módulo por
empresa ya existían y no se tocaron. Esta adenda resolvía la única
decisión de negocio que estaba pendiente (política de cancelación /
inasistencia) e implementaba exactamente eso — ventana configurable,
4 estados de una sesión con paquete, cálculo automático al cancelar,
ajuste del cálculo de saldo, y las advertencias en UI.

No se tocó "Sesión N de M" en el calendario/detalle del día — es un
punto del spec original que esta adenda no mencionó, sigue sin
implementar. Si se quiere, es un pedido aparte.

## Qué se hizo

### 1. Modelo de datos (`supabase/migrations/51_ventana_cancelacion_paquetes.sql`, ya aplicada)

- `agenda_pro_config.ventana_cancelacion_horas` (int, default 24) —
  vive en la misma tabla que `anticipacion_min_horas`/`dias_max_adelante`
  (reserva online), no se fragmentó la configuración de agenda.
- `EstadoTarea` gana `"no_asistio"` y `"cancelada_anticipada"` (constraint
  de `tareas` actualizado). Solo son relevantes para citas con
  `paquete_id`; las citas sueltas siguen usando el `"cancelada"` genérico
  de siempre, sin cambio de comportamiento.

### 2. Backend

- **`backend/src/agendaPro.ts`** (nuevo) — `calcularEstadoCancelacion(tarea, ventanaHoras, ahora?)`
  decide `no_asistio` vs `cancelada_anticipada` comparando la hora
  programada de la sesión contra el momento de cancelación y la
  ventana de la empresa. `obtenerOCrearAgendaProConfig()` se movió acá
  desde `agendaProConfig.ts` para que `tareas.ts` y `portal.ts` la
  reutilicen sin duplicarla.
- **`tareas.ts`** — `POST /api/tareas/:id/cancelar` (nuevo): si la
  tarea no tiene `paquete_id`, cancela igual que siempre (`"cancelada"`).
  Si lo tiene, aplica el cálculo automático y devuelve
  `{ ...tarea, descuenta: boolean }`. Rechaza con 400 si la tarea ya no
  está en `pendiente`/`confirmada`. El `PATCH /:id` genérico sigue
  aceptando cualquier estado a mano (incluidos los 2 nuevos), para
  correcciones manuales del staff.
- **`portal.ts`** — `POST /datos/citas/:id/cancelar` (cancelación por
  la clienta) usa el mismo cálculo. `GET /datos/citas/:id` ahora
  incluye `advertencia_cancelacion: { ventana_horas, descuenta_si_cancela_ahora } | null`
  para que el frontend avise ANTES de que confirme, no después.
- **`paquetesSesiones.ts`** — el cálculo de saldo excluye tanto
  `"cancelada"` como `"cancelada_anticipada"` (ambas liberan el cupo);
  `"no_asistio"` sigue contando como usada (se pierde la sesión).
- **`reservaPublica.ts`** — las citas `"cancelada_anticipada"` también
  liberan el slot para la reserva pública (igual que `"cancelada"`).
- **`agendaProConfig.ts`** — `PATCH` acepta `ventana_cancelacion_horas`
  (entero ≥ 0).

### 3. Frontend

- **Configuración → Reserva online**: tarjeta nueva "Cancelación de
  sesiones de paquetes" con el campo "Horas de anticipación para
  cancelar sin costo" (default 24) y su texto de ayuda.
- **Agenda → editar cita**: para citas con paquete, el selector de
  Estado muestra Pendiente / Confirmada / **Asistió** / **No asistió o
  cancelada tarde** / **Cancelada con anticipación** en vez del
  Pendiente/Completada/Cancelada genérico (las citas sin paquete no
  cambiaron). Botón nuevo **"Cancelar cita"** (visible solo si la cita
  tiene paquete y sigue pendiente/confirmada): calcula la ventana con
  la config ya cargada y, si corresponde, pide confirmación
  (`confirm()`, mismo patrón que "Eliminar") antes de llamar al
  endpoint de cancelación automática.
- **Portal cliente → detalle de cita**: mismo aviso — un banner
  (`WarningText`) visible de entrada si cancelar ahora igual
  descuenta, más el `confirm()` al tocar "Cancelar".
- `Badge`: colores para `no_asistio` (rojo) y `cancelada_anticipada`
  (neutro).

## Cómo se verificó

`npx tsc --noEmit` limpio en `backend` y `web`. Verificación en vivo
contra los dos servidores de desarrollo con una empresa/cliente/paquete
100% desechables (creados y borrados en la misma corrida): sesión a
+48h con ventana de 10h cancela como `cancelada_anticipada` (no
descuenta), sesión a +2h cancela como `no_asistio` (sí descuenta), una
cita sin paquete sigue cancelando como `"cancelada"` plano, re-cancelar
una cita ya terminal da 400, el saldo del paquete queda en 4/5 tras
esas dos cancelaciones, y el flujo del Portal (`GET` con
`advertencia_cancelacion` + `POST /cancelar`) da el mismo resultado
que el flujo del dashboard. Las 12 verificaciones pasaron.

## Decisión que sí tuve que tomar (no estaba en el spec)

Citas sin hora (`hora: null`) — el spec no dice cómo tratarlas para el
cálculo de horas de anticipación. Decisión tomada (marcada con
`// TODO: decisión pendiente` en `backend/src/agendaPro.ts`): se asume
`23:59` de la fecha de la cita como hora de la sesión, dándole el
beneficio de la duda al cliente (favorece "cancelada con
anticipación" antes que "no asistió"). Si preferís otro criterio,
está aislado en una sola función (`calcularEstadoCancelacion`).
