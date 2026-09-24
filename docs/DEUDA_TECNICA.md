# Deuda técnica

Listado de lo que se decidió postergar a propósito. Cada ítem tiene su
tarea en `trabajo_list.json` (estado `pending`); al resolverlo, marcar la
tarea `done` y sacarlo de esta lista.

| # | Tarea | Por qué importa | Cuándo conviene hacerlo |
|---|---|---|---|
| 111 | Proteger la rama `main` en GitHub (y evaluar repo privado) | `main` es lo que se despliega a prod (Vercel + Render). Hoy se puede borrar o hacer force-push sin freno. | Antes de sumar colaboradores o clientes pagados. |
| 121 | Paginación real ("Cargar más" + búsqueda en el servidor) en OS, clientes, cobros, cotizaciones y gastos | Hoy la web busca y filtra sobre la lista completa; con miles de registros se vuelve lenta. La etapa A (tarea 120) ya evita que se corten datos. | Cuando un cliente pase de algunos miles de registros en una lista. |
| 127 | Pruebas de regresión de flujos críticos (abrir y crear OS, cambio de plan) en web y mobile | En sept-2026 un error de hooks cerró la app al abrir una OS (tarea 119) y llegó a los teléfonos: hoy `verificar.sh` revisa tipos, lint y tests de lógica, pero no renderiza pantallas ni recorre flujos. | Antes del próximo build mobile grande o del onboarding de clientes pagados. |
| 115 | Mover el backend de Render de Ohio a Oregón | Supabase prod está en Oregón (us-west-2): cada consulta hoy cruza EE.UU. (~50–70 ms extra). | Junto con el próximo build mobile, para no hacer un build solo por esto. |

## 111 — Proteger `main`

1. GitHub → Settings → Rules → Rulesets → New ruleset sobre `main`.
2. Activar *Restrict deletions* y *Block force pushes*.
3. *Require status checks*: solo `verificar` (no `check-migraciones`, que
   solo corre si cambian migraciones y trabaría PRs).
4. *Require pull request* solo si la usuaria queda en la *Bypass list*
   (las sesiones locales pushean directo a `main`), con 0 approvals.
5. Evaluar pasar el repo a privado (no hay secretos en el repo; la anon
   key de Supabase es pública por diseño).

## 115 — Render a Oregón

Render no permite cambiar la región de un servicio existente: se crea uno
nuevo y cambia la URL, que hoy está en las apps instaladas, en Vercel y
en Flow.

1. Render → New → Web Service: mismo repo, rama `main`, Docker
   (`backend/Dockerfile`), región **Oregon**, plan Starter, health check
   `/health`, mismas variables de entorno.
2. Dominio propio en el servicio nuevo (ej. `api.transportesitineris.cl`)
   + CNAME en Cloudflare. Así la URL no vuelve a depender de Render.
   ⚠️ El CNAME en **modo DNS only (nube gris)**. Si se deja "Proxied" (nube
   naranja), Cloudflare suma un segundo proxy: hay que cambiar
   `app.set("trust proxy", 1)` a `2` en `backend/src/server.ts`, o todos los
   usuarios compartirían el límite de intentos de login.
3. Vercel: `NEXT_PUBLIC_API_URL` (Production y Preview) al dominio propio
   y redeploy.
4. Flow (y Meta/WhatsApp si aplica): URLs de confirmación/retorno.
5. Mobile: `EXPO_PUBLIC_API_URL` en `eas.json` y en el `.env` del build
   local → dominio propio; build nuevo.
6. Mantener el servicio de Ohio hasta que todos los teléfonos actualicen;
   recién ahí borrarlo (mientras tanto, ~US$ 7/mes extra).
