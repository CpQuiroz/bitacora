# Auditoría de Resiliencia — Bitácora

> **Fecha:** 3-sep-2026 · **Alcance:** solo lectura. Puntos únicos de falla y manejo de
> errores en el código actual. No cubre la infra en sí (planes, backups, réplicas) —
> eso se verifica en los dashboards, ver la lista final.
>
> Complemento operativo: `docs/RUNBOOK_INCIDENTES.md`.
>
> **Estado (3-sep, post-auditoría):** aplicados **R1, R2, R3, R4, R5, R6** (R3: dedupe de
> notificaciones + idempotency-key en crear cobros, migración 77). Pendiente: **R7**
> (keep-warm) — deuda consciente. El texto de cada hallazgo describe el problema
> *original*.

---

## Resumen ejecutivo

El backend maneja **bien** los fallos de servicios externos donde importa: el correo
(Resend) reintenta y hace rollback del flujo si falla en producción; Flow propaga todo
error (hay dinero) y nunca confía en el body del webhook; WhatsApp, notificaciones y
registro de uso de IA nunca rompen el flujo principal. Hay un único punto de captura de
errores (`server.ts`) que loguea a `errores_backend` + Sentry.

Los huecos principales:

1. **El frontend web no maneja el arranque en frío de Render.** `web/src/lib/api.ts` es
   un `fetch` pelado — sin timeout, sin reintento, sin mensaje "el servidor está
   iniciando". La app móvil sí lo maneja; la web no.
2. **`/health` no verifica nada** — devuelve `{ok:true}` aunque Supabase esté caído. El
   monitoreo (keep-warm, uptime robots) da verde con la DB muerta.
3. **Operaciones no idempotentes.** Si una request se corta y el cliente reintenta:
   crear un cobro se **duplica**; una notificación al cliente se **reenvía**. Las
   liquidaciones sí son idempotentes (upsert).
4. **Llamadas a servicios externos sin timeout** (Resend, Flow, WhatsApp, Anthropic) —
   si el servicio cuelga, la request de Express cuelga con él.
5. **Sin handlers de proceso** (`unhandledRejection` / `uncaughtException`) — un throw
   async fuera de `ah()` puede tumbar el proceso Node (Render lo reinicia → ~1 min de
   caída + cold start).

---

## Parte 1 — Hallazgos

### R1 · El frontend web no maneja Render dormido/lento — **Media**

`web/src/lib/api.ts:6-25` — `apiFetch` es `return fetch(...)` sin `AbortSignal`, sin
reintento, sin backoff. Cada call site hace su propio `if (!res.ok)`.

Comparar con `mobile/src/services/api.ts`: reintenta 2× (esperas 2s/4s), timeout 15s→25s,
y distingue "sin internet" de "servidor tardando en iniciar".

**Impacto:** cuando Render está dormido (plan gratis, ~15 min sin tráfico → 30-60s para
despertar), un usuario del dashboard queda mirando un spinner hasta que el navegador
resuelva (~300s por defecto) o se rinda. Si la primera petición falla, no hay reintento
automático y el mensaje de error es genérico (lo que ponga cada pantalla).

**Mitigación que ya existe:** `.github/workflows/keep-warm.yml` (cron 10 min a `/health`)
hace que Render rara vez esté dormido en horario laboral — pero el cron de GitHub no es
exacto (puede atrasarse 10-20 min) y se desactiva tras 60 días sin actividad en el repo.

