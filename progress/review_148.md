# Review — tarea 148 ficha_equipo_pestanas (commit 9f1de19)

**Veredicto:** CHANGES_REQUESTED

`./verificar.sh` (Node 22.23.3) termina en verde, exit 0: tsc x7, tests shared 51, tokens 5, backend 33, mobile 25, web 12, eslint, hooks, audit:tenant 0, colores 3 (baseline), 144 migraciones.
E2E `npm run e2e -- equiposDocumentos` contra DEV (backend local en :8080): 22/22, incluido `PASS 148-1 los viajes se filtran por equipo`.
El rechazo no viene de la verificación. Viene de un bug de layout en el menú "⋯", de una regresión de doble clic en `Table` y de criterios de aceptación sin test.

## Criterios de aceptación
- [x] Ficha mobile con pestañas Resumen · Mantención · OS · Viajes · Documentos · Eventos → `mobile/src/features/equipos/EquipoDetalleScreen.test.tsx:62-72` (chofer: Resumen "1 vencido", pestaña Documentos, Mantención sin "Agregar"), `:74-86` (admin), `:95` (Eventos visible sin Flota).
- [ ] Pestaña Viajes en mobile → sin test. Ningún test pone `"viajes"` en `mockModulos`, así que la pestaña nunca se renderiza (`EquipoDetalleScreen.tsx:205`, `:385-412`).
- [ ] Ficha web con las 6 pestañas (`web/src/app/dashboard/registros/equipos/[id]/page.tsx:110-120`) → sin test de pantalla. No hay `*.test.tsx` para la ficha ni para `ViajesDelEquipo.tsx`. `verificacion.md` §2b pide prueba para toda pantalla crítica cambiada.
- [ ] "El monto solo lo ven Admin y Supervisor" → sin test. En web depende de `verMontos={puedeGestionar}` (`page.tsx:366`, `ViajesDelEquipo.tsx:52`) y ningún test comprueba que un colaborador o supervisor vea u oculte la columna Total.
- [x] Backend `/api/viajes?equipo_id=` → E2E `e2e/suites/equiposDocumentos.ts:92-102` (148-1, corrido: PASS).
- [~] Lista Equipos web: clic, doble clic y Enter abren la ficha; acciones en "⋯" → `web/src/components/TablaFilaClic.test.tsx:33-40` y `:42-51`. Pasa, pero el test de doble clic valida el comportamiento defectuoso (ver M1).
- [x] Regla en `docs/harness/convenciones.md:87-97` y tarea 149 creada en `trabajo_list.json` (id 149).

## Hallazgos

### B (bloqueante)
**B1. El menú "⋯" queda recortado dentro del contenedor con scroll horizontal** (`packages/ui/src/web/Table.tsx:75` + `:125`).
- El menú es `absolute ... z-20` y está dentro de `<div className="overflow-x-auto">`.
- Según la especificación de CSS, con `overflow-x: auto` el `overflow-y` también se calcula como `auto`. Todo lo que el menú sobresalga por debajo de la tabla se recorta y aparece una barra de scroll vertical dentro del Card.
- En listas cortas (1-3 equipos, lo normal en una empresa nueva) las opciones Editar, Asignación, Documentos y Desactivar quedan tapadas. Como se quitaron los botones sueltos (`equipos/page.tsx:426-438`), el menú es ahora el único acceso a esas acciones.
- Lo deduzco de la especificación; no lo abrí en un navegador. Confirmarlo en vivo con una lista de 1 fila.
- Arreglo sugerido: renderizar el menú en un portal con `position: fixed`, o abrirlo hacia arriba en las últimas filas.

### M (mayor)
**M1. Un doble clic llama a `onFilaClick` tres veces** (`Table.tsx:91-92`).
- El navegador dispara click → click → dblclick, y los tres llaman al callback. `router.push` se ejecuta 3 veces. En `levantamientos/page.tsx:458` `abrirDetalle` hace fetch 3 veces.
- El `onDoubleClick` no aporta nada, porque el primer clic ya abre la fila.
- `TablaFilaClic.test.tsx:35-38` lo esconde: dispara eventos sueltos y exige `toHaveBeenCalledTimes(3)`.
- Arreglo sugerido: quitar `onDoubleClick`, o ignorar `e.detail > 1` en `onClick`. Ajustar el test para que un doble clic real (click+click+dblclick) cuente 1 llamada.

**M2. Regresión en las tablas que ya usaban `onFilaClick`: el doble clic en controles internos abre la fila.**
- Los controles frenan `click` pero no `dblclick`, y el `onDoubleClick` nuevo de la fila lo recibe:
  - `ordenes/page.tsx:277`: checkbox de selección.
  - `ordenes/page.tsx:296-299`: botón "Ver PDF".
  - `registros/clientes/page.tsx:311`: link de WhatsApp.
  - `financiero/cotizaciones/page.tsx:182`: Select de etapa.
