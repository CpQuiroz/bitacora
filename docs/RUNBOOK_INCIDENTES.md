# Runbook de Incidentes — Bitácora

> Para un equipo de **una persona**, sin guardia 24/7. Pensado para dejar de improvisar
> el procedimiento en el momento del incendio.
>
> Contexto de infra: `docs/PUESTA_EN_PRODUCCION.md` · Riesgos conocidos:
> `docs/AUDITORIA_RESILIENCIA.md`.

---

## Cómo usar esto

1. **Clasificá la severidad** (tabla abajo) — define cuándo tenés que actuar.
2. Andá al escenario del componente afectado.
3. Si es SEV1/SEV2 → cuando pase, escribí un postmortem (`docs/plantilla-postmortem.md`).

### Severidad (equipo de 1, sin guardia)

| Nivel | Criterio | Tiempo de respuesta |
|---|---|---|
| **SEV1** | App completa caída para todas las empresas | Apenas te enterás, sin importar la hora |
| **SEV2** | Una función clave caída para todos (login, crear/cerrar OS, facturación, generar liquidaciones) | Mismo día hábil |
| **SEV3** | Degradación parcial, o afecta a una sola empresa | Próximos 1-2 días hábiles |
| **SEV4** | Cosmético o de bajo impacto | Cuando puedas |

### Datos fijos

| | |
|---|---|
| App | `https://app.transportesitineris.cl` |
| Backend | `https://bitacora-cgt7.onrender.com` (`/health` → `{"ok":true}` si el proceso vive) |
| Supabase prod | proyecto `yjbskbskyadxjooxngjv`, región us-west-2 |
| Supabase dev | proyecto `pruwvpnlvrvgtmpetlsr` |
| Repo | `github.com/CpQuiroz/bitacora`, deploy automático por push a `main` |
| **Único cliente en prod** | **Transportes Itineris** — su contacto (admin de la empresa): _[completar: nombre + canal, ej. WhatsApp/correo]_ |

> No hay equipo de soporte. "Escalar" acá significa **avisarle al contacto de Transportes
> Itineris** que hay un problema y un ETA, para que no descubran ellos que algo no anda.

### Status pages (revisá primero si el problema puede ser del proveedor)

- Render: <https://status.render.com>
- Vercel: <https://www.vercel-status.com>
- Supabase: <https://status.supabase.com>
- Cloudflare: <https://www.cloudflarestatus.com>
- Resend: <https://resend-status.com>
- Anthropic: <https://status.anthropic.com>
- EAS/Expo (builds móviles): <https://status.expo.dev>

### Chequeo rápido de "¿qué capa está caída?"

```bash
# 1. ¿El backend responde?
curl -s -o /dev/null -w "%{http_code} %{time_total}s\n" https://bitacora-cgt7.onrender.com/health
#   200 rápido        → backend OK
#   200 tras 30-60s   → cold start (Render dormido), NO es incidente — ver escenario Render
#   000 / timeout     → backend caído

# 2. ¿La web carga?
curl -s -o /dev/null -w "%{http_code}\n" https://app.transportesitineris.cl
#   200 → Vercel + Cloudflare OK
#   otro / timeout → ver escenario Vercel o Cloudflare

# 3. ¿Login funciona? (prueba el path de Auth de Supabase)
curl -s -o /dev/null -w "%{http_code}\n" https://bitacora-cgt7.onrender.com/api/me
#   401 → backend + su conexión a Supabase Auth OK (401 = "falta token", esperado)
#   500 → el backend no puede hablar con Supabase → ver escenario Supabase
```

---

## Escenario: Render (backend) caído o muy lento

**Cómo detectarlo:**
- Reporte de usuario: "la app no guarda / se queda cargando".
- `curl .../health` → timeout, o tarda 30-60s.
- Dashboard de Render (`dashboard.render.com` → servicio `bitacora`): estado del servicio,
  gráfico de CPU/memoria, pestaña **Logs**, pestaña **Events** (deploys, restarts, OOM).

