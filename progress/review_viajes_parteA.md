# Review: tareas 130-134 (Parte A de Viajes/Clientes/Cobros)

**Veredicto:** CHANGES_REQUESTED (RECHAZADO)

Rango revisado: `git diff 1c304bc..11946c6` (42 archivos). `./verificar.sh` con Node 22: **verde** (exit 0; tsc x6,
shared 39, tokens 5, backend 7, eslint, audit:tenant en 0, colores en 3, 136 migraciones).
E2E vuelto a correr contra DEV (backend local :8080): 131 11/11, 132 9/9, 133 12/12, 134 13/13.
Lecturas a prod (solo SELECT): migraciones aplicadas hasta la 133; 0 viajes con subtotal no entero; sin CHECK en
`notificaciones.tipo`; 0 viajes en prod.

El código funciona y la parte multi-tenant está bien. El rechazo es por 4 bloqueantes: 3 son del arnés
(C2, C3 y C4) y 1 es de integridad (el cliente se borra con citas y consentimientos). Todos se arreglan rápido.

## Criterios de aceptación
Los tests E2E están en `scratchpad/qa/prueba-13X.ts`, **fuera del repo**; ver B2.
- [x] 130 Rutas es subsección de Viajes, con redirect: `web/next.config.ts:8-13` (307). El menú usa el módulo de cada subitem (`DashboardShell.tsx:81-89`, `:389-393`). No quedan links a `/dashboard/rutas` (grep vacío en web/mobile/backend). Evidencia: prueba manual 307/200 que cuenta la resolution. No hay test versionado.
- [x] 130 Modelo ruta↔viajes: `supabase/migrations/134_ruta_viajes.sql` (RLS, revoke y es idempotente). Todavía no tiene UI.
- [~] 131 Eliminar cliente solo Admin y sin historial → prueba-131 (131-3 supervisor 403, 131-4 contador 403, 131-5 204, 131-10 409). **Falla en parte:** el historial no cuenta `tareas` ni `consentimientos` (ver B4).
- [x] 131 Auditoría → 131-7. `backend/src/auditoriaEmpresa.ts`
- [x] 132 El monto lo editan solo Admin y Supervisor, y el chofer puede mandar el mismo monto → 132-2..6. Regla: `backend/src/viajesMontos.ts:24-43`.
- [x] 132 Historial del monto → 132-7. `backend/src/routes/viajes.ts:478`
- [x] 132 Un viaje cobrado da 409 con el cobro → 132-9
- [x] 133 Asignar chofer (misma empresa, activo, función chofer) → 133-9, 133-10 (otra empresa da 400). `viajes.ts:278`, `:390`
- [x] 133 Hora opcional → 133-1, 133-11. Aviso por campana → 133-2 y 133-8. Pizarra y agenda → 133-3..7
- [x] 134 Mismo cliente, sin repetir viajes, folio → 134-1, 134-3, 134-4, 134-11 (pedidos simultáneos)
- [x] 134 Detalle, totales, período y PDF → 134-5..10. Revisión visual hecha.
- [x] 134 Borrar un cobro libera los viajes → 134-12, 134-13

## Seguridad (foco 1)
- [x] `DELETE /api/clientes/:id` y `/uso`: `requiereRol("admin")` (`clientes.ts:437`, `:451`). Ambos filtran por `empresa_id` (conteos, `clienteDeEmpresa` y delete). El 23503 se traduce a 409.
- [x] Historial de monto: **editar** se valida en el backend en las dos rutas (`viajes.ts` y `misViajes.ts` usan `ROLES_EDITAN_MONTO_VIAJE`). **Ver** el historial queda abierto a cualquier rol con el módulo `viajes` (incluye contador) y lo filtra la empresa. Es aceptable, pero no se documentó como decisión.
- [x] Validación de chofer: `viajesAsignacion.ts:18-30`, `.eq("empresa_id")` + activo + función. Cierra un hueco que ya existía (se aceptaba un id de otra empresa).
- [x] `/api/cobros/:id/pdf`: filtra `facturas`, `viajes` (`viajesCobros.ts:25`) y `plantillas_documento` por `empresa_id`. El nombre del archivo no admite inyección (folio numérico o uuid). Lo cubre `requiereModulo("cobros")` (`server.ts:332`).
- [~] Facturar "atómico": el UPDATE condicional (`viajes.ts:599-605`) garantiza que un viaje no quede en dos cobros (134-11 OK). No es transaccional: ver M2.
- [~] Borrar cobro: ver M1.
- [x] Migraciones 134-136: son aditivas e idempotentes (`if not exists` / `drop policy if exists`). Tienen RLS con `empresa_id = empresa_actual()` y `revoke all ... from anon, authenticated`.

