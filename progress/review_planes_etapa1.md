# Review: tarea 124 planes_4_categorias, ETAPA 1 del rediseño (commit 2eb76af)

**Veredicto:** CHANGES_REQUESTED (RECHAZADO)

Qué se revisó: `git diff 2eb76af~1 2eb76af` (25 archivos), el diseño aprobado en
`progress/current.md` ("Tarea 124: REDISEÑO aprobado") y `docs/harness/*` + `CHECKPOINTS.md`.
En prod solo se hicieron SELECT (ref yjbskbskyadxjooxngjv, 24-sep):
- migraciones 129, 130 y **131 ya aplicadas**; la 132 no.
- empresas: 1 `trial`, 2 `pro`. No hay ninguna en `basico` ni `operacion`.
- `roles`: supervisor = agenda, ordenes_servicio, viajes, registros, rutas, flota, agenda_pro;
  colaborador = agenda, agenda_pro, asistente, registros; contador sin registros; admin con registros.
- `empresa_modulos`: registros=true (2), informe_ia=true (3), asistente=true (3). `empresa_rol_modulos`: 0 filas
  con registros/informe_ia/asistente.
- `empresa_modulos` y `empresa_rol_modulos` no tienen CHECK sobre `modulo` (solo PK/FK), así que la 132 no choca con ningún constraint.

`./verificar.sh` (Node 22): **verde, EXIT=0**. tsc x6, shared 34 tests, design-tokens 5, backend 7,
eslint, hooks, audit:tenant 0 (baseline), colores 3 (baseline), 132 migraciones.

---

## Hallazgos

### ALTA
**H1. Una prueba gratis no puede pasar sola a Esencial ni a Operación: queda sin salida.**
- `backend/src/planes.ts:19-26` (`activarModulosDePrueba`) deja las 17 secciones contables activas en toda empresa nueva.
- `backend/src/limites.ts:183-192` (`verificarModulosCabenEnPlan`) devuelve 409 si hay más activos que el tope. Se
  llama en `backend/src/routes/plan.ts:83` y `backend/src/routes/suscripcion.ts:105`.
- Escenario: termina la prueba de 7 días, el Admin entra a Configuración > Plan y aprieta "Cambiar a Esencial"
  (`web/src/app/dashboard/configuracion/plan/page.tsx:302-340`). Recibe 409: "…hoy tienes 17 activos. Apaga 11 para
  poder cambiar." Pero **la empresa no tiene cómo apagar módulos**. El único endpoint que escribe
  `empresa_modulos` es el del Super-Admin (`backend/src/superadmin/routes.ts:1472-1506`); la pantalla del Admin llega
  recién en la etapa 3. El único plan que puede contratar sola es Pro. Con `DIAS_PRUEBA = 7`
  (`packages/shared/src/planes.ts:45`) esto le pasa a cada alta nueva a la semana.
- Además el mensaje le pide al usuario algo que no puede hacer (va contra convenciones.md §Idioma: mensajes claros).
- Cambio requerido (una de dos):
  (a) Mientras no exista la etapa 3, cuando `modulosActivos > modulosMax` la tarjeta de Esencial/Operación no ofrece
      "Cambiar a …". Muestra "Tienes N módulos activos y este plan permite M; escríbenos para elegir cuáles mantener"
      (o equivalente), y el 409 del camino de la empresa dice lo mismo (no "Apaga N"). Dejar escrito en
      `progress/current.md` el procedimiento manual del Super-Admin.
  (b) No mergear la etapa 1 a `main` hasta tener la etapa 3. Documentarlo en `progress/current.md`.

### MEDIA
**H2. El Asistente se ve en planes que no lo incluyen (web y mobile 1.10.17) y falla con 403.**
- `backend/src/permisos.ts:49-53` (`modulosVisiblesDeUsuario`) filtra `MODULOS_SOLO_ADMIN` por rol, pero **no** filtra
  `asistente` por plan. El plan lo exige recién la ruta (`backend/src/server.ts:386`, `requierePlanIACompleta`).
