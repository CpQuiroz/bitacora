# Briefing — Puesta de Bitácora en internet

> Para pegar en el Project de claude.ai (el que no tiene acceso al código).
> Estado al 31-ago-2026. Complementa a `CONTEXTO_PROYECTO.md`.

---

## 1. Objetivo y arquitectura de despliegue

Sacar Bitácora a internet con esta topología (ya definida en el README, aún sin
configurar en el repo):

| Pieza | Proveedor | Notas |
|---|---|---|
| Web (Next.js 16, App Router) | **Vercel** | build del workspace `web/` |
| Backend (Express, Docker) | **Render** | imagen Docker, `backend/Dockerfile` |
| DB + Auth + Storage | **Supabase** | **proyecto de producción NUEVO**, separado del de desarrollo |
| Dominio / DNS / WAF | **Cloudflare** | |
| App móvil (Expo) | fuera de alcance de esta fase | parcial, 4 pantallas |

Monorepo con **npm workspaces**: `web`, `mobile`, `backend`, `packages/shared`.
El backend depende de `@bitacora/shared` (workspace, no publicado).

---

## 2. Trabajo hecho en esta sesión (ya commiteado)

### 2.1 Dockerfile del backend — reescrito para build desde la raíz del monorepo
- **Problema:** el Dockerfile asumía build context = `backend/` y corría `npm run build`
  contra el package.json equivocado (Render con Root Directory vacío apunta el context
  a la raíz → `Missing script: "build"`). Además el backend necesita ver `packages/shared`,
  invisible con context en `backend/`.
- **Solución:** `npm ci` en la raíz con los manifests de todos los workspaces, compila
  `packages/shared` + `backend` vía los scripts `build:shared` / `build:backend`, imagen
  final con el `node_modules` hoisteado + `packages/shared/dist` + `backend/dist`.
- Nuevo `.dockerignore` en la raíz.
- **Node 20 → Node 22:** `@supabase/supabase-js` v2.112 exige un `WebSocket` global nativo,
  disponible sin flags recién en Node 22. Con `node:20-slim` el backend crasheaba al
  arrancar. Se agregó `"engines": { "node": ">=22" }` a `backend/package.json`.
- **Verificado localmente con Docker:** `docker build` OK, el contenedor levanta,
  `GET /health` → 200, y una llamada a `/api/superadmin/login` con credenciales falsas
  devuelve 401 (o sea, conecta a Supabase y consulta la DB). Imagen final ~306 MB.
- **Config correcta en Render:** Root Directory vacío · Dockerfile Path `backend/Dockerfile`
  · Docker Build Context Directory `.` (raíz).

### 2.2 Fallback de correo en desarrollo
- Sin `RESEND_API_KEY` / `RESEND_FROM_EMAIL`, cualquier envío de correo lanzaba y
  bloqueaba flujos (crear empresa desde superadmin, invitar usuarios, reset de
  contraseña, 2FA por correo).
- Ahora: **en producción sigue lanzando** (comportamiento intacto); **fuera de
  producción** escribe el correo (destinatario, asunto, enlaces) en la consola del
  backend y sigue como si se hubiera enviado. Solo afecta desarrollo local.

### 2.3 Nueva funcionalidad — invitar usuarios a una empresa desde el Panel de Super-Admin
- Antes el superadmin solo podía invitar al **admin inicial** al crear una empresa.
  Ahora puede invitar usuarios adicionales (roles: admin / supervisor / contador /
  colaborador) a una empresa ya existente, desde la ficha de la empresa.
- Mismo mecanismo que la invitación del admin de empresa (link por correo + alta en
  Auth + fila en `usuarios`, con rollback si el correo falla).
- **No aplica el límite de usuarios del plan** — es acción de plataforma deliberada.
- Queda auditado en `super_admin_auditoria` como `invitar_usuario_empresa`.

---

## 3. Variables de entorno para producción

### 3.1 Backend (Render) — OBLIGATORIAS (el proceso no arranca sin ellas)

