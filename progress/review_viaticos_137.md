# Review — tarea 137 viaticos_viaje

**Veredicto:** CHANGES_REQUESTED (RECHAZADO)

Alcance: commit 8b1b6d7. `git diff HEAD` solo trae `supabase/.temp/*` (archivos del CLI; `linked-project.json` apunta a prod `yjbskbskyadxjooxngjv`). No hay cambios de código sin commitear.
`./verificar.sh`: con el Node 20 del sistema falla (entorno: "Node 20 — se requiere >= 22", no encuentra tests). Con Node 22 (`~/.npm/_npx/52027bd8fc0022aa/.../node` v22.23.3) sale **verde, exit 0**: tsc x6, shared 44, design-tokens 5, backend 18 tests, eslint, audit:tenant 0, colores 3 (baseline), 137 migraciones.
E2E: no lo volví a correr (por instrucción). Leí `scratchpad/qa/prueba-137.ts` (23 checks).

## Criterios de aceptación
- [x] El viático es siempre del chofer asignado → 400 sin chofer en `backend/src/routes/viajes.ts:370` (POST) y `:554` (PATCH); el resumen toma el chofer del viaje (`backend/src/routes/gastos.ts:117`). Tests: E2E 137-4 (`prueba-137.ts:25`), 137-13 (`:66`).
- [x] Local = origen y destino en la RM; si no, interregional → `packages/shared/src/regionMetropolitana.test.ts:5-21` (incluye San Pedro de la Paz y San Pedro de Atacama).
- [x] Queda como gasto "Viáticos" pendiente hasta pagarle al chofer → E2E 137-6 (`prueba-137.ts:34`), 137-17 (`:77`); edición y quitar: 137-7 (`:39`), 137-22 (`:92`); sin huérfanos al borrar: 137-23 (`:98`).
- [x] Suma por semana o mes → `backend/src/viajesViaticos.test.ts:24-48` (lunes ISO, domingo, cruce de mes, mes); E2E 137-13/137-15 (`prueba-137.ts:66,69`).
- [x] Montos por defecto por empresa → E2E 137-2, 137-3 (`prueba-137.ts:16,18`).
- [x] Solo Admin/Supervisor lo definen → `viajes.ts:358-373` y `:540-551` (`ROLES_EDITAN_MONTO_VIAJE`); E2E 137-1 (`:14`), 137-10 (`:51`), 137-11 (`:53`), 137-12 (`:55`).
- [x] Pagado congelado → `viajes.ts:558` y `revisarViaticoAntesDeBorrar`; E2E 137-18..21 (`prueba-137.ts:81-87`); guard en Gastos `gastos.ts:354` con E2E 137-8/137-9 (`:43,45`).
- [x] No sale en el cobro ni en su PDF → `grep viatico` no encuentra nada en `backend/src/routes/cobros.ts`, `generarPdfCobro`, workers ni en la web de cobros; el cobro suma `viajes.subtotal/total`, no gastos. No hay un test específico, pero el código del cobro no se tocó y la regresión 134 (PDF de cobro) sigue verde según la evidencia.
- [ ] **Índices con `EXPLAIN ANALYZE`** (`arquitectura.md` §Invariantes; también en el plan, §Verificación): no hay evidencia para `idx_gastos_viatico_empresa_fecha` ni para `idx_gastos_viatico_viaje` (`supabase/migrations/137_viaticos.sql:35-38`). `progress/current.md` lo sigue marcando como pendiente. → B1.

## Arquitectura / Convenciones / Verificación
- [x] Capas: web y mobile no usan `supabase.from` para esto; todo pasa por `/api/viajes`, `/api/gastos`. (`web/src/app/dashboard/viaticos/page.tsx:7` importa `supabase` solo para `auth.getSession`, igual que las páginas vecinas.)
- [x] Multi-tenant: todas las queries nuevas filtran `empresa_id` (`viajesViaticos.ts:53,67,72,108,118,128,157`; `gastos.ts:118,192`); `empresas` por `id = empresaId` (`viajes.ts` GET/PATCH /config). audit:tenant 0.
- [x] Migración aditiva e idempotente, sin tablas nuevas (RLS ya activa en viajes, gastos y empresas), CHECK de tipo y monto juntos (`137_viaticos.sql:23-29`), índice único anti doble gasto (`:35`).
- [x] Tipos en shared (`packages/shared/src/types.ts`: `TipoViatico`, `ConfigViaticos`, `AgruparViaticos`, `FilaResumenViaticos`); no hay RPC nueva.
- [x] Sistema de diseño: tokens `ds-*` y `Select`/`Button`/`Card`/`Table`/`DatePicker`/`ErrorState`/`LoadingState` de `@bitacora/ui`; reutiliza `InputMonto`; check-colores en baseline.
- [x] Concurrencia de pagar: el UPDATE con `.eq("estado","pendiente")` (`gastos.ts:193`) evita contar dos veces un gasto si se paga dos veces a la vez (Postgres vuelve a evaluar el WHERE tras el lock), y `.select("monto")` devuelve solo las filas pagadas por esa petición.
- [x] Doble gasto por viaje: índice único + tolerancia a `23505` (`viajesViaticos.ts:139-140`).
- [ ] Consistencia al borrar un viaje: ver M1.
- [ ] Rol para PATCH /config: ver m1.