- Escenario: una prueba pasa a Esencial u Operación (hoy vía Super-Admin, por H1). El cambio de plan ya no toca módulos
  (`backend/src/planes.ts:28-56`), así que `asistente` sigue activo y el Admin lo ve en web
  (`web/src/components/DashboardShell.tsx:648`) y en mobile 1.10.17 (`HoyScreen.tsx:108`, `MasScreen.tsx:103`,
  `AgendaScreen.tsx:131`, `ClientesListaScreen.tsx:50`). Todas esas pantallas dependen solo de `modulos_visibles`. Al
  abrirlo recibe 403 LIMITE_PLAN. No se cae (`AsistenteScreen.tsx:42-48` y `AsistenteChat.tsx:88-92` muestran el
  error), pero es justo lo que el comentario de `permisos.ts:46-48` dice que se evita.
- Cambio requerido: en `modulosVisiblesDeUsuario`, sacar `asistente` cuando `!planPermiteIACompleta(plan)`. Con eso
  mobile 1.10.17 se corrige sin build nuevo, porque solo mira `modulos_visibles`. Agregar un test del filtro. Si se
  extrae como función pura a shared (rol + plan + lista → visibles), el test cubre también que el **admin no queda
  afuera** (punto 2 del encargo; hoy es correcto por lectura, `rol === "admin" || …`, pero no hay test).

**H3. No hay evidencia contra el sistema real (C4, verificacion.md Nivel 3).**
No hay `progress/impl_*` de esta etapa ni registro en `current.md` de pruebas contra DEV. Lo nuevo es sobre todo de
seguridad y está en backend, sin tests: `puedeUsarInformeIA` (`trabajos.ts:108`), `requiereRol("admin")` en
`/api/informe` (`server.ts:327`), `requierePlanIACompleta` (`server.ts:386`), `verificarModulosCabenEnPlan` y
`verificarPuedeActivarModulo` (`limites.ts:183-208`). Los tests de shared solo cubren constantes y el conteo puro.
Cambio requerido: con la migración 132 corrida en DEV, dejar registrada en `progress/current.md` esta evidencia (status + cuerpo):
1. supervisor → `GET /api/informe/historial` 403; `POST /api/trabajos/:id/informe-ia`, `PATCH /api/trabajos/:id/informe-ia` y `POST /api/trabajos/:id/pdf-versiones` 403. Admin → 200/201.
2. `/api/me` del supervisor y del colaborador de dev con `equipos, inventario, catalogo, proveedores` presentes (y sin `informe_ia`/`asistente`); el del admin con todo.
3. Empresa de dev en `basico` con más de 6 activos → `POST /api/plan/cambiar` 409 **sin** llamada a Flow; `PATCH /api/superadmin/empresas/:id/modulos` activando uno más → 403 LIMITE_PLAN; `/api/asistente` → 403.
4. Web: abrir una OS, crear una OS, Agenda, Gastos → Rendiciones, Clientes, Equipos, Inventario, Catálogo con admin, supervisor, contador y colaborador (colaborador en mobile).
Limpiar los datos de prueba al terminar.

### BAJA (no bloquean, conviene corregir en la misma pasada)
- **B1 Comentarios que ya no son ciertos.** `backend/src/routes/trabajos.ts:1911-1915` todavía dice "Solo admin, o
  supervisor SI el Admin le delegó el módulo informe_ia". `trabajos.ts:1917` dice "solo Admin + Pro" y `trabajos.ts:1207`
  cita `PLANES_CON_ANALISIS_FOTOS_IA`, que ya no existe. Además `trabajos.ts:100-103` es el comentario de
  `trabajoBloqueado`, pero quedó encima de `puedeUsarInformeIA` (104-110): lo separa la función nueva.