| Variable | Origen |
|---|---|
| `SUPABASE_URL` | Supabase (proyecto prod) → Settings → API → Project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Settings → API → `service_role` (secreta, solo backend) |
| `STORAGE_ENDPOINT` | Supabase → Settings → Storage → S3 Connection (`https://<proj>.supabase.co/storage/v1/s3`) |
| `STORAGE_ACCESS_KEY` | mismo panel S3 Connection |
| `STORAGE_SECRET_KEY` | mismo panel S3 Connection |
| `STORAGE_BUCKET` | crear bucket en Supabase Storage; el default del código es `fotos-trabajos` |
| `ANTHROPIC_API_KEY` | console.anthropic.com → API Keys |
| `INTEGRACIONES_ENCRYPTION_KEY` | generada con `openssl rand -base64 32` |
| `PORTAL_TOKEN_SECRET` | `openssl rand -base64 32` |
| `SUPERADMIN_TOKEN_SECRET` | `openssl rand -base64 32` |
| `SUPERADMIN_ENCRYPTION_KEY` | `openssl rand -base64 32` (distinta de las demás) |
| `USUARIOS_MFA_ENCRYPTION_KEY` | `openssl rand -base64 32` (distinta de las demás) |

> Las 5 llaves generadas ya se produjeron en esta sesión y están en poder del usuario
> (Render env vars + backup en gestor de secretos). **No rotarlas** sin plan de
> migración: si se pierde `INTEGRACIONES_ENCRYPTION_KEY` o `SUPERADMIN_ENCRYPTION_KEY`,
> los datos cifrados con ellas quedan irrecuperables.

### 3.2 Backend — con default pero que HAY que setear en producción

| Variable | Valor prod |
|---|---|
| `WEB_URL` | URL pública de la web, ej. `https://app.tudominio.cl` (aparece en los links de los correos) |
| `ALLOWED_ORIGINS` | `https://app.tudominio.cl` (+ portal si aplica, separados por coma). **Sin esto la web no puede llamar al API** (CORS solo permite `localhost:3000`) |
| `NODE_ENV` | `production` (Render lo setea; importante — activa el comportamiento estricto de correo) |
| `PORT` | Render lo inyecta solo |

### 3.3 Backend — opcionales, PERO ojo con RESEND

| Variable | Nota |
|---|---|
| `RESEND_API_KEY` / `RESEND_FROM_EMAIL` | **En producción NO son realmente opcionales.** Sin ellas fallan: crear empresa desde superadmin, invitar colaboradores, reset de contraseña, 2FA por correo. Hay que crear cuenta en resend.com, verificar un dominio remitente y cargar ambas. |
| `WHATSAPP_*` (4 vars) | Dejar vacías OK — el webhook responde 200 y no procesa nada |
| `FLOW_*` (API key, secret, plan IDs) | Dejar vacías OK — rutas de suscripción devuelven error pero no bloquean. Ver §5. |

### 3.4 Web (Vercel)

| Variable | Valor |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | igual que `SUPABASE_URL` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Settings → API → **`anon` / `public`** (NO la service_role) |
| `NEXT_PUBLIC_API_URL` | URL pública del backend en Render, ej. `https://api.tudominio.cl` |

---

## 4. Pasos de infraestructura pendientes

### 4.1 Supabase (proyecto de producción)
1. Crear un proyecto Supabase **nuevo** para producción (separado del de desarrollo).
2. Aplicar **todas** las migraciones de `supabase/migrations/` **en orden**.
3. **Auth → URL Configuration → Redirect URLs:** agregar `https://app.tudominio.cl/invitacion`
   y `https://app.tudominio.cl/auth/callback`. Sin esto, los links de invitación y el
   login con Google no funcionan.
4. Crear el bucket de Storage (`fotos-trabajos` o el nombre que se ponga en `STORAGE_BUCKET`).
5. Obtener las credenciales S3 (Settings → Storage → S3 Connection).
6. **Crear la cuenta de Super-Admin:** no hay endpoint HTTP, se corre el script offline
   `backend/scripts/crear-superadmin.ts` contra la DB de producción.

