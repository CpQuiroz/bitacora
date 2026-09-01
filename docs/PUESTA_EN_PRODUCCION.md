# Puesta de Bitácora en producción — estado y runbook

> Para el Project de claude.ai (el que no tiene acceso al código). Complementa a
> `CONTEXTO_PROYECTO.md`. Última actualización: **1-sep-2026**.

---

## 0. Estado actual (1-sep-2026)

**Bitácora ya está publicada en internet**, en un ambiente de producción separado del de
desarrollo. Falta terminar de dar de alta la primera empresa cliente.

| Pieza | Dónde | URL / identificador |
|---|---|---|
| Web (Next.js 16) | **Vercel** | `https://app.transportesitineris.cl` |
| Backend (Express, Docker) | **Render** | `https://bitacora-cgt7.onrender.com` |
| DB + Auth + Storage | **Supabase** (proyecto prod, separado del de dev) | ref `yjbskbskyadxjooxngjv` |
| Dominio / DNS | **Cloudflare** | `transportesitineris.cl` |
| Correo transaccional | **Resend** | dominio `transportesitineris.cl` **verificado** |

Dev sigue en un Supabase aparte (ref `pruwvpnlvrvgtmpetlsr`) + servidores locales.

### Migraciones — estado en prod

**Última migración aplicada a producción: `61` (verificado 1-sep-2026 con `supabase migration list` + consulta directa a `information_schema`).** Actualizar este número a mano cada vez que se aplique una migración nueva a prod — es la única fuente de verdad rápida hasta que exista el chequeo de CI (ver más abajo).

> ⚠️ **Incidente real (1-sep-2026):** un script de verificación corrió sin `DOTENV_CONFIG_PATH`, leyó `backend/.env` (dev) en vez de `.env.produccion.local`, y esa lectura equivocada llevó a marcar las migraciones 54-59 como aplicadas en prod (`migration repair`) sin que su SQL hubiera corrido. Prod quedó con el schema real de 01-53 pero el tracking mintiendo hasta 59, hasta que un error real de la app (`clientes.fecha_nacimiento` no encontrado) lo destapó. Se corrigió con `migration repair --status reverted` + `db push --include-all`. Mitigaciones agregadas:
> - `backend/src/env.ts` loguea el ref de Supabase al cargar, en cualquier script o al arrancar el server — nunca más se debería adivinar contra qué proyecto se está actuando.
> - `.github/workflows/check-migraciones-prod.yml` (nuevo, ver abajo) falla el CI si hay migraciones locales sin aplicar a prod.

#### CI de migraciones — falta configurar 2 secrets en GitHub

El workflow `.github/workflows/check-migraciones-prod.yml` ya está en el repo pero necesita, en **GitHub → Settings del repo → Secrets and variables → Actions → New repository secret**:

| Secret | De dónde sale |
|---|---|
| `SUPABASE_ACCESS_TOKEN` | supabase.com/dashboard/account/tokens → Generate new token |
| `SUPABASE_PROD_DB_PASSWORD` | Supabase (proyecto `bitacora-prod`) → Project Settings → Database → Database password (el mismo que usaste para `supabase link`) |

Sin esos dos secrets el workflow falla al correr (no puede vincularse). Corre en cada push/PR que toque `supabase/migrations/**`, y también manual (`workflow_dispatch`).

### Lo que YA funciona en prod (verificado)
- La web carga, el backend responde (`/health` → 200), CORS habilitado para el dominio.
- Login normal (`/login`) y login de Super-Admin (`/superadmin/login`) llegan a la DB.
- Existe una cuenta de **Super-Admin** creada en prod (vía `crear-superadmin.ts`).
- `generateLink` de invitación funciona contra el Supabase de prod.
- Resend manda correos desde `@transportesitineris.cl` (probado, status 200).

### Lo que FALTA para tener la primera empresa operativa
1. Confirmar que Render tiene `RESEND_API_KEY` + `RESEND_FROM_EMAIL` (con la key **nueva**,
   la anterior se expuso y hay que rotarla) y que redesplegó.
2. Crear la empresa **"Transportes Itineris"** desde el panel de Super-Admin, usando un
   correo de admin **que no exista todavía** en `auth.users` (ver §4, issue conocido).
3. Que llegue el correo de invitación, activar la cuenta del admin, entrar al dashboard.

---

## 1. Arquitectura de despliegue

Monorepo con **npm workspaces**: `web`, `mobile`, `backend`, `packages/shared`.
El backend y la web dependen de `@bitacora/shared` (workspace, no publicado en npm) —
esto obligó a ajustar el build de los dos proveedores (ver §2).

