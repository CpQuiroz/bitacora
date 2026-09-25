# Review — tarea 144 paso1_salida_prod

**Veredicto:** RECHAZADO (CHANGES_REQUESTED) — sin bloqueantes; 2 mayores, 11 menores.

Alcance: `git diff 4dd2533..74a283e` (commits 7b911a1 + 74a283e), contra `docs/harness/{arquitectura,convenciones}.md`, `CHECKPOINTS.md`,
`trabajo_list.json` #144 y `progress/current.md` §"Tarea 144".

## Verificación ejecutada por el revisor
- `./verificar.sh` con Node 22 (`~/.npm/_npx/52027bd8fc0022aa/node_modules/node/bin`): **exit 0**. tsc x7, shared 51, design-tokens 5,
  backend 30, mobile 12 y web 10 tests en verde; eslint OK; audit:tenant 0 hallazgos; colores literales 3 (baseline); 144 migraciones.
  Con el Node 20.8 global de la Mac falla (entorno, ya anotado en history.md 2026-09-24; no es de esta tarea).
- Sondeo de la lista de rutas permitidas (`rutaPermitidaConPruebaVencida`) y del ruteo de Express 4 con una app mínima:
  - `/api/trabajos?x=/api/plan`, `/api/plantillas`, `/api/planes-mantencion`, `/api/usuarios/meX`, `/API/PLAN`, `/api/plan;x` → bloqueadas.
  - `/api/plan/../trabajos`, `/api/plan/%2e%2e/trabajos` y `/api/usuarios/me/..%2F..%2Ftrabajos` pasan el filtro, pero Express no
    resuelve los segmentos con puntos: responden 404 dentro del router permitido. **No hay bypass por query string ni por prefijo.**
  - Express enruta sin distinguir mayúsculas (`/API/Trabajos` → trabajos) y el filtro sí distingue: falla hacia el lado seguro (bloquea).
- E2E: no las volví a correr (necesitan backend y DEV levantados). Según current.md: 28/30 en la suite; 144-29 y 144-30 esperan la migración 144 en DEV.

## Criterios de aceptación
1. Prueba vencida
- [x] Bloqueo en backend con "hoy" en Chile → `empresaConPruebaVencida` + `hoyChile` (backend/src/empresaOperativa.ts:14, backend/src/fechaChile.ts:3);
      gate en backend/src/empresa.ts:72. Tests: shared planes.test.ts:83-88 (borde: el último día sigue con acceso); E2E 144-1, 144-6, 144-7
      (e2e/suites/pruebaVencida.ts:57, 77, 79).
- [x] Plan/pago y Mi cuenta abiertos → E2E 144-3, 144-4 (pruebaVencida.ts:61-73). Borrar la empresa cerrado (decisión "nunca borrar") → 144-5 (:75).
- [ ] "Bloqueo total salvo Plan/pago y Mi cuenta": `/api/usuarios/me/vehiculo*` sigue abierto → **M1**.
- [x] Portal: link (portal.ts:130), sesión ya abierta (portalAuth.ts:73), login por RUT (portal.ts:111) → E2E 144-8, 144-9 (:82, :85).
      El login por RUT (`solicitar-codigo`/`verificar-codigo`) no tiene E2E → ver **M2**.
- [x] Reserva online → reservaPublica.ts:31 (info, disponibilidad y reservar comparten `empresaHabilitada`) → E2E 144-10 solo prueba `/info` (:87).
- [x] Bot de WhatsApp → whatsapp.ts:255 (webhook real) y :337 (simulador) → E2E 144-11 (:93), solo por el simulador.
- [x] Nunca borrar datos: ningún flujo nuevo borra; el gate responde 403 y la cola mobile deja las acciones como fallidas, no las borra (queue.ts:313-325).
- [x] Reactivación con el pago: sin cambios en `cambiarPlanEmpresa`; el gate lee `plan === "trial"` en cada request.
- [x] Super-Admin Extender N días / Reactivar / historial con quién y cuándo → superadmin/routes.ts:1799-1888; E2E 144-12..144-20 (:100-121).
- [x] Web: menú "Tu cuenta", aviso y redirección (DashboardShell.tsx:191-207, 318-323, 549-557); Configuración filtrada (configuracion/layout.tsx:49, 93-95).
      Sin test automatizado de UI (no hay suite de DashboardShell) — aceptable, igual que el resto del shell.