- **B2 Alias y código de packs que quedan.** Alias `planPermiteAnalisisFotosIA` (`packages/shared/src/limites.ts:42`)
  y `verificarPlanAnalisisFotosIA` (`backend/src/limites.ts:140`): basta con renombrar el único uso de cada uno.
  `POST /api/plan/cotizar-empresa` (`plan.ts:125-133`) queda vivo detrás de `PLAN_EMPRESA_DISPONIBLE` (la web ya no
  lo llama), lo que es aceptable. La columna `empresas.pack_rubro` ya existe en prod (131 aplicada) y no tiene uso:
  anotar el drop como tarea/deuda en `trabajo_list.json` y no solo en el comentario de la 132.
- **B3 Códigos distintos para "tope de módulos".** Activar sobre el tope da 403 LIMITE_PLAN (`limites.ts:204`) y
  cambiar de plan da 409 (`limites.ts:188`). Si es a propósito, dejarlo dicho en el comentario. El check-then-write
  de `verificarPuedeActivarModulo` + upsert (`superadmin/routes.ts:1487-1495`) no es atómico. Es de riesgo bajo
  (solo Super-Admin), pero en la etapa 3 lo usará el Admin de la empresa y ahí conviene cerrarlo.
- **B4 `.limit()` explícito** (arquitectura.md §Patrones): falta en `limites.ts:175` (`empresa_modulos`, acotado por naturaleza).
- **B5 Mobile 1.10.17, cosmético.** El Super-Admin en el teléfono muestra "Registros" (ahora es solo Clientes) y las
  claves crudas `equipos/inventario/catalogo/proveedores`. `MiPlanScreen` no tiene etiqueta para
  `operacion`/`empresa` y muestra "Básico" en vez de "Esencial" (esto viene de la etapa anterior). Se corrige en el
  build de la etapa 4, sin riesgo de caída (usa `?? m.modulo` / `?? info.planActual`).
- **B6 Documentación.** `docs/harness/arquitectura.md` §Roles (capa 3) sigue con `Plan: trial | basico | pro` y
  "módulos contratados". Hay que actualizarlo al modelo de topes. En `progress/current.md` el bloque de la etapa
  vieja (packs) y "Pasos que tiene que hacer la usuaria" siguen pidiendo correr la 131, **que ya está en prod**.
  Marcarlo como reemplazado y poner los pasos de la 132.
- **B7** `verificarLimiteInformesIA` con periodo "prueba" cuenta todo el historial de `ia_uso`. Si el Super-Admin
  devuelve a `trial` una empresa que ya usó IA, arranca con el cupo gastado. Es un caso borde: documentarlo o filtrar
  desde `empresas.creado_en`/inicio de la prueba.

---

## Revisión por foco del encargo

### 1. Integridad (OS, agenda, gastos/rendiciones, clientes, inventario, catálogo, equipos)
- [x] No quedan claves viejas. `grep "registros"` en backend/web/mobile deja solo el nav de Clientes
  (`DashboardShell.tsx:89`, `dashboard/page.tsx:77`) y el guard de escritura de equipos, ya migrado a `"equipos"`
  (`backend/src/routes/equipos.ts:312`). Las rutas `/api/clientes|equipos|inventario|catalogo|proveedores` no tienen
  `requiereModulo` (`server.ts`), así que el cambio de clave no las corta.
- [x] Gastos y Rendiciones siguen con `financiero` (`server.ts:349-350`). OS (`/api/trabajos`) y agenda no se tocaron.
  Los únicos cambios en OS son los guards de informe IA (`trabajos.ts:1926, 2039, 2116`), que no afectan abrir, crear
  ni editar.
- [x] Web OS: el bloque de informe IA exige `rol === "admin" && modulosVisibles.includes("informe_ia")`
  (`web/src/app/dashboard/ordenes/[id]/page.tsx:751`). Es solo JSX condicional, sin hooks nuevos.
- [x] Roles en prod (SELECT): supervisor y colaborador tienen `registros`, y la 132 paso 2 les copia las 4 claves
  nuevas. Admin no depende de la tabla (`roles.ts:149`).