| Pieza | Proveedor | Build |
|---|---|---|
| Web | Vercel | Root Directory = `web`; build command en `web/vercel.json` (compila `packages/shared` antes de `next build`) |
| Backend | Render | Docker, `backend/Dockerfile`, build context = raíz del repo |
| App móvil (Expo) | — | fuera de alcance de esta fase |

---

## 2. Trabajo hecho (commiteado y pusheado a `main`)

### 2.1 Backend — Dockerfile para monorepo + Node 22
- El Dockerfile asumía build context = `backend/`. Con Render apuntando el context a la
  raíz, `npm run build` corría contra el `package.json` equivocado → `Missing script: "build"`.
  Además el backend necesita ver `packages/shared`.
- **Reescrito:** `npm ci` en la raíz con los manifests de todos los workspaces, compila
  `packages/shared` + `backend`, imagen final liviana. Nuevo `.dockerignore` en la raíz.
- **Node 20 → 22:** `@supabase/supabase-js` v2.112 necesita `WebSocket` global nativo
  (sin flags recién en Node 22). Con `node:20-slim` el backend crasheaba al arrancar.
  Se agregó `"engines": { "node": ">=22" }` a `backend/package.json`.
- Verificado local con `docker build` + `docker run`: contenedor levanta, `/health` 200.

### 2.2 Web — build de monorepo en Vercel + fix de Suspense
- `next build` (producción) no resolvía `@bitacora/shared` porque su `dist/` no existe en
  un checkout limpio y `transpilePackages` no alcanza (Next resuelve por `main` primero).
- **Fix:** `web/vercel.json` con `buildCommand: "cd .. && npm run build:shared && cd web && next build"`.
  En Vercel: Root Directory = `web`, el resto por default.
- **Segundo bloqueo (preexistente):** 7 páginas usaban `useSearchParams()` sin `<Suspense>`,
  cosa que `next build` de producción rechaza (`next dev` no lo valida). Se envolvió el
  cuerpo de cada una en `<Suspense>`.
- Verificado local: `next build` completo en verde (con `packages/shared` compilado primero).

### 2.3 Correo — fallback a consola en desarrollo
- Sin `RESEND_API_KEY` / `RESEND_FROM_EMAIL`, cualquier envío de correo lanzaba y bloqueaba
  flujos (crear empresa, invitar usuarios, reset de contraseña, 2FA por correo).
- Ahora: **en producción sigue lanzando** (intacto); **fuera de producción** escribe el
  correo (destinatario, asunto, enlaces) en la consola del backend y sigue. Solo dev.

### 2.4 Super-Admin — invitar usuarios a una empresa existente
- Antes el superadmin solo invitaba al **admin inicial** al crear la empresa. Ahora puede
  invitar usuarios adicionales (admin / supervisor / contador / colaborador) a una empresa
  ya creada, desde la ficha de la empresa.
- Mismo mecanismo (link por correo + alta en Auth + fila en `usuarios`, con rollback si el
  correo falla). No aplica el límite de usuarios del plan (acción de plataforma).
- Auditado como `invitar_usuario_empresa`.

### 2.5 Super-Admin — sección "Mi cuenta"
- Hasta ahora la única vía para gestionar las credenciales del propio super-admin era el
  script offline `crear-superadmin.ts`. Nueva página `/superadmin/cuenta`:
  - Cambiar la propia contraseña (pide contraseña actual + código TOTP)
  - Regenerar el propio TOTP (secreto mostrado una sola vez)
- Toda mutación exige reautenticarse en el momento (igual que el login) — un token filtrado
  no alcanza para cambiar el segundo factor. Auditado.
- Endpoints: `GET /api/superadmin/me`, `POST /me/cambiar-password`, `POST /me/regenerar-totp`.

---

## 3. Variables de entorno de producción (estado)

### 3.1 Backend (Render) — todas cargadas y verificadas
`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (service_role, proyecto prod), `STORAGE_*`,
`ANTHROPIC_API_KEY`, `INTEGRACIONES_ENCRYPTION_KEY`, `PORTAL_TOKEN_SECRET`,
`SUPERADMIN_TOKEN_SECRET`, `SUPERADMIN_ENCRYPTION_KEY`, `USUARIOS_MFA_ENCRYPTION_KEY`,
`WEB_URL=https://app.transportesitineris.cl`, `ALLOWED_ORIGINS` (con el dominio prod).

