# Review — tarea 124 planes_4_categorias, ETAPA 3 (commit cad76d7)

**Veredicto:** APPROVED (APROBADO), con 2 correcciones recomendadas de severidad media que no bloquean (R1, R2) y observaciones menores.

Alcance: `git diff cad76d7~1 cad76d7` (16 archivos). Diseño: `progress/current.md`, secciones "Tarea 124 — REDISEÑO aprobado" y "Etapa 3".
La tarea 124 no tiene `acceptance` formal en `trabajo_list.json`; los criterios de abajo salen del diseño de la etapa 3.

## Criterios de aceptación (diseño de la etapa 3)
- [x] Solo el Admin con `gestionar_plan` usa /api/modulos → `backend/src/routes/modulos.ts:21` (`modulosRouter.use(requiereAccion("gestionar_plan"))`); E2E G2 supervisor → 403 (`scratchpad/qa/pruebas-etapa3.ts:36-37`).
- [x] La empresa solo toca secciones que cuentan (ni IA ni base) → `modulos.ts:45` (`cuentaParaTope`, lista exacta `MODULOS_CONTABLES`, `packages/shared/src/planes.ts:51-56`); E2E G3/G4 → 400 (`pruebas-etapa3.ts:38-41`).
- [x] Tope aplicado en la base sin carreras → migración 133 `:37` (`select ... for update` sobre `empresas`) + conteo `:50-55`; E2E G6 403 LIMITE_PLAN y G7 con 3 activaciones simultáneas y 1 cupo, entra 1 (`pruebas-etapa3.ts:47-56`).
- [x] El menú se actualiza sin recargar → `web/src/lib/eventosModulos.ts:4-8`, listener con limpieza en `web/src/components/DashboardShell.tsx` (efecto de `/api/me`); `/api/me` lo refleja: E2E G8.
- [x] "Solicitar más módulos" manda un correo a los Super-Admin → `modulos.ts:57-95` + `backend/src/avisosSuperAdmin.ts:24-33`; E2E G9 201 y G10 400.
- [x] Con la prueba vencida /api/modulos queda abierto y el resto no → `backend/src/empresa.ts:75-77`; E2E G11 (`pruebas-etapa3.ts:67-72`).
- [x] El Super-Admin usa la misma RPC → `backend/src/superadmin/routes.ts` PATCH `/empresas/:id/modulos` → `cambiarModuloEmpresa`; regresión 43/43 (`pruebas-e2e.ts:146-160`, E3-E11).
- [x] La tarjeta de Plan manda a Módulos → `web/src/app/dashboard/configuracion/plan/page.tsx` (Link "Apaga N en Módulos").

## Foco 1 — Seguridad de la RPC (migración 133)
- [x] `set search_path = public` (`133:32`). security invoker (por defecto) y solo service_role, así que el search_path no abre nada.
- [x] Grants: `revoke ... from public, anon, authenticated` (`133:71`) + `grant ... to service_role` (`133:72`). **Lo verifiqué contra DEV**: `POST /rest/v1/rpc/cambiar_modulo_empresa` con la anon key → `42501 permission denied for function cambiar_modulo_empresa` (HTTP 401).
- [x] Otra empresa: solo la llama el backend. La ruta de la empresa pasa `req.empresaId!` (lo resuelve `requiereEmpresa`, no el body). El Super-Admin valida que la empresa exista antes de llamarla.
- [x] Módulos fuera de lo permitido: la empresa, filtrada en `modulos.ts:45`. El Super-Admin, por `MODULOS.includes` (lista cerrada). Los módulos no contables no pasan por el chequeo de tope (`133:49`, `p_modulo = any(p_contables)`), y así debe ser.
- [x] El bloqueo funciona: el `FOR UPDATE` sobre la fila de `empresas` ordena las llamadas de una misma empresa, y el conteo se hace después de tomar el bloqueo. G7 lo demuestra.
- [x] Idempotencia: `create or replace` + revoke/grant se pueden volver a correr. No crea tablas (no hace falta RLS nueva). Es aditiva.
- [x] RPC declarada en `Database.Functions` → `packages/shared/src/types.ts:2090-2100`.
- [ ] (menor, no bloquea) **O1** — El tope se calcula fuera del bloqueo: `backend/src/limites.ts:207` lee el plan con `obtenerPlan` antes de la RPC y lo pasa como `p_tope`. Escenario: el Super-Admin baja la empresa a Esencial (`verificarModulosCabenEnPlan` cuenta sin bloqueo y después hace el update) mientras el Admin activa un módulo con el tope viejo. La empresa puede quedar sobre el tope nuevo. La ventana es de milisegundos y el daño es acotado (se corrige apagando módulos), pero la RPC podría leer `empresas.plan` bajo el bloqueo y recibir el mapa plan→tope.
- [ ] (menor) **O2** — `raise exception 'TOPE_MODULOS'` (`133:54`) usa el SQLSTATE genérico P0001 y el backend lo reconoce buscando el texto (`limites.ts:218`). Funciona. Sería más robusto un `using errcode = '...'` propio.