## CHECKPOINTS
- C1: [x] arnés completo; [x] `verificar.sh` exit 0 (con Node 22).
- C2: [x] una sola tarea `in_progress` (137). [ ] `progress/current.md` no coincide con el estado real: dice "Migración 137 … NO aplicada en DEV" y "Pendiente: migración en DEV → E2E … + EXPLAIN ANALYZE + revisor", pero el E2E 23/23 y la regresión 49/49 no están registrados en ningún archivo de `progress/`. → B2.
- C3: [x] capas; [x] no hay tablas nuevas; [x] audit:tenant 0; [x] no hay RPC; [x] no hay dependencias nuevas; [x] no hay prints ni TODOs.
- C4: [x] verificar verde; [x] tests unitarios con resultados concretos (`viajesViaticos.test.ts`, `regionMetropolitana.test.ts`); [x] E2E contra el endpoint real (23 checks); [ ] migración 137 no aplicada en prod → al cerrar, la tarea tiene que quedar `blocked` (igual que 130-134), no `done`.
- C5: [x] commit de respaldo (8b1b6d7, pero el mensaje dice "WIP, sin E2E"); [ ] `supabase/.temp/*` modificados y sin commitear, sin una razón anotada en current.md (no hay que commitearlos). [ ] No hay entrada en history.md (se hace al cierre). [x] mobile tocado sin build (no se pidió).

## Hallazgos

### B — bloqueantes
- **B1. Falta `EXPLAIN ANALYZE` de los índices nuevos.** `supabase/migrations/137_viaticos.sql:35-38`. Hay que correrlo en DEV (solo lectura) para la query de `GET /api/gastos/viaticos` (`gastos.ts:114-122`: `empresa_id = ? and es_viatico and fecha between ? and ?` + join a viajes) y para `gastoViaticoDe` (`viajesViaticos.ts:50-56`: `viaje_id = ? and es_viatico`). Registrar el plan en progress.
- **B2. El estado de la tarea no es coherente con la evidencia (C2/C4).** `progress/current.md` (sección "Tarea 137") dice que la migración no está en DEV y que el E2E está pendiente. Hay que registrar ahí la evidencia real: migración 137 aplicada en DEV, E2E 23/23, regresión 131-134 + review 49/49, EXPLAIN, y los datos QA que se limpiaron. Anotar también que al cerrar, la 137 queda `blocked` hasta que la usuaria corra la migración 137 en prod.

### M — medios
- **M1. Un gasto de viático puede quedar huérfano sin forma de arreglarlo.** `viajes.ts:650-660` y `misViajes.ts:483-493` borran primero el viaje y después el gasto pendiente. `borrarGastoViaticoPendiente` (`viajesViaticos.ts:155-158`) ignora el error. Con `on delete set null` (`120_rendiciones.sql:67`), si ese delete falla, o si "Marcar pagado" entra entre `revisarViaticoAntesDeBorrar` y el delete del viaje, queda un gasto `es_viatico=true, viaje_id=null`. Ese gasto:
  - no sale en Viáticos (`!inner`, `gastos.ts:117`);
  - no se puede corregir desde Gastos (409 "cámbialo desde el viaje", `gastos.ts:354-361`, y el viaje ya no existe);
  - no se puede borrar, porque no hay DELETE de gastos.

  Propuesta: borrar primero el gasto pendiente, condicionado a `estado='pendiente'`. Si el gasto existía y el delete afectó 0 filas (se pagó justo antes), responder 409. Después borrar el viaje. Si falla el delete del viaje, el viaje queda con viático y sin gasto, y el próximo guardado lo recrea (`sincronizarGastoViatico` ya lo hace).