- [ ] Salida de la prueba a Esencial/Operación: bloqueada (H1).
- [ ] Sin verificación E2E de estos flujos por rol (H3).

### 2. Seguridad y permisos
- [x] `/api/informe/*`: `requiereRol("admin")` a nivel router (`server.ts:327`).
- [x] `POST /api/trabajos/:id/informe-ia` (`trabajos.ts:1926`), `PATCH` (`trabajos.ts:2039`), `POST /pdf-versiones`
  (`trabajos.ts:2116`): `puedeUsarInformeIA` = admin + módulo. `GET /:id/informe-ia` no existe. `GET /pdf-versiones`
  sigue con `colaboradorPuedeVerPdf` (`trabajos.ts:2077`), que es lectura del PDF de la OS y está bien.
  `generarInformeOS` tiene un solo llamador (`trabajos.ts:2009`).
- [x] El tope de informes con IA se aplica en el único punto de salida a Claude (`backend/src/claude.ts:70`).
- [x] `/api/asistente`: rol + módulo + `requierePlanIACompleta` (`server.ts:386`). Fotos IA: admin + plan (`trabajos.ts:1215-1219`).
- [~] Visibilidad del Asistente por plan: falta (H2).
- [x] Tope de módulos antes de Flow: `/api/plan/cambiar` verifica en `plan.ts:83`, antes de `suscribirAPlan` (`plan.ts:96+`);
  `/api/suscripcion/tarjeta` en `suscripcion.ts:105`, antes de Flow; Super-Admin plan en `superadmin/routes.ts:1367`,
  antes de `cambiarPlanEmpresa`; Super-Admin módulos en `superadmin/routes.ts:1487`.
- [x] `PLAN_EMPRESA_DISPONIBLE=false`: Empresa queda fuera de `/cambiar` y de `/tarjeta` (400) y `/cotizar-empresa` da
  404. El Super-Admin lo puede asignar (`PLANES`, `superadmin/routes.ts:38`).
- [x] Multi-tenant: las queries nuevas filtran por `empresa_id` (`limites.ts:152-155, 175`), `obtenerPlan` va por id, y audit:tenant da 0.
- [x] `MODULOS_SOLO_ADMIN` no deja fuera al admin: `rol === "admin" || !MODULOS_SOLO_ADMIN.includes(m)` (`permisos.ts:52`),
  y `modulosDeRol("admin")` devuelve todos los `MODULOS` (`roles.ts:149`). Correcto por lectura, pero sin test (H2/H3).
- [x] `informe_ia` fuera de `MODULOS_DELEGABLES_POR_EMPRESA` (`packages/shared/src/permisos.ts:91-93`): los overrides
  viejos se ignoran (`roles.ts:119`). En prod no hay ninguno.

### 3. Migración 132
- [x] Aditiva, sin DDL ni tablas nuevas (no hace falta RLS). La numeración es correlativa.
- [x] Idempotente: pasos 1, 3 y 4 con `on conflict do nothing`. El paso 2 tiene un guard que lo saltea si ya están las 4 claves.
- [x] Nadie gana ni pierde acceso: solo copia las filas explícitas de `registros` (sin fila rige el default, que es activo
  para las 4 nuevas porque no están en `MODULOS_OPCIONALES`, `permisos.ts:143`). El paso 4 (informe_ia) da acceso a
  propósito, según el diseño, y en prod no hace nada: las 3 empresas ya tienen fila `true`.
- [x] Sin CHECK sobre `modulo` en prod (SELECT a `pg_constraint`).
- [x] Detalle: `array_agg(distinct x order by x)` reordena `roles.modulos` alfabéticamente. Es inocuo.
- [x] Orden de despliegue documentado (`progress/current.md`, última línea): 132 en prod **antes** del merge. Con el
  backend viejo la 132 es inocua (claves extra en `roles.modulos`). Ojo: `main` va 14 commits atrás de esta rama
  (incluye la 131, ya aplicada, y el fix de la tarea 119). El merge lleva todo junto.