## Foco 2 — /api/modulos
- [x] Autorización: `requiereAccion` en `modulos.ts:21`, que corre antes del rate limit y de todos los handlers (también de /solicitar).
- [x] Multi-tenant: todo usa `req.empresaId!`. `empresas` se filtra por `id = req.empresaId` (`modulos.ts:70`). `audit:tenant` = 0 hallazgos.
- [x] Validación: `modulo` es string y está en la lista cerrada, `activado` es boolean (`:45`). `modulos[]` se filtra con la misma lista (`:61-63`). `mensaje` se recorta a 2000 caracteres (`:64`). Si viene vacío → 400.
- [x] Escape del HTML: todo lo que escribe el usuario pasa por `escaparHtml` (`modulos.ts:81-85`; la función está en `avisosSuperAdmin.ts:10-12` y cubre `& < > " '`). El salto de línea se convierte a `<br>` después de escapar. El asunto va en texto plano por la API de Resend (sin riesgo de inyección de cabeceras).
- [x] Errores: 400/403/201. El 502 cuando falla el correo es un código de fallo controlado, no un 200 con `{error}`. `SinSuperAdminsError` → 503 en cotizar. En /solicitar cae en el catch → 502 (aceptable).
- [ ] (media, recomendada) **R1** — El rate limit de /solicitar se puede saltar. `limitarSolicitudesSuperAdmin` (`backend/src/rateLimiters.ts:59-66`) usa la clave por defecto (IP), y `server.ts:95` tiene `app.set("trust proxy", true)`. Cualquiera falsea `X-Forwarded-For` y cada pedido cuenta como una IP nueva. Un Admin malicioso o con la cuenta comprometida puede mandar correos sin límite a todos los Super-Admin. La causa (trust proxy) viene de antes y ya está anotada en `current.md`, pero esta etapa suma un endpoint nuevo que manda correos y descansa en ese límite. Además, al ser una sola instancia, el contador es compartido entre /solicitar y /plan/cotizar-empresa, y varias empresas detrás de un mismo NAT comparten 3 por hora. Arreglo sugerido: `keyGenerator: (req) => req.empresaId ?? req.ip` (o userId) en este limitador.

## Foco 3 — Prueba vencida e impersonación
- [x] Impersonación: `empresa.ts:27` bloquea PATCH/POST en `/api/modulos*` cuando es sesión de impersonación. El GET sigue permitido (solo lectura).
- [x] Prueba vencida: deja pasar GET/PATCH/POST de `/api/modulos` (`empresa.ts:75-76`). La prueba tiene `modulosMax: null`, así que puede prender módulos, pero no los puede usar porque el resto de la API sigue bloqueado. No hay escalada.
- [ ] (media, preexistente, recomendada) **R2** — El prefijo `startsWith("/api/plan")` en `empresa.ts:76` (la misma línea que tocó esta etapa) también calza con **`/api/plantillas`** (`server.ts:356`) y **`/api/planes-mantencion`** (`server.ts:375`). Por eso una empresa con la prueba vencida sigue usando Plantillas y Planes de mantención, y esto se salta el cobro. Por el mismo prefijo, `empresa.ts:26` bloquea las mutaciones de esas dos rutas durante la impersonación (bloquea de más). No lo introdujo la etapa 3, que agregó `/api/modulos` con el mismo patrón (hoy sin colisiones). Sugerido: comparar contra `ruta === "/api/plan" || ruta.startsWith("/api/plan/")` (igual para `/api/modulos` y `/api/suscripcion`).

## Foco 4 — Web
- [x] Hooks antes de cualquier return: todos los `useState`/`useCallback`/`useEffect` y `useConfiguracion` están en `modulos/page.tsx:26-49`; el primer return condicional está en `:80`. El lint de hooks pasa.
- [x] Manejo de errores: `apiFetch` nunca lanza (`web/src/lib/api.ts:115-122` devuelve una respuesta de error sintética), así que `guardando`/`enviando` no quedan pegados. Los errores se muestran (`:167`, `:178`) y el 403 del supervisor sale como texto.
- [x] Refresco del menú: evento `bitacora:modulos-cambiados` con `removeEventListener` en el cleanup. Además el layout `recargar()`. Son dos `/api/me` por cambio: redundante pero inocuo.
- [x] Sin `supabase.from` en web. Sin colores literales (check-colores en el baseline).
- [ ] (menor) **O3** — Accesibilidad: el motivo del bloqueo solo está en `title` (`page.tsx:195`), que no se anuncia bien. Los mensajes de error no tienen `role="alert"`. El botón "Solicitar más módulos" (`:123`) no tiene `aria-expanded`. El `<label>` que envuelve el checkbox sí está bien.
- [ ] (menor) **O4** — En `configuracion/layout.tsx:25`, "Módulos" (igual que "Plan", como ya pasaba) aparece para cualquier rol con el módulo `configuracion`. Un supervisor sin `gestionar_plan` ve el link y cae en "No tienes permiso…". No es una falla de seguridad; es UX.