### m — menores
- **m1.** `viajes.ts:62` usa `requiereRol("admin")`. `backend/src/permisos.ts:13` dice que `requiereRol` "queda solo para compatibilidad puntual" y no respeta los overrides de rol por empresa (arquitectura §Roles). Conviene usar `requiereAccion` con la acción de configuración que corresponda, o justificarlo en un comentario.
- **m2. Carrera entre PATCH del viaje y "Marcar pagado".** Si se paga entre el chequeo de `viajes.ts:557-561` y el update del viaje, `sincronizarGastoViatico` devuelve `ok` sin tocar nada (`viajesViaticos.ts:104`; el update/delete con `.eq("estado","pendiente")` en `:108,:120` afecta 0 filas sin avisar). El viaje queda con un monto o chofer distinto al del gasto pagado. La ventana es chica. Se puede detectar si el update/delete devuelve 0 filas y avisar.
- **m3.** Si el sync falla después de crear el viaje (`viajes.ts:416-421`), se responde 500 con el viaje ya creado. La web deja el modal abierto con el error (`web/src/app/dashboard/viajes/page.tsx:275`) y, si el usuario vuelve a apretar Guardar, se duplica el viaje (no hay unique en `numero_guia`). Mejor: responder 201 con un aviso, o cerrar el modal y recargar ante ese error.
- **m4.** Con dos guardados a la vez con montos distintos, el perdedor del `23505` devuelve `ok` y su monto no llega al gasto. Además consume un folio de gasto que queda como hueco (`viajesViaticos.ts:126-140`).
- **m5.** Si "Marcar pagado" falla, se usa `setError` (`viaticos/page.tsx:116`), que reemplaza la tabla por un `ErrorState` con el título "No se pudieron cargar los viáticos" (`:169-170`), y queda así hasta cambiar un filtro. Conviene un estado de error aparte para la acción.
- **m6.** `fecha_pago` por defecto sale de `new Date().toISOString()` (`gastos.ts:190`), en UTC: después de las ~20-21 h de Chile queda con fecha del día siguiente. La web no manda `fecha_pago` (`viaticos/page.tsx:112`). Es el mismo patrón de `gastos.ts:384`, pero acá lo gatilla siempre la UI.
- **m7.** `POST /viaticos/pagar` arma `.in("id", ids)` con hasta 5000 UUIDs (`gastos.ts:122,194`). Con rangos largos (hasta 400 días) la URL de PostgREST puede pasarse de largo. El resumen además se trunca sin avisar en 5000. Conviene partir en lotes o avisar del truncado.
- **m8.** `misViajes.ts:455` ignora el error de `sincronizarGastoViatico`, así que el gasto puede quedar con la fecha o la guía anteriores sin aviso.
- **m9.** Acceso: el resumen y "Marcar pagado" están abiertos a `contador` (`esGestion`, `gastos.ts:25`), y los viáticos dependen del módulo `financiero` (`server.ts:360`). Una empresa con `viajes` sin `financiero` genera gastos de viático que no puede ver ni pagar. Ninguno de los dos es un error; vale la pena confirmarlos con la usuaria.
- **m10.** Cobertura E2E: no hay un caso de reasignar el chofer con el viático pendiente (el resumen tiene que pasar al chofer nuevo), ni de pagos o guardados simultáneos.
- **m11.** Con `desde` = día 1 por defecto (`viaticos/page.tsx:46`), la primera fila semanal dice "Semana del 31-08-…" pero solo suma días de septiembre. El pago se recorta bien (`:106-108`); es solo una cuestión de rótulo.

## Cambios requeridos
1. B1: `EXPLAIN ANALYZE` en DEV de las dos queries y registrarlo.
2. B2: actualizar `progress/current.md` con la evidencia real (DEV, E2E 23/23, regresión 49/49, EXPLAIN, limpieza) y dejar anotado que al cierre la 137 va a `blocked` hasta la migración en prod.
3. M1: invertir el orden al borrar (gasto pendiente condicional → viaje) en `viajes.ts:650-660` y `misViajes.ts:483-493`, con 409 si se pagó en el medio. Agregar el caso al E2E.
4. Recomendados (no bloquean): m1, m3, m5; el resto queda a criterio o como deuda.