- [x] Mobile: fase `prueba-vencida` (AuthContext.tsx:103-106), pila acotada a PruebaVencida/MiPlan/Perfil (RootNavigator.tsx:36-44), aviso por
      TRIAL_VENCIDO (api.ts:163-165). Sin test de mobile para esta fase (ver m9).
2. Integraciones
- [x] API 404 (integraciones.ts:16-22) y link de pago 410 (cobros.ts:458-461) → E2E 144-23, 144-24 (:131, :133).
- [x] Web: sección fuera del menú (configuracion/layout.tsx:30) y página redirige (integraciones/page.tsx:46-51); columna "Link de pago" fuera de Cobros.
- [x] Mobile: botón "Abrir link de pago" eliminado (CobroDetalleScreen.tsx). `link_pago` no se expone en ningún otro endpoint (portal
      `/datos/cobros` lee `facturas` sin ese campo, portal.ts:617). El asistente ya no lee `integraciones` (asistente.ts:487-526).
- [x] Tablas y código intactos (bandera `INTEGRACIONES_VISIBLES`, packages/shared/src/funcionalidades.ts:8).
3. Leyenda de viático
- [x] Fuera de Viajes web (viajes/page.tsx) y de la ficha del chofer en mobile; test ajustado ViajeFormScreen.test.tsx:50-57.
- [x] El monto sigue configurable por el Admin (Configuración › Viajes, sin cambios) y el Super-Admin (superadmin/routes.ts:1890-1941, validación
      compartida `leerConfigViaticos` en viajesViaticos.ts:27) → E2E 144-21, 144-22 (:124-130). Cálculo del gasto sin cambios.
- [x] Ajuste por viaje intacto (CampoViatico.tsx sin cambios).
4. Rubro y empresa nueva
- [x] Rubro obligatorio sin default: onboarding (onboarding/page.tsx:26, 60-63), alta Super-Admin (superadmin/page.tsx:40, 66-69); backend ya
      validaba (server.ts:262, superadmin/routes.ts:479) → E2E 144-25, 144-26 (:143-147).
- [x] Parte vacía salvo checklists de transporte (seedRubro.ts:88-94) → E2E 144-27, 144-28 (:152-154).
- [~] Sugerencias por rubro: migración 144 + `SugerenciasRubro` en Servicios/Tipos de pack; las otras 4 pantallas ya consumían
      `/api/sugerencias-rubro`. E2E 144-29/144-30 (:160-168) **en rojo hasta aplicar la migración 144 en DEV** (esperado, pero impide cerrar).

## Hallazgos

### Bloqueantes (B)
Ninguno.

### Mayores (M)
- **M1 — Fuga en la lista de rutas permitidas: `/api/usuarios/me/vehiculo` y `/api/usuarios/me/vehiculo/registros-mantencion` siguen abiertas con la prueba vencida.**
  backend/src/empresaOperativa.ts:42 permite todo lo que cuelga de `/api/usuarios/me`, y eso incluye backend/src/routes/usuarios.ts:402 y :418,
  que devuelven datos de la operación (vehículo asignado, sus documentos y el historial de mantención). Esto contradice el "bloqueo total salvo
  Plan/pago y Mi cuenta" que pidió la usuaria. El impacto es bajo (solo lectura, solo el vehículo propio, sin pantalla que lo use en la pila
  bloqueada), pero es justo el tipo de fuga que se pidió revisar. Arreglo: permitir solo las subrutas de cuenta (`/api/usuarios/me` exacto,
  `/me/datos`, `/me/accesos`, `/me/foto`, `/me/mfa*`) o excluir `/me/vehiculo`, y sumar un caso E2E negativo.