## Foco 5 — Regresiones
- [x] El PATCH del Super-Admin ahora pasa por la RPC: mantiene la validación de `modulo`, el 404 y la auditoría. El tope da 403 LIMITE_PLAN como antes. Cubierto por la regresión 43/43.
- [x] `cotizar-empresa` refactorizado a `avisarSuperAdmins`, sin cambio de comportamiento (se mantienen el 503 sin destinatarios y el 502 si falla Resend). Se agregó `.limit(50)` a la lectura de super_admins.
- [x] Materializar filas por defecto en la RPC (`133:44-47`) es inocuo: `cambiarPlanEmpresa` ya no prende ni apaga módulos (`backend/src/planes.ts:28-57`) y usa el mismo default que `moduloActivadoPorDefecto`.
- [ ] (menor) **O5** — Un error inesperado de la RPC sale al usuario como 500 con el mensaje crudo de Postgres (`limites.ts:223`, a través del handler global de `server.ts:443-475`). Ya pasaba antes en el resto del backend. No es nuevo.

## Arquitectura / Convenciones / Verificación
- [x] Capas: web → /api → backend → Supabase. No se agregan capas.
- [x] Multi-tenant: sin tablas nuevas. `empresa_modulos` ya está en `TABLAS_POR_EMPRESA` y tiene RLS (migración 73).
- [x] Migración 133: correlativa, aditiva, con su nombre. En `current.md` quedan los pasos para prod (132 y 133 con `db query` + `migration repair`).
- [x] Comentarios en español que explican el porqué. Sin `any`, sin debug prints (`console.error` en el catch sigue el patrón de plan.ts).
- [~] Tests: no hay tests unitarios versionados de la lógica nueva. La lógica está en SQL (RPC) y se probó E2E contra DEV (11/11 + 43/43), pero los scripts viven en el scratchpad y no en el repo. `escaparHtml` no tiene test. Recomendado: un `avisosSuperAdmin.test.ts` con los 5 caracteres (backend ya corre `tsx --test`, 7 tests).
- [x] `./verificar.sh` completo → EXIT 0 (tsc x4 + mobile, shared 39, design-tokens 5, backend 7, eslint, hooks, audit:tenant 0, colores 3 = baseline, migraciones 133 = 133). Log en el scratchpad `verif_e3.log`.

## CHECKPOINTS
- C1: [x] arnés completo; verificar.sh exit 0.
- C2: [x] una sola tarea `in_progress` (124); current.md describe la sesión activa. [x] nada nuevo en `done` sin evidencia.
- C3: [x] capas, [x] sin tablas nuevas, [x] audit:tenant 0, [x] RPC en `Database.Functions`, [x] sin dependencias nuevas, [x] sin debug/TODO.
- C4: [x] verificar verde; [~] lógica nueva probada E2E contra DEV pero sin test versionado (ver arriba); [x] API/UI contra el sistema real; [ ] **migración 133 (y 132) aún no aplicada en prod.** Es correcto que la tarea siga `in_progress`: no mergear a main hasta que la usuaria la aplique (lo dice `current.md`).
- C5: [x] no hay basura en el repo (solo `supabase/.temp/*`, modificado desde antes y fuera del commit); [x] commit de respaldo cad76d7; [ ] history.md sin entrada de cierre (normal: la tarea no está cerrada, falta la etapa 4); [x] mobile no se tocó.

## Cambios requeridos
Ninguno bloqueante para la etapa 3. Recomendados antes del merge a main (media):
1. **R1** — `backend/src/rateLimiters.ts:59`: agregar `keyGenerator` por `empresaId`/`userId` a `limitarSolicitudesSuperAdmin` (hoy se salta falseando X-Forwarded-For por `server.ts:95`).
2. **R2** — `backend/src/empresa.ts:26` y `:76`: comparar prefijos con límite de segmento (`=== "/api/plan" || startsWith("/api/plan/")`). Hoy la prueba vencida no bloquea `/api/plantillas` ni `/api/planes-mantencion` (preexistente).
Opcionales: O1 (tope leído bajo el bloqueo), O2 (errcode propio), O3 (a11y), O4 (ocultar "Módulos" sin `gestionar_plan`), test de `escaparHtml`.