### 4. Compatibilidad con mobile 1.10.17
- [x] Mobile no usa `registros`, `equipos`, `informe_ia` ni `/informe-ia` (grep en `mobile/src` y en la rama del build
  `79675c5`). Las claves nuevas en `modulos_visibles` no afectan a la app.
- [x] `GET /api/plan`: el 1.10.17 lee `planActual`, `pruebaTerminaEn`, `trialVencido` e `historial`
  (`git show 79675c5:mobile/src/services/plan.ts`). Siguen todos. Se sacaron `packRubro` y `packSugerido`, que el
  1.10.17 no usaba.
- [x] El toggle de módulos del Super-Admin en mobile maneja el error (`setError(r.error)`).
- [ ] El Asistente aparece y responde 403 en Esencial/Operación (H2). Detalle cosmético en B5.

### 5. Calidad
- [x] Errores: `obtenerPlan` y las lecturas nuevas tiran `Error` con mensaje (`limites.ts:162, 176`). Hay clase propia
  `ModulosExcedenPlanError` con status 409 y el handler global respeta `.status` (`server.ts:445-450`). Los mensajes
  están en español.
- [x] Los tests de shared afirman valores concretos (`planes.test.ts`, `limites.test.ts`).
- [ ] Falta cobertura de backend para los guards nuevos (H3) y del filtro de visibles (H2).
- [ ] Comentarios desactualizados o mal ubicados (B1), código de packs sin limpiar (B2), docs (B6).

---

## Arquitectura / Convenciones / Verificación
- [x] Capas: web/mobile no llaman a `supabase.from(...)`. Todo IO nuevo está en backend.
- [x] Tipos desde `@bitacora/shared`. Sin `any` ni `@ts-ignore` nuevos.
- [x] Status HTTP: 400 validación, 403 rol/límite, 404 Empresa apagado, 409 plan igual o módulos que no caben.
- [~] `.limit()` explícito: falta en `limites.ts:175` (B4).
- [x] Migración NN correlativa, aditiva e idempotente.
- [ ] Verificación Nivel 3 contra DEV: sin evidencia (H3).

## CHECKPOINTS
- C1 Arnés completo: [x] (archivos presentes, `verificar.sh` exit 0)
- C2 Estado coherente: [~] 1 sola tarea `in_progress` (124) [x]; `current.md` describe la sesión activa, pero con el
  bloque de packs reemplazado y pasos vencidos (131 ya aplicada) [ ] (B6)
- C3 Arquitectura: [x] capas, [x] sin tablas nuevas, [x] audit:tenant 0, [x] sin RPC nueva, [x] sin dependencias nuevas,
  [x] sin prints de debug nuevos (el `console.error` del historial ya existía)
- C4 Verificación real: [x] verificar.sh verde; [x] test de la lógica de dominio en shared; [ ] API/UI probada contra
  el sistema real (H3); [ ] migración 132 sin aplicar en prod (esperable con la tarea `in_progress`: no mergear antes)
- C5 Cierre: no aplica todavía (la tarea sigue `in_progress`). [x] Commit de respaldo hecho. [x] Sin temporales
  sospechosos. Los `supabase/.temp/*` modificados son del CLI y no hay que commitearlos.

## Cambios requeridos
1. **H1**: dejar una salida real para prueba → Esencial/Operación (opción a o b de arriba), sin pedirle al usuario
   que haga algo que no puede.
2. **H2**: filtrar `asistente` por plan en `modulosVisiblesDeUsuario` (`backend/src/permisos.ts:49-53`), con un test
   que también cubra que el admin conserva `informe_ia`/`asistente` y el supervisor no.
3. **H3**: evidencia E2E contra DEV de los 4 bloques listados en H3, registrada en `progress/current.md`.
4. B1 y B6 (comentarios y docs desactualizados) en la misma pasada. B2 a B5 y B7 quedan a criterio, anotados si se posponen.