## Integridad y compatibilidad con mobile 1.10.17 (foco 2)
- [x] La 1.10.17 edita mandando `subtotal: String(Math.round(viaje.subtotal))` (`git show 1c304bc:mobile/src/features/viajes/ViajeFormScreen.tsx:69`). `nuevosMontosViaje` compara contra `Number(existente.subtotal)`. Hoy son iguales porque en prod hay 0 subtotales no enteros (calcularMontos redondea). El chofer sigue pudiendo editar km, guía, etc. (132-5).
- [x] `viaje_asignado`: no hay CHECK en `notificaciones` y mobile no tiene feed de notificaciones → a la 1.10.17 no le afecta. `hora` es un campo extra en la respuesta de mis-viajes, que la app vieja ignora.
- [x] Las pantallas congeladas (Agenda/Hoy) se tocaron por pedido explícito y el cambio es aditivo (`AgendaScreen.tsx`, `hoy.ts:141`).
- [x] Rutas: `git mv` sin cambios de lógica, redirect y menú.
- [ ] **Orden de despliegue** (ver B3): con el backend nuevo y la 136 sin aplicar, `POST /api/viajes` inserta `hora` (`viajes.ts:308`) y la web manda `hora` en todo PATCH (`web/.../viajes/page.tsx:362`). Crear y editar viajes en la web daría 500. Sin la 135, el cliente se borra pero la auditoría se pierde (solo queda en errores_backend).

## Arquitectura / Convenciones / Verificación
- [x] Sin `supabase.from` en web/mobile (grep sobre el diff). Sin prints de debug ni TODOs.
- [x] audit:tenant en 0. Todas las consultas nuevas filtran por `empresa_id`.
- [ ] `auditoria_empresa` y `ruta_viajes` **no están en `TABLAS_POR_EMPRESA`** (`backend/src/tenant.ts:7-21`), ver B1.
- [ ] Lógica nueva de backend y shared **sin test unitario**, ver B2.
- [ ] Índices nuevos (`auditoria_empresa_entidad_idx`, `ruta_viajes_*`) sin `EXPLAIN ANALYZE` registrado (arquitectura.md §Invariantes).
- [~] `select("*")` en el endpoint nuevo del PDF (`cobros.ts:134`), contra la convención de columnas explícitas.
- [x] PDF: pdfkit en el worker (`pdfWorker.ts`, `pdfWorkerPool.ts`). Reusa `bloquesEncabezado` y `PDF` de pdfEstilo. No toca `generarPdfCotizacion.ts`. Las fechas son strings `YYYY-MM-DD`, así que no hay problema de zona horaria.
- [x] Estilo visual: tokens `ds-*`, `Button`, `Dialog`, `Modal` e `InputMonto` existentes. check-colores sin literales nuevos.

## CHECKPOINTS
- C1: [x] el arnés existe y `./verificar.sh` da exit 0
- C2: [ ] 0 tareas in_progress (OK), pero las **130-134 están `done` sin entrada en `progress/history.md`** (grep vacío). `progress/current.md` todavía arrastra las sesiones de la tarea 124, ya publicada.
- C3: [ ] tablas nuevas fuera de `TABLAS_POR_EMPRESA` (B1). Lo demás OK: capas, audit y sin dependencias nuevas.
- C4: [ ] verificar verde (OK), E2E real (OK). **Falta el test unitario de la lógica nueva (B2)**. **Las migraciones 134-136 no están en prod** y las tareas figuran `done` en vez de `blocked` (B3).
- C5: [ ] `supabase/.temp/*` quedó modificado sin commitear (`linked-project.json` ahora apunta a prod). Revertirlo o ignorarlo. Los commits de respaldo existen (uno por tarea). Mobile sin build, versión 1.10.17 sin cambios (correcto: no se pidió build).