**Primero: ¿es cold start normal o caída real?**
- `curl .../health` **dos veces seguidas**. Si la 1ª tarda ~40s y la 2ª responde al toque
  → era **cold start** (plan gratis, se durmió a los 15 min). **No es incidente.** Como
  mucho, SEV4. La app móvil ya reintenta sola; la web no (ver `AUDITORIA_RESILIENCIA.md`
  R1). Si molesta seguido → subir Render a plan pago.
- Si sigue sin responder tras 2-3 intentos y ~2 min → **caída real**.

**Impacto:** SEV1 si no responde nada. El frontend web **carga** (es Vercel) pero toda
acción falla (login, listar, guardar). La app móvil muestra "sin conexión / servidor
tardando". El Portal de Cliente también depende del backend.

**Primeros pasos:**
1. Render status page — si hay incidente de Render, es esperar. Avisá al contacto (SEV1).
2. Render → servicio → **Logs**. Buscá:
   - `unhandledRejection` / `uncaughtException` / stack trace repetido → bug que tumba
     el proceso. Ver **Events** si hay un loop de restarts.
   - `Out of memory` / el proceso muere sin log → OOM (plan gratis tiene poca RAM).
   - `EAS_...` no aplica; `ECONNREFUSED` / `getaddrinfo` a `supabase.co` → el problema
     es Supabase, no Render (ir a ese escenario).
3. **Forzar redeploy:** Render → servicio → **Manual Deploy** → "Deploy latest commit"
   (o "Clear build cache & deploy" si sospechás del build). Tarda ~3-5 min.
4. Si un deploy reciente rompió algo: Render → **Events** → encontrá el deploy anterior
   que funcionaba → "Rollback to this deploy". O en git: revertir el commit y push.