- Lo mismo pasa en `Table.tsx:155` con los botones de acciones en modo no-menú.
- Doble clic sobre esos controles ahora navega fuera de la página. Se resuelve junto con M1 si se quita `onDoubleClick`.
- Hoy la regla de `convenciones.md:94-95` ("frenar la propagación") no alcanza.

**M3. El enlace `?editar=` abre la edición de viajes facturados** (`web/src/app/dashboard/viajes/page.tsx:239-241`).
- La lista oculta "Editar" cuando `v.estado === "facturado"` (`viajes/page.tsx:~822`), pero el enlace llama `abrirEdicion(v)` sin esa condición.
- El usuario edita y el backend responde 409 (`backend/src/routes/viajes.ts:464`).
- Tampoco hay `scrollIntoView`. La fila de edición es inline (`viajes/page.tsx:842`), así que si el viaje está abajo en la lista, el usuario llega a Viajes y parece que no pasó nada.

**M4. Criterios sin test** (detalle arriba): ficha web (pestañas y monto según rol) y pestaña Viajes en mobile.
- Mínimo: una prueba Vitest de la ficha con `apiFetchSimulado`: admin ve Viajes con Total; supervisor ve Total; sin módulo `viajes` no hay pestaña.
- Y un caso en `EquipoDetalleScreen.test.tsx` con `mockModulos` que incluya `"viajes"`.

**M5. C2 incoherente.**
- `trabajo_list.json` tiene la 148 en `in_progress`, pero `progress/current.md` dice "Sin tarea en curso (25-sep: 135, 144 y 146 publicadas…)".
- Tampoco hay `progress/impl_148.md` ni una entrada en `history.md`, así que la evidencia (E2E 148-1) no quedó registrada. `current.md` debe describir la sesión activa.

### m (menor)
- m1. Accesibilidad del menú (`Table.tsx:113-143`):
  - Tiene `role="menu"`, pero no hay navegación con flechas.
  - El foco no entra al menú al abrirlo, y Escape (`:58-60`) no devuelve el foco al botón "⋯".
  - Tab fuera del menú no lo cierra.
  - Si todas las acciones están `oculta`, el botón abre un menú vacío.
  - Alternativa: sacar `role="menu"`/`menuitem` y dejar botones simples dentro de un disclosure.
- m2. `<tr tabIndex={0}>` (`Table.tsx:100`) sin `aria-label` ni rol: el lector de pantalla no anuncia que la fila se puede activar. Además, esto suma una parada de tabulación por fila en las 6 tablas que ya usaban `onFilaClick`; es aceptable, pero conviene saberlo.
- m3. `ViajesDelEquipo.tsx:23`: el `.then` no tiene `.catch`. Si falla la red, queda cargando para siempre y deja un unhandled rejection.
- m4. Mobile: `EquipoDetalleScreen.tsx:84` convierte cualquier error de viajes en `[]` y muestra "Este vehículo todavía no tiene viajes". Distinguir error de vacío, como hace `errorDocs`.
- m5. Mobile: la lista de viajes (`EquipoDetalleScreen.tsx:395-408`) no muestra el monto ni siquiera a Admin/Supervisor. `ViajeDeEquipo.total` existe (`mobile/src/services/equipos.ts:191`). El detalle sí lo muestra (vía `sinCostos`); confirmar con la usuaria si la lista también debe mostrarlo.
- m6. Mobile: las filas de OS (`EquipoDetalleScreen.tsx:363`, `<View>`) no se pueden tocar. Contradice la regla nueva para mobile (`convenciones.md:96`), y la tarea 149 solo lista tablas web. Hacerlas tocables o sumarlas a la 149.
- m7. Web: si cambian los módulos o la categoría, `tab` puede quedar apuntando a una pestaña oculta y el contenido queda en blanco (`page.tsx:42`, mobile `:59`). Poco probable.
- m8. `/api/viajes?equipo_id=` sin validar UUID. Un valor inválido da un 500 de Postgres (22P02), igual que `cliente_id`/`chofer_id` ya existentes (`viajes.ts:104-107`). El E2E tampoco prueba un `equipo_id` de otra empresa (queda cubierto en la práctica por `.eq("empresa_id", ...)` en `viajes.ts:97`).
- m9. Sistema de diseño: espaciados de la escala cruda de Tailwind en vez de `ds-*`: `Table.tsx:125` (`mt-1`, `py-1`), `:137` (`py-2`), `page.tsx` `Dato` (`py-1`). El lint no los marca porque no son `[Npx]`, pero la "regla de oro" de `docs/design-system.md:5` pide escala de tokens. Colores OK (check-colores sin literales nuevos). En `Dato`, "aviso" (`accent-800`) y "peligro" (`accent-700`) son casi del mismo tono.
- m10. `packages/ui/src/web/Table.stories.tsx` no tiene historia con `accionesEnMenu`.