## Cambios requeridos (bloqueantes)
1. **B1** Agregar `auditoria_empresa` y `ruta_viajes` a `TABLAS_POR_EMPRESA` en `backend/src/tenant.ts:7`, y a la lista de `backend/scripts/auditar-aislamiento.ts:20`. Hoy el export de empresa del Super-Admin (`superadmin/routes.ts:1396`) deja fuera la auditoría.
2. **B2** Tests `node:test` (tsx) versionados junto al código:
   - `backend/src/viajesMontos.test.ts`. Casos de `nuevosMontosViaje`: mismo monto como string `"150000"` → `cambio: null` (caso 1.10.17); solo `aplica_iva` cambia → cambio; `aplica_iva: "false"`; subtotal negativo o `"abc"` → error; `undefined/undefined` → null.
   - `normalizarHora` (`viajesAsignacion.ts:66`). Si importar `supabase` complica el test, mover la función pura aparte.
   - `estadoAgendaDeViaje` (`packages/shared/src/agendaColores.ts:98`).
   Los E2E de `scratchpad/qa` no quedan en el repo.
3. **B3** Dejar en `progress/current.md` el checklist de publicación: **migraciones 134, 135 y 136 en prod ANTES del merge a main**, con `db query -f` + `migration repair` (convenciones.md), y verificar con SELECT. Mientras la usuaria no las aplique, las tareas 130-134 van en `blocked` (C4). Agregar la entrada en `progress/history.md` para las 130-134 con la evidencia E2E (C2).
4. **B4** `HISTORIAL_CLIENTE` (`backend/src/routes/clientes.ts:400`) no cuenta `tareas` (citas/agenda, FK `ON DELETE SET NULL`) ni `consentimientos` (SET NULL). Hoy se puede borrar un cliente con citas o consentimientos firmados, que quedan huérfanos en silencio. Eso contradice "solo sin historial" y el comentario de `:393-398`. Agregarlas, con un E2E: cliente con 1 cita → 409. Revisar también si `portal_accesos` y `portal_codigos` (CASCADE) deben bloquear o avisar.

## Recomendados (no bloquean por sí solos)
- **M1** `DELETE /api/cobros/:id` (`cobros.ts:~425-438`): liberar los viajes no es atómico con el borrado. Si el UPDATE falla solo queda un `console.error` y se responde 204, y los viajes quedan `facturado` sin cobro, que es justo el bug que se quería corregir. Opciones: RPC transaccional, o liberar por `factura_id` ANTES del delete y abortar con 500 si falla. Además repone `confirmado` sin mirar el estado previo.
- **M2** `POST /api/viajes/facturar` (`viajes.ts:567-615`): la compensación no es transaccional. Se ignoran los errores del rollback, y el pedido que pierde gasta un folio COB (queda un hueco en la numeración). Una RPC con `for update` lo resolvería. Viene de antes: `.neq("estado","facturado")` deja cobrar viajes en `borrador`.
- **M3** `/api/mis-viajes` con rango mantiene `.limit(100)` (`misViajes.ts:46`). En la vista mes de gestión (web y mobile, `equipo=true`) puede truncar sin aviso y ocultar los primeros días.
- **M4** Web: el `InputMonto` de la edición (`viajes/page.tsx:802`) está habilitado para todos los roles, así que un contador recibe 403 al guardar. Replicar `ROLES_EDITAN_MONTO_VIAJE` en la UI, como hace mobile.
- **M5** `NotificacionesBell.tsx:17`: `viaje` lleva a `/dashboard/viajes` también al chofer colaborador, que no tiene esa página. La Agenda ya lo evita (`agenda/page.tsx:~680`).
- **M6** El chip "Viaje" de la Agenda web (`agenda/page.tsx:1137`, `:1191`) se muestra aunque el módulo `viajes` esté apagado. Mobile sí lo filtra.
- **M7** `ruta_viajes` no garantiza que la ruta y el viaje sean de la misma `empresa_id` (`134_ruta_viajes.sql:12-20`). Validarlo en el backend (o con una FK compuesta) antes de construir la UI.
- **M8** `select("*")` en `cobros.ts:134`: usar columnas explícitas.