- **M2 — La lógica de seguridad nueva no tiene test propio, y hay entradas públicas sin E2E.**
  `rutaPermitidaConPruebaVencida` / `esRuta` (empresaOperativa.ts:27-45) deciden qué queda abierto y no tienen `empresaOperativa.test.ts`
  (convenciones §Tests: un archivo de test por módulo, con assert del resultado concreto). Deberían cubrirse los bordes: `/api/plantillas`,
  `/api/planes-mantencion`, `?x=/api/plan`, `/api/usuarios/me/vehiculo` y mayúsculas. El E2E tampoco cubre el login del portal por RUT
  (`/solicitar-codigo`, `/verificar-codigo`, portal.ts:148 y :198), `POST /reserva-publica/:id/reservar` (reservaPublica.ts:143) ni el webhook real
  de WhatsApp (whatsapp.ts:255; solo se prueba `/_simular`). Pedido mínimo: el test unitario y el caso E2E de `solicitar-codigo`.

### Menores (m)
- **m1** web/src/components/DashboardShell.tsx:321 — `pathname.startsWith("/dashboard/configuracion/plan")` también deja pasar
  `/dashboard/configuracion/plantillas` (es el bug de prefijo que el backend ya corrigió en `esRuta`). Solo afecta la UI: el backend responde 403.
  Conviene comparar por segmento.
- **m2** web/src/app/dashboard/configuracion/seguridad/page.tsx:184-191 — "Eliminar empresa" sigue a la vista con la prueba vencida y termina en
  403 TRIAL_VENCIDO. Mejor ocultarlo o explicar por qué no está disponible.
- **m3** backend/src/superadmin/routes.ts:1852 — "Reactivar" pone `hoy + 7` aunque la prueba vigente termine más tarde, así que puede *acortarla*.
  El botón se ve siempre (web/src/app/superadmin/empresas/[id]/page.tsx:1020). Usar `max(actual, hoy+7)` o deshabilitarlo si sigue vigente.
- **m4** backend/src/superadmin/routes.ts:1858-1868 — el PATCH de fecha exacta no tiene tope, a diferencia de extender (máximo 90 días):
  acepta 2099-12-31. La UI ya no lo usa; poner tope o retirarlo.
- **m5** backend/src/superadmin/routes.ts:1822 — `update(...).eq("plan","trial")` sin comprobar las filas afectadas: si el plan cambió entre la
  lectura y la escritura, responde 200 y deja una auditoría de un cambio que nunca ocurrió.
- **m6** backend/src/server.ts:277-278 y backend/src/superadmin/routes.ts:500-501 — el alta calcula `prueba_termina_en` en UTC y lo demás usa
  `hoyChile()`. Si la empresa se registra después de las ~21 h de Chile, recibe 8 días en vez de 7. Unificar con `sumarDiasFecha(hoyChile(), DIAS_PRUEBA)`.
- **m7** backend/src/routes/portal.ts:111 — `empresaOperativa` hace una consulta por cada cliente con ese RUT (N+1), sobre una consulta de
  clientes sin `.limit()` (preexistente). Resolverlo con un join a `empresas(estado, plan, prueba_termina_en)`.
- **m8** mobile/src/services/sync/queue.ts:313-325 junto con mobile/src/features/perfil/PerfilScreen.tsx:251, 286 — las acciones offline que
  respondan 403 TRIAL_VENCIDO quedan `fallida` y no se reintentan solas después del pago, y en la pila bloqueada Perfil ofrece "Descartar todo".
  Nada se borra solo, pero hay riesgo de perder trabajo por un clic. Sugerencia: no marcar fallida con TRIAL_VENCIDO (dejarla pendiente) o
  explicarlo en Perfil.
- **m9** mobile/src/features/auth/AuthContext.tsx:103 — la fase `prueba-vencida` se resuelve antes del gate de 2FA, pero en el backend
  (empresa.ts:80-87) el 2FA sigue exigido en las rutas permitidas. Un admin sin 2FA toca "Ver mi plan" y recibe MFA_REQUERIDA en vez de
  guiarlo. Además la fase nueva no tiene test de mobile.