## Arquitectura / Convenciones / Verificación
- [x] Capas: web y mobile consumen `/api/viajes` vía `apiFetch`/`apiJson` (`ViajesDelEquipo.tsx:23`, `mobile/src/services/equipos.ts:196`). No hay `supabase.from` nuevo en web ni en mobile; el `supabase` de `page.tsx:9` es solo auth, igual que antes.
- [x] Multi-tenant: el filtro `equipo_id` se suma a `.eq("empresa_id", req.empresaId!)` (`backend/src/routes/viajes.ts:97,107`). El router está detrás de `requiereModulo("viajes")` (`backend/src/server.ts:411`). audit:tenant 0.
- [x] `sinCostos` sigue aplicando a toda la respuesta (`viajes.ts:114`).
- [x] Mobile, abrir viaje: navega a `Viajes > ViajeDetalle`, que usa `/api/mis-viajes/:id`. Para gestión no filtra por chofer (`backend/src/routes/misViajes.ts:81`), así que Admin/Supervisor abren viajes de otros choferes.
- [x] Reglas de hooks en `Table`: `useState`/`useRef`/`useEffect` van antes de los `return` tempranos (`Table.tsx:51-71`). El lint de hooks pasa.
- [x] `Table` retrocompatible: sin `accionesEnMenu` renderiza como antes (`Table.tsx:146-166`). Las ~20 tablas sin `onFilaClick` no cambian. Las 6 con `onFilaClick` sí se ven afectadas: ver M1, M2 y m2.
- [x] Enter en controles internos no abre la fila (`e.target === e.currentTarget`, `Table.tsx:96`), y el botón "⋯" además frena el keydown (`:119`).
- [x] Tabs Agenda/Hoy de mobile sin tocar: el diff de mobile se limita a `features/equipos/*` y `services/equipos.ts`.
- [x] Sin dependencias nuevas (`lucide-react` ya estaba), sin migraciones y sin prints de debug.
- [ ] Pruebas de pantalla de la ficha web (verificacion.md §2b) → M4.

## CHECKPOINTS
- C1: [x] arnés completo; [x] `verificar.sh` exit 0.
- C2: [x] una sola `in_progress`; [ ] `current.md` no describe la sesión activa de la 148 (M5); [x] las `done` previas no cambian.
- C3: [x] capas; [x] no hay tablas nuevas; [x] audit:tenant 0; [x] no hay RPC nueva; [x] sin dependencias nuevas; [x] sin debug/TODO.
- C4: [x] verificar verde; [ ] UI nueva sin prueba de pantalla en web y pestaña Viajes mobile sin test (M4); [x] API probada contra el sistema real (E2E 148-1 PASS, corrido en esta revisión); [x] no hay migración.
- C5: [x] sin temporales (solo `supabase/.temp/*` preexistente); [ ] `history.md` sin entrada para la 148; [x] la 148 sigue `in_progress` (correcto mientras esté en revisión); [x] commit hecho; [x] `mobile/app.json` no aplica (sin build pedido).

## Cambios requeridos
1. B1: que el menú "⋯" no quede recortado por el `overflow-x-auto` de `Table.tsx:75` (portal o `position: fixed`, o abrir hacia arriba). Confirmarlo en navegador con una lista de 1 fila.
2. M1 + M2: quitar `onDoubleClick` de la fila (`Table.tsx:92`), o deduplicar con `e.detail`, para que un doble clic real llame 1 vez y el doble clic en checkbox, link o select no navegue. Ajustar `TablaFilaClic.test.tsx:33-40` y agregar un caso de doble clic sobre un control interno.
3. M3: en `viajes/page.tsx:239-241` no abrir la edición si `v.estado === "facturado"` (mostrar aviso o abrir en solo lectura) y hacer `scrollIntoView` a la fila editada.
4. M4: prueba Vitest de la ficha web (pestañas según módulo y categoría; Total visible para admin/supervisor y oculto para otro rol) y un caso mobile con módulo `viajes` que muestre la pestaña Viajes.
5. M5: actualizar `progress/current.md` con la sesión de la 148 (plan, decisiones, evidencia E2E) y, al cerrar, la entrada en `history.md`.
6. Recomendado (no bloquea): m1, m3, m4, m6.