### 4.2 Render (backend)
- Servicio tipo **Web Service** con runtime **Docker**.
- Root Directory vacío, Dockerfile Path `backend/Dockerfile`, context `.`.
- Cargar todas las env vars de §3.1 + §3.2 (+ RESEND de §3.3).
- Health check path: `/health`.

### 4.3 Vercel (web)
- Importar el repo, **Root Directory = `web`**.
- Framework preset: Next.js. Vercel maneja el monorepo con workspaces; verificar que el
  build resuelve `@bitacora/shared` (puede requerir `installCommand` en la raíz o
  `turbo`/build settings — a validar en el primer deploy).
- Cargar las 3 env vars de §3.4.

### 4.4 Cloudflare
- DNS de `app.tudominio.cl` → Vercel, `api.tudominio.cl` → Render.
- WAF / rate limiting a gusto (el backend ya trae `helmet` + `express-rate-limit`).

### 4.5 Resend
- Cuenta + verificación de dominio remitente + API key → cargar en Render.

---

## 5. Flow (suscripción B2B) — pendiente antes de cobrar de verdad

Hoy probado solo en **sandbox** de Flow. Para producción falta:
1. Crear los **Planes Básico y Pro** en el panel de producción de Flow (el de Pro **ni
   siquiera existe en sandbox** todavía — el botón "pasar a Pro" está bloqueado con aviso).
2. Credenciales de producción: `FLOW_API_KEY` / `FLOW_SECRET_KEY` de prod, `FLOW_API_URL`
   = `https://www.flow.cl/api`, `FLOW_PLAN_ID_BASICO` / `FLOW_PLAN_ID_PRO`.
3. Confirmar de punta a punta un ciclo de cobro real tras el trial de 21 días.

Se puede salir a internet **sin Flow configurado** (queda todo en trial, las rutas de
suscripción devuelven error controlado). Es una decisión de negocio: ¿lanzar en modo
trial-only y activar cobro después, o esperar a tener Flow prod listo?

---

## 6. Otros pendientes conocidos relevantes al lanzamiento

- **CI/CD (GitHub Actions):** cero configuración hoy. No bloquea el lanzamiento manual
  pero conviene al menos un workflow de `tsc --noEmit` + build.
- **Login con Google:** requiere habilitar el proveedor en Supabase Auth (Client ID/Secret
  de Google Cloud). Sin eso el botón aparece pero falla.
- **Aislamiento multi-tenant:** hoy es disciplina de código + script de auditoría
  (`npm run audit:tenant`), **no** una barrera que la DB haga cumplir (las policies RLS
  existen pero el backend usa service-role y las bypassa). Gap conocido y explícito —
  correr la auditoría antes de lanzar.
- **Suspender empresa desde Super-Admin** hoy solo bloquea el dashboard normal, **no** el
  Portal de Cliente ni el bot de WhatsApp.
- **Bot de WhatsApp:** código completo, inactivo (falta setup de Meta Business).
- **Pasarela de pago de Cobros al cliente final:** simulada (distinto de la suscripción
  B2B con Flow, que sí es real).
- **Límites por plan** (`LIMITES_POR_PLAN`): números provisionales, fáciles de ajustar.
- **Checklist de seguridad de salida** (del README): ambientes separados, RLS auditado,
  secretos rotados, `helmet` + rate limiting (✅ ya están), 2FA para Admin (✅ obligatorio
  por rol), backups probados, cumplimiento Ley 21.719.

---

## 7. Preguntas abiertas para decidir con el usuario

1. ¿Dominio definitivo? (define `WEB_URL`, `ALLOWED_ORIGINS`, redirect URLs, DNS)
2. ¿Lanzar en modo **trial-only** (sin Flow prod) y activar cobro después, o esperar Flow?
3. ¿Login con Google en el lanzamiento, o solo correo/contraseña al principio?
4. ¿Se arma CI mínimo antes de lanzar, o deploy manual y CI después?
5. ¿Quién es el primer cliente / se hace un piloto controlado antes de abrir registro?