- **m10** backend/src/routes/encuestaPublica.ts:10 — la encuesta pública (sin sesión, llega por correo) no se cortó. No estaba en la lista
  pedida (portal, reserva, bot), pero es otra entrada del cliente final: confirmar con la usuaria.
- **m11** backend/src/routes/sugerenciasRubro.ts:31 — `select("*")` sin `.limit()` (preexistente, archivo tocado por la tarea). Ahora que la
  tabla crece con `datos`, conviene listar las columnas (arquitectura §Patrones).

Observación, no es hallazgo: la impersonación del Super-Admin también queda bloqueada con la prueba vencida (requiereEmpresa). Es coherente con
lo pedido, pero limita el soporte; confirmarlo con la usuaria.

## Arquitectura / Convenciones / Sistema de diseño
- [x] Capas: web y mobile no usan `supabase.from(...)` (mobile solo usa Auth); todo por `/api/*`.
- [x] Multi-tenant: no hay tablas nuevas; el historial filtra por `empresa_id` (superadmin/routes.ts:1877); audit:tenant 0.
- [x] Migración 144 aditiva e idempotente (amplía los CHECK, `add column if not exists`, `insert ... where not exists`), NN correlativo.
      Tabla solo de backend con RLS ya activa (migración 73).
- [x] Errores: 400/403/404/409/410 correctos y mensajes en español.
- [x] Agenda/Hoy de mobile sin tocar (el diff de mobile no incluye `features/agenda` ni `hoy`); las sugerencias no se metieron en los modales
      congelados (decisión anotada en current.md).
- [x] Google Play: sin botón de pago en mobile. PruebaVencidaScreen.tsx:25-45 solo remite a la web con texto, igual que MiPlanScreen y el
      criterio de services/plan.ts:4-7.
- [x] Sistema de diseño: SugerenciasRubro.tsx usa solo clases `ds-*`; el aviso del shell repite el patrón del banner de consentimiento
      (`bg-ds-accent-700 text-white`); check-colores sin literales nuevos. El panel de Super-Admin sigue con sus componentes propios (`@/components/ui`), igual que antes.
- [x] Commits en español con cierre de coautoría.

## CHECKPOINTS
- C1: [x] el arnés existe · [x] docs · [x] verificar.sh exit 0 (con Node 22)
- C2: [x] una sola tarea in_progress (144) · [x] done con evidencia (sin cambios de esta tarea) · [x] current.md describe la sesión activa
- C3: [x] capas · [x] sin tablas nuevas · [x] audit:tenant ≤ baseline · [x] sin RPC nueva · [x] sin dependencias nuevas · [x] sin prints ni TODOs
      (se quitó el TODO viejo de sugerenciasRubro.ts)
- C4: [x] verificar verde · [ ] test de lógica nueva: falta el de `rutaPermitidaConPruebaVencida` (M2) · [x] probado contra el sistema real (E2E) ·
      [ ] migración 144 sin aplicar en DEV ni en prod (144-29/30 en rojo)
- C5: [x] sin temporales nuevos (los cambios en `supabase/.temp/*` son previos y ajenos) · [ ] history.md sin entrada (la tarea sigue abierta) ·
      [x] estado in_progress correcto · [x] commits de respaldo · [ ] se tocó mobile y falta el build (current.md: "Requiere build"; app.json se sube al compilar)

## Cambios requeridos
1. (M1) Cerrar `/api/usuarios/me/vehiculo*` con la prueba vencida en backend/src/empresaOperativa.ts:42 y sumar un caso E2E negativo.
2. (M2) Crear `backend/src/empresaOperativa.test.ts` para `rutaPermitidaConPruebaVencida` con los bordes listados, y un E2E de
   `/api/portal/solicitar-codigo` con la prueba vencida (idealmente también `POST /reserva-publica/:id/reservar`).
3. Aplicar la migración 144 en DEV (la usuaria) y volver a correr la suite: 30/30.
4. Recomendado antes de prod: m1, m3, m6 y m8.