> ⚠️ `SUPERADMIN_ENCRYPTION_KEY` en Render **debe** ser idéntica a la que se usó al correr
> `crear-superadmin.ts` (está en `backend/.env.produccion.local`), o el login de super-admin
> falla al descifrar el secreto TOTP.

**Falta / a rotar:**
- `RESEND_API_KEY` — cargar la **nueva** (la primera se pegó en un chat y quedó expuesta).
- `RESEND_FROM_EMAIL` — ej. `Bitácora <no-reply@transportesitineris.cl>`. **Ojo con el
  nombre exacto de la variable: `RESEND_FROM_EMAIL`, no `RESEND_FROM`.**
- `WHATSAPP_*` y `FLOW_*` — vacías por ahora (OK, no bloquean).

### 3.2 Web (Vercel) — cargadas
`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (la `anon`, no la service_role),
`NEXT_PUBLIC_API_URL=https://bitacora-cgt7.onrender.com`.

### 3.3 Secretos expuestos en el chat de esta sesión — ROTAR
- La primera **Resend API key** → revocar en Resend, usar otra.
- El **GitHub Personal Access Token** usado para `git push` → revocar en GitHub.
- La **`SUPABASE_SERVICE_ROLE_KEY`** de prod se pegó completa en el chat. Es acceso total a
  la DB (saltea RLS). Rotarla implica rotar el JWT secret del proyecto Supabase (desloguea
  a todos) y re-cargar la key en Render + `.env.produccion.local`. Evaluar hacerlo antes de
  tener datos reales de clientes.

---

## 4. Issue conocido encontrado en el alta de empresa

**Síntoma:** al crear una empresa desde el panel, "No se pudo invitar al administrador.
Verifica que el correo sea válido e intenta de nuevo."

**Causa real:** `supabase.auth.admin.generateLink({ type: "invite" })` **falla si el correo
del admin ya existe en `auth.users`**. El mensaje del panel es engañoso (habla de correo
inválido). No era un problema de Render, keys, ni CORS — todo eso se verificó OK.

**Workaround inmediato:** usar un correo de admin que no exista todavía
(`transportesitineris@gmail.com` funciona y está limpio).

**Mejora pendiente (no crítica):** el backend podría detectar "email ya registrado" y
devolver un mensaje claro, o permitir vincular un `auth.users` existente a la empresa nueva.

**Limpieza:** durante el debug quedaron/borraron usuarios de prueba en `auth.users` de prod
(`prueba@bitacora.app`, `diag-invitacion@example.com`). Al 1-sep están borrados.

---

## 5. Flow (suscripción B2B) — sin tocar, se puede lanzar sin esto

Probado solo en sandbox. Para cobrar de verdad falta: crear los Planes Básico y Pro en el
panel de producción de Flow, credenciales de prod, y confirmar un ciclo de cobro real tras
el trial de 21 días. **Decisión de negocio:** lanzar trial-only y activar cobro después, o
esperar a tener Flow prod.

---

## 6. Otros pendientes conocidos

- **CI/CD:** cero. Conviene al menos un workflow de `tsc --noEmit` + build antes de crecer.
- **Login con Google:** requiere habilitar el proveedor en Supabase Auth (prod) con
  Client ID/Secret de Google Cloud. Sin eso el botón aparece pero falla.
- **Redirect URLs en Supabase (prod):** confirmar que Authentication → URL Configuration
  tiene Site URL = `https://app.transportesitineris.cl` y Redirect URLs con
  `https://app.transportesitineris.cl/**`.
- **Aislamiento multi-tenant:** es disciplina de código + `npm run audit:tenant`, no una
  barrera que la DB imponga (el backend usa service-role y saltea RLS). Correr la auditoría
  antes de sumar clientes.
- **Suspender empresa** desde Super-Admin hoy solo bloquea el dashboard normal, no el Portal
  de Cliente ni WhatsApp.
- **Bot de WhatsApp:** código completo, inactivo (falta setup de Meta Business).
- **Pasarela de pago de Cobros al cliente final:** simulada.
- **Backups de la DB de prod:** verificar que Supabase los tiene habilitados y probar una
  restauración.

---

## 7. Preguntas abiertas para decidir

1. ¿Rotar ya la `SUPABASE_SERVICE_ROLE_KEY` (y el JWT secret) por la exposición en el chat,
   o esperar a estar por sumar datos reales?
2. ¿Lanzar trial-only (sin Flow) y activar cobro después?
3. ¿Login con Google en el lanzamiento, o solo correo/contraseña?
4. ¿CI mínimo antes de seguir, o después?
5. ¿"Transportes Itineris" es un piloto controlado (primer cliente = el propio dueño) antes
   de abrir a otros?