**Recomendación:** portar la lógica de `mobile/src/services/api.ts` a `web/src/lib/api.ts`
(timeout + 1-2 reintentos ante error de red/timeout/5xx + un toast "el servidor está
iniciando, esto puede tardar unos segundos").

---

### R2 · `/health` no chequea dependencias — **Media**

`backend/src/server.ts:98-100`:

```ts
app.get("/health", (_req, res) => {
  res.json({ ok: true });
});
```

Solo confirma que el proceso Node responde. Si Supabase está caído (DB/Auth/Storage),
`/health` sigue en 200 y **todo monitoreo externo da verde** mientras cada request real
devuelve 500.

**Aplicado:** `/health` sigue liviano (lo usa `keep-warm.yml` — no queremos que el cron
tumbe la DB con un select cada 10 min). Nuevo **`/health/ready`** hace un `select head`
contra Supabase con timeout 3s → **503 si la DB no responde**. Un uptime monitor externo
(UptimeRobot / Better Uptime / etc.) debe apuntar a **`/health/ready`**, no a `/health`.

---

### R3 · Operaciones no idempotentes — **Alta** (para cobros y notificaciones)

> **Estado:** aplicado para **cobros** (migración 77 + middleware `idempotente()` con
> header `Idempotency-Key` en `POST /api/cobros` y `/api/cobros/desde-trabajos`) y para
> **avisos al cliente** (`notificarCliente` deduplica por ventana de 120 min). El resto
> de la tabla de abajo (crear OS, cotización) **sigue sin idempotencia** — deuda
> consciente: el retry del `apiFetch` web quedó limitado a GET y los botones se
> deshabilitan mientras el request está en vuelo, así que el riesgo real baja a "doble
> click en la ventana de milisegundos antes de que el botón se deshabilite".
>
> **Cuando suba el volumen (2ª empresa, más cobros/OS por día):** aplicar el mismo
> `idempotente()` a `POST /api/trabajos` y `POST /api/presupuestos` — el middleware ya
> es genérico, es agregar una línea por ruta + generar la clave en el form.

Si Render se reinicia a mitad de un request y el cliente (web) reintenta, o el usuario
hace doble-click, o hay un retry de red:

| Operación | Archivo:línea | ¿Idempotente? | Efecto de un reintento |
|---|---|---|---|
| Crear cobro manual | `backend/src/routes/cobros.ts:141` | ❌ `.insert()` pelado | **Cobro duplicado** |
| Crear cobro desde viaje / agrupar en factura | `backend/src/routes/cobros.ts` (mismo patrón) | ❌ | Factura/cobro duplicado |
| Crear OS / trabajo | `backend/src/routes/trabajos.ts:410` | ❌ | Trabajo + OS duplicados (con folio nuevo) |
| Crear cotización | `backend/src/routes/presupuestos.ts` (mismo patrón) | ❌ | Cotización duplicada |
| Notificar al cliente (correo/WhatsApp) | `backend/src/notificarCliente.ts:219` | ❌ no consulta `notificaciones_cliente_log` antes de enviar | **Cliente recibe el correo/WhatsApp 2 veces** |
| Registrar pago de un cobro | `backend/src/routes/cobros.ts:221` (PATCH) | ⚠️ parcial — poner `estado='pagada'` dos veces es lo mismo, pero pisa `valor_recibido`/`observaciones_pago` | Bajo riesgo |
| Generar liquidaciones | `backend/src/routes/remuneraciones.ts` | ✅ `upsert onConflict (empresa_id, usuario_id, periodo)` | Sin efecto (recalcula) |
| Emitir liquidación | `backend/src/routes/remuneraciones.ts` | ✅ desde la auditoría de Remuneraciones — 409 si ya emitida | Sin efecto |
| Notificación interna (feed campana) | `backend/src/notificar.ts:24` | ❌ | Notificación duplicada en el feed (bajo impacto) |
| Cumpleaños del cliente | `backend/src/cumpleanosClientes.ts` | ✅ dedupe contra `notificaciones_cliente_log` (350 días) | Sin efecto |

**Recomendación (prioridad: cobros + notificarCliente):**
- Para escrituras que crean plata (cobros, facturas): aceptar un header
  `Idempotency-Key` (UUID que el frontend genera una vez por acción) y una tabla
  `idempotencia (key, empresa_id, respuesta, creado_en)` con TTL — el patrón estándar.
  O, más simple para el volumen actual: deshabilitar el botón en el frontend mientras la
  request está en vuelo (ya se hace en varias pantallas — auditar cuáles no) y aceptar
  el riesgo residual.
- Para `notificarCliente`: antes de enviar, consultar `notificaciones_cliente_log` por
  `(empresa_id, tipo, entidad_id, canal, exito=true)` en las últimas N horas y saltar si
  ya se mandó. Mismo criterio que ya usa el flujo de cumpleaños.

---

### R4 · Llamadas a servicios externos sin timeout — **Media**

| Servicio | Archivo:línea | Timeout | Si el servicio cuelga |
|---|---|---|---|
| mindicador.cl | `backend/src/remuneraciones/parametros.ts:44` | ✅ `AbortSignal.timeout(8000)` | Devuelve null → 503 claro |
| Resend | `backend/src/email.ts:51` | ❌ ninguno | El request de Express cuelga; reintenta 1× tras 1.5s pero sin cortar el intento colgado |
| Flow | `backend/src/flow.ts:56` | ❌ ninguno | Request colgado (hay dinero — el usuario espera) |
| WhatsApp / Meta Graph | `backend/src/whatsapp.ts:47,80,87` | ❌ ninguno | Request colgado, pero es no-throw así que al menos no rompe el flujo |
| Anthropic API | SDK (`backend/src/claude.ts`) | ✅ 120s por defecto; **240s** para los informes largos (`informe_*`, hasta ~2.5k tokens sobre un contexto grande) — ver `FEATURES_LARGAS` en `crearMensajeIA` | Antes: 10 min. Ahora corta pero con margen suficiente para un informe personalizado lento |
| Supabase (PostgREST) | `backend/src/supabase.ts` (`createClient` sin opciones) | Default del fetch de la plataforma | Request lento/colgado si Supabase está degradado |

Render (según su doc) corta requests que superan ~100s a nivel de load balancer, así que
"colgado para siempre" en la práctica es "colgado ~100s" — pero durante esos 100s la
conexión y el worker quedan ocupados, y con el plan gratis (recursos chicos) unas pocas
requests colgadas saturan el servicio.

**Recomendación:** envolver cada `fetch` externo con `AbortSignal.timeout()` (5-10s para
Resend/WhatsApp/mindicador; 15-20s para Flow; el SDK de Anthropic acepta
`{ timeout: ms }` en `claude.messages.create` o en el constructor — bajarlo a ~60s).

---

### R5 · Sin handlers de proceso — **Media**

`backend/src/server.ts` no registra `process.on("unhandledRejection")` ni
`process.on("uncaughtException")`. Todas las rutas async pasan por `ah()` (asyncHandler)
que canaliza al handler global — pero:
- Un `void algoAsync()` (fire-and-forget) que rechaza sin `.catch()` → unhandled
  rejection. Hay varios en el código (`void avisarCitaAgendada(...)`,
  `void revisarCumpleanosClientes(...)`, `void registrarUsoIA(...)`). Todos tienen
  try/catch interno hoy, pero es frágil: el día que alguien agregue uno sin catch, en
  Node 22 una unhandled rejection **termina el proceso** por defecto.
- Render reinicia el proceso (~30-60s) + cold start → downtime.

**Recomendación:** agregar en `server.ts`:

```ts
process.on("unhandledRejection", (e) => { console.error("unhandledRejection", e); Sentry.captureException(e); });
process.on("uncaughtException", (e) => { console.error("uncaughtException", e); Sentry.captureException(e); /* considerar exit(1) para que Render lo reinicie limpio */ });
```

---

### R6 · Observabilidad de errores — **Baja** (ya bastante cubierto)

`backend/src/server.ts:315-343` — handler global: los 5xx van a `console.error` +
`errores_backend` + Sentry (`Sentry.captureException`, con `extra.ruta`/`metodo`). Único
choke point, bien.

Huecos menores:
- El insert a `errores_backend` puede fallar en silencio (`if (error) console.error`).
  Si lo que está caído **es** Supabase, no se puede loguear que Supabase está caído — el
  único rastro queda en los logs de Render y en Sentry (cuando tenga DSN).
- Los 4xx no se loguean (por diseño). Pero algunos importan: el **503 de mindicador**
  (`remuneraciones.ts:54`) no queda registrado en ningún lado — si mindicador estuvo
  caído medio día y nadie pudo generar liquidaciones, no hay rastro.
- **No hay alerta push sobre `errores_backend`** — es una tabla que hay que ir a mirar
  en el Panel de Super-Admin. Sentry (cuando tenga DSN) es el único canal que avisa solo.
- Sentry en el backend **está en el código pero sin `SENTRY_DSN` configurado** → hoy es
  no-op. Configurarlo es lo de mayor retorno de esta lista (te enteras de un incendio
  por mail en vez de por un llamado del cliente).

---

### R7 · keep-warm.yml no es garantía dura — **Baja**

`.github/workflows/keep-warm.yml` — cron `*/10 * * * *`. El scheduler de GitHub Actions
puede atrasarse 10-20 min bajo carga, y **desactiva el workflow tras 60 días sin
actividad en el repo**. No es un reemplazo de un plan pago de Render; es una mitigación.

---

## Parte 2 — Puntos únicos de falla (riesgos conocidos, no a resolver ahora)

| # | SPOF | Qué se cae si falla | Mitigación hoy |
|---|---|---|---|
| S1 | **1 solo proyecto Supabase de prod** (`yjbskbskyadxjooxngjv`, región us-west-2), sin réplica de lectura. DB + Auth + Storage en el mismo proyecto. | **Todo.** Un incidente de Supabase = app caída. | Ninguna a nivel de arquitectura. Depende de los backups de Supabase (pendiente verificar que estén activos + probar restore). |
| S2 | **1 solo servicio Render**, plan gratis, sin instancia de respaldo, se duerme a los 15 min. | Backend caído = dashboard y app móvil no funcionan (el frontend carga pero toda acción falla). | keep-warm.yml (parcial). Migrar a plan pago elimina el sleep y da más recursos. |
| S3 | **1 solo proyecto Vercel**. | Frontend web no carga. | Vercel guarda los deploys anteriores → rollback instantáneo (ver runbook). |
| S4 | **Resend con 1 solo dominio verificado.** | Todo el correo transaccional. En **producción** un fallo de Resend hace **rollback** de: crear empresa (Super-Admin), invitar usuario, reset de contraseña, 2FA por correo. Los avisos al cliente (cotización, OS, cobro, cita) NO hacen rollback — se registran como fallidos en `notificaciones_cliente_log` y se pueden reintentar. | `email.ts` reintenta 1×. |
| S5 | **1 sola API key de Anthropic**, global (no por empresa). | Informe con IA, Asistente, análisis de fotos de OS, OCR de guías por WhatsApp. El resto de la app sigue igual. | Concurrencia limitada a 8; el SDK reintenta 429; `generarInformeOS` degrada a null. |
| S6 | **mindicador.cl** — API pública gratis, sin SLA. | Generar liquidaciones de un **período nuevo** ese día (si ya existe la fila del período, se usa esa). | Timeout 8s + 503 claro + carga manual de UF/UTM (desde la auditoría de Remuneraciones, con upsert). |
| S7 | **Cloudflare** (DNS + proxy de `app.transportesitineris.cl`). | Llegar a la app. | Ninguna (es infra de red). |
| S8 | **Flow** (sandbox hoy; prod pendiente). | Cobro/renovación de la suscripción B2B. **No** afecta el uso normal del dashboard, salvo que a una empresa le venza el trial ese día y no pueda pagar. | `flow.ts` propaga el error; el trial vencido bloquea la app hasta pagar (`empresas.plan`). |
| S9 | **GitHub** — deploys (Vercel/Render escuchan el repo) + cron keep-warm + workflow de chequeo de migraciones. | Si GitHub Actions está caído: el backend puede dormirse. Si GitHub entero está caído: no se puede deployar un fix. | Ninguna. Se puede forzar redeploy desde los dashboards de Vercel/Render sin GitHub. |
| S10 | **1 sola persona** (vos) para responder incidentes, sin guardia. | Cualquier incidente fuera de tu horario tiene el tiempo de respuesta que tengas disponible. | El runbook (`RUNBOOK_INCIDENTES.md`) — para no tener que pensar el procedimiento en el momento. |

---

## Lo que está bien (para no re-auditarlo)

- **`email.ts`** (`enviarConReintento`): reintenta 1× tras 1.5s, en producción **lanza**
  si falla o si no está configurado (nunca falla en silencio), y quien lo llama hace
  rollback del flujo. En dev escribe el correo en la consola.
- **`flow.ts`**: todas las funciones propagan el error (hay dinero). La confirmación de
  eventos **nunca confía en el body del POST** de Flow — llama de vuelta a la API de
  Flow firmando la petición para obtener el estado real (`consultarEstadoPago`).
- **`whatsapp.ts`**: deliberadamente no-throw — devuelve `{ ok, error }`. Un fallo de
  WhatsApp nunca rompe el flujo principal; se registra en `notificaciones_cliente_log`.
- **`claude.ts`**: limitador de concurrencia (8 simultáneas), el SDK reintenta ante 429,
  los rate limits se loguean explícitos en `errores_backend`, `generarInformeOS` degrada
  a `null` en vez de romper.
- **`notificar.ts` / `notificarCliente.ts` / `registrarUsoIA`**: try/catch total — una
  notificación que falla nunca rompe la operación que la disparó.
- **Handler global de errores** (`server.ts:315`): un solo choke point → `errores_backend`
  + Sentry, con la ruta y el método como contexto.
- **`liquidaciones/generar`**: idempotente vía upsert.
- **Cumpleaños del cliente**: dedupe contra `notificaciones_cliente_log` (350 días).
- **Migraciones**: el workflow `check-migraciones-prod.yml` falla el CI si hay una
  migración local sin aplicar en prod (existe por un incidente real de tracking
  desincronizado).

---

## Pendiente de verificación manual (no se puede confirmar desde el código)

- [ ] Supabase prod: **backups automáticos habilitados** + hacer **una prueba de restore**.
- [ ] Supabase prod: plan actual y qué garantías da (PITR, retención de backups).
- [ ] Render: plan actual (¿sigue en free?), health check path configurado en el
      dashboard, política de auto-deploy.
- [ ] Vercel: que el rollback a deploy anterior esté disponible (lo está por defecto).
- [ ] Cloudflare: TTL de los registros DNS (para saber cuánto tarda un cambio de
      emergencia en propagar).
- [ ] Sentry: crear proyecto y cargar `SENTRY_DSN` en Render (hoy el SDK está inerte).
- [ ] Resend: estado del dominio, límites de envío del plan.