5. Si es OOM recurrente sin causa clara: subir el plan de Render (el free tier es el
   sospechoso #1 de OOM).

**Cuándo escalar:** avisar al contacto de Transportes Itineris apenas confirmes que es
caída real (no cold start). Si el downtime va a superar ~30 min, decilo con un ETA.

**Vuelta a la normalidad:**
- `curl .../health` → 200 rápido, dos veces.
- Login en `app.transportesitineris.cl` con una cuenta real.
- Crear y guardar algo trivial (una nota, un cliente).
- Revisá `errores_backend` en el Panel de Super-Admin por si quedó cola de errores.

---

## Escenario: Vercel (frontend) con deploy roto

**Cómo detectarlo:**
- La web tira error de build, pantalla en blanco, o "Application error".
- Justo después de un push a `main`.
- Vercel dashboard → proyecto → **Deployments**: el último marcado con error, o "Ready"
  pero la app no anda.

**Impacto:** SEV1/SEV2 — nadie puede usar el dashboard. El **backend y la app móvil
siguen funcionando** (la móvil no depende de Vercel). El Portal de Cliente vive en el
mismo Next.js → también caído.

**Primeros pasos:**
1. Vercel status page — descartá incidente de Vercel.
2. Vercel → **Deployments** → encontrá el último deploy **"Ready"** que funcionaba →
   menú `···` → **"Promote to Production"** (rollback instantáneo, sin rebuild).
3. En paralelo, arreglá la causa: `git revert <commit>` + push, o corregí y push.
   Vercel redeploya solo.
4. Si el build falla por `packages/shared` sin compilar: revisar `web/vercel.json`
   (compila shared antes de `next build`) y que `packages/shared/dist` no esté en el repo
   desactualizado.

**Cuándo escalar:** si el rollback no resuelve en ~15 min, avisá al contacto.

**Vuelta a la normalidad:** la web carga, login OK, una navegación por 2-3 pantallas del
dashboard sin errores en la consola del navegador.

---

## Escenario: Supabase (DB / Auth / Storage) con incidente

Supabase son **tres cosas en un proyecto**. El impacto depende de cuál falle:

| Pieza caída | Qué se cae | Qué sigue |
|---|---|---|
| **DB (Postgres / PostgREST)** | **Todo** — cada request del backend hace queries. `errores_backend` también cae (no se puede loguear). | Nada útil. SEV1. |
| **Auth** | Login nuevo, refresh de sesión, invitaciones, reset de contraseña, 2FA. | Sesiones ya activas siguen un rato (hasta que expire el JWT, ~1h) si no necesitan refresh. SEV2. |
| **Storage (S3)** | Subir/ver fotos de OS, PDFs (OS, cotización, liquidación), logos. | El resto del dashboard funciona. SEV3. |

**Cómo detectarlo:**
- Supabase status page (primero).
- `curl .../api/me` → 500 (el backend no puede hablar con la DB).
- Render logs → `getaddrinfo` / `ECONNREFUSED` / `timeout` hacia `*.supabase.co`, o
  errores de PostgREST (`57014` statement timeout, `08006` connection failure).
- Panel de Super-Admin no carga métricas.

**Primeros pasos:**
1. Supabase status page. Si hay incidente confirmado → **es esperar**, no hay nada que
   deployar. Avisá al contacto (SEV1/SEV2 según la pieza).
2. Si NO hay incidente de Supabase pero el backend no conecta:
   - Supabase dashboard → proyecto prod → **Database** → ¿está "Paused"? (proyectos
     free se pausan por inactividad — el de prod **no debería** estar en free, verificar).
     Si está pausado: "Restore project".
   - **Reports** → conexiones: ¿pool agotado? (demasiadas conexiones abiertas). Reiniciar
     el backend en Render libera su pool.
   - **Logs** (Postgres logs) → statement timeouts, deadlocks, disco lleno.
3. Si es disco lleno / DB corrupta / borrado accidental → **restore desde backup**:
   Supabase dashboard → **Database** → **Backups** → elegí el punto → Restore.
   ⚠️ **Verificar antes de un incidente que los backups estén activos** (pendiente en
   `AUDITORIA_RESILIENCIA.md`). Un restore pierde lo escrito desde el último backup.

**Cuándo escalar:** SEV1 (DB) → avisar al contacto de inmediato con ETA "depende de
Supabase". SEV2 (Auth) → avisar, aclarando que quien ya está adentro puede seguir un rato.

**Vuelta a la normalidad:**
- `curl .../api/me` → 401.
- Login nuevo funciona (prueba Auth).
- Abrir una OS con fotos + descargar su PDF (prueba Storage).
- `errores_backend` en el Panel — revisar la cola acumulada durante el incidente.

---

## Escenario: Cloudflare / DNS con problema

**Cómo detectarlo:**
- `app.transportesitineris.cl` no resuelve, o da error 5xx de Cloudflare (páginas con el
  logo naranja: 521 origin down, 522 timeout, 523 unreachable, 1xxx).
- `curl` al dominio falla pero `curl` directo a `bitacora-cgt7.onrender.com` y a la URL
  `.vercel.app` del proyecto **sí** funcionan → el problema está en la capa Cloudflare/DNS.

**¿Es DNS o es el origen?**
```bash
dig app.transportesitineris.cl +short        # ¿resuelve? ¿a las IPs de Cloudflare?
curl -s -o /dev/null -w "%{http_code}\n" https://<proyecto>.vercel.app   # ¿el origen Vercel responde directo?
```
- No resuelve → problema DNS (Cloudflare DNS o el registrador del dominio).
- Resuelve pero 52x → Cloudflare no llega al origen (Vercel) — casi siempre incidente de
  Cloudflare o de Vercel, no configuración.

**Impacto:** SEV1 — nadie llega a la web. La **app móvil sigue funcionando** (habla
directo con `bitacora-cgt7.onrender.com`, que es un dominio de Render, no pasa por
Cloudflare).

**Primeros pasos:**
1. Cloudflare status page + Vercel status page.
2. Cloudflare dashboard → dominio → **DNS**: que el registro de `app` siga apuntando a
   Vercel y esté "Proxied" (o "DNS only" si el proxy es el problema — probar togglear).
3. Cloudflare → **Overview**: ¿"Under Attack Mode" activado por error? ¿alguna regla de
   WAF nueva bloqueando todo?
4. Emergencia extrema: en Cloudflare DNS, poner el registro en **"DNS only"** (nube gris)
   para sacar el proxy de Cloudflare del camino y pegar directo a Vercel. Propaga según
   el TTL (verificar TTL — pendiente en la auditoría).

**Cuándo escalar:** SEV1 → avisar al contacto; aclarar que la app móvil sí anda.

**Vuelta a la normalidad:** `curl https://app.transportesitineris.cl` → 200; login OK.

---

## Escenario: Resend caído o rechazando envíos

**Cómo detectarlo:**
- Resend status page.
- Reporte: "no me llegó el correo de invitación / de recuperar contraseña".
- `errores_backend` con mensajes tipo `No se pudo mandar ... tras reintentar: Resend
  respondió 4xx/5xx`.
- Resend dashboard → **Emails**: envíos con estado `bounced` / `failed`, o el dominio en
  estado degradado / suspendido.

**Impacto (clave — leer bien):**
En **producción**, si Resend falla, `email.ts` **lanza** y el flujo que lo disparó hace
**rollback**. Es decir, un fallo de Resend **bloquea estas acciones** (no se completan):

| Acción bloqueada | Dónde |
|---|---|
| Crear una empresa nueva desde el Panel de Super-Admin | manda el correo de alta al admin |
| Invitar un usuario a una empresa | manda el correo de invitación |
| Restablecer la contraseña de un usuario (Super-Admin) | manda la clave temporal |
| 2FA por correo (segundo paso del login, si el usuario usa ese método) | manda el código |

**NO se bloquea** (se registra como fallido en `notificaciones_cliente_log`, reintentable):
avisos al cliente — cotización enviada, técnico en camino, OS completada, cobro
pendiente/vencido, cita agendada, cumpleaños. Y la encuesta de satisfacción (se omite).

Severidad: **SEV2** si cae del todo (login con 2FA-por-correo y onboarding bloqueados);
**SEV3** si solo rebota algunos.

**Primeros pasos:**
1. Resend status page. Si es incidente de ellos → esperar; avisá si alguien necesita
   invitar/resetear justo ahora (workaround: hacerlo cuando vuelva).
2. Resend dashboard → **Domains**: ¿el dominio sigue verificado? ¿reputación OK? ¿algún
   registro DNS (SPF/DKIM/DMARC) se cayó? Re-verificar si hace falta.
3. Resend → **API Keys**: ¿la key sigue activa? (¿se rotó y no se actualizó en Render?).
   Cargar la nueva en Render → variable `RESEND_API_KEY` → redeploy.
4. Si un usuario está trabado sin poder entrar por 2FA-por-correo: el Super-Admin puede
   regenerar/desactivar su 2FA desde la ficha de la empresa (Panel → Equipo).

**Cuándo escalar:** solo si alguien de Transportes Itineris quedó sin poder entrar.

**Vuelta a la normalidad:** invitar un usuario de prueba a una empresa de test y
confirmar que llega el correo. Revisar `notificaciones_cliente_log` por avisos fallidos
que convenga reintentar.

---

## Escenario: Flow (suscripción B2B) con incidente

**Cómo detectarlo:**
- Reporte: "no puedo registrar mi tarjeta / cambiar de plan".
- `errores_backend` con `Flow (...) respondió 5xx` o `algo no-JSON`.
- Flow no tiene status page pública confiable — probar `curl https://www.flow.cl/api` /
  el panel de Flow.

**Impacto:** **SEV3.** Afecta solo: registrar tarjeta, cambiar de plan, cobro recurrente
mensual, cancelar suscripción. **El uso normal del dashboard NO se afecta** — salvo el
caso puntual de una empresa a la que le **vence el trial ese día** y no puede pagar para
desbloquear (`empresas.plan` sigue en `'trial'`, la app se bloquea salvo `/api/plan*`).

> Hoy Flow está en **sandbox**, no en producción — este escenario aplica recién cuando se
> active el cobro real.

**Primeros pasos:**
1. Confirmar que es Flow y no nuestro código (`errores_backend` lo dice: el error viene
   con `Flow (ruta) respondió ...`).
2. Si hay una empresa bloqueada por trial vencido durante el incidente: extender el
   trial a mano en la DB (`empresas` / `suscripciones`, campo de fecha de trial) o
   cambiarle el plan a `basico` temporalmente desde el Panel, y avisar.
3. Cuando Flow vuelva: los cobros recurrentes que Flow no pudo procesar, él los reintenta
   por su cuenta (es una suscripción del lado de Flow). Verificar `suscripcion_cobros`.

**Cuándo escalar:** solo a la empresa afectada, si quedó bloqueada.

**Vuelta a la normalidad:** en una empresa de test, entrar a Configuración → Plan y
confirmar que la pantalla carga el estado de la suscripción sin error.

---

## Escenario: Anthropic API con incidente

**Cómo detectarlo:**
- Anthropic status page.
- Reporte: "el Asistente no responde" / "no se genera el informe con IA".
- `errores_backend` con `claude:<feature>` y "Rate limit (429)" o errores 5xx del SDK.

**Impacto:** **SEV3.** Dejan de funcionar: **Informe con IA**, **Asistente**
conversacional, **análisis de fotos** de una OS (la foto se sube igual, solo no se
analiza), **OCR de guías** por WhatsApp (la foto se guarda igual, sin extraer datos).
**Todo el resto de la app funciona sin degradarse** — las features de IA son aditivas,
no están en el camino crítico de crear/cerrar una OS, facturar, etc.

**Primeros pasos:**
1. Anthropic status page. Si es incidente de ellos → esperar; no hay nada que deployar.
2. Si NO es incidente pero falla: revisar en el Panel de Super-Admin el consumo de IA de
   la cuenta — ¿se agotó el crédito / se topó el límite de la organización? Recargar
   crédito o subir el límite en `console.anthropic.com`.
3. Si es solo 429 (rate limit) bajo un pico puntual: se resuelve solo; el limitador de
   concurrencia (8) y el retry del SDK amortiguan. Ver si conviene bajar la concurrencia.

**Cuándo escalar:** normalmente no hace falta avisar — el impacto es acotado. Si el
Asistente es algo que Transportes Itineris usa a diario, un aviso corto ("las funciones
de IA están intermitentes por un problema del proveedor").

**Vuelta a la normalidad:** abrir el Asistente y hacer una pregunta simple; generar un
informe libre de prueba.

---

## Escenario: mindicador.cl caído

**Cómo detectarlo:**
- Al generar liquidaciones de un período nuevo: 503 "No se pudo obtener UF/UTM
  (mindicador.cl no responde)".
- `curl https://mindicador.cl/api` → error / timeout.

**Impacto:** **SEV3/SEV4.** Solo afecta **generar liquidaciones de un período que
todavía no tiene su fila de parámetros**. Si el período ya se generó alguna vez (existe
la fila en `parametros_previsionales`), no se llama a mindicador y todo funciona. El
resto de la app, nada.

**Primeros pasos:**
1. ¿Es urgente generar la nómina hoy? Si no → esperar a que mindicador vuelva (suele ser
   horas).
2. Si es urgente: **cargar UF y UTM a mano.** En Configuración → Remuneraciones →
   Parámetros, con el período seleccionado, ingresar la UF (del último día del mes, de
   `sii.cl` o `bcentral.cl`) y la UTM del mes. Eso crea la fila (upsert) con el resto de
   los valores del seed, y ya se puede generar.
3. Verificar después que la UF/UTM cargadas a mano correspondan al mes correcto (no al
   día en que las cargaste).

**Cuándo escalar:** no hace falta — es un tema interno de nómina, no afecta al cliente.

**Vuelta a la normalidad:** generar las liquidaciones del período sin el 503.

---

## Postmortem — cuándo escribir uno

**Solo para SEV1 y SEV2.** Un SEV3/SEV4 no lo amerita (una línea en un TODO alcanza).

Usá `docs/plantilla-postmortem.md`. Escribilo **dentro de las 48h** mientras el timeline
está fresco. Objetivo: que el mismo incidente no te agarre dos veces igual.

Contenido mínimo:
- **Timeline** (hora a hora: detección → diagnóstico → mitigación → resolución).
- **Root cause** (la causa real, no el síntoma) + **5 whys**.
- **Impacto** (cuánto downtime, qué empresas, qué se perdió).
- **Qué funcionó / qué faltó** en la respuesta.
- **Action items** con responsable (vos) y fecha — que entren a la lista de trabajo real,
  no que queden en el doc.
