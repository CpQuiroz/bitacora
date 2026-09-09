# Verificación — Cómo demostrar que el trabajo funciona en bitacora

> Regla de oro: **el agente no dice "funciona", lo demuestra** con evidencia
> ejecutable.

## Nivel 0 — `./verificar.sh` (obligatorio siempre)

Corre: tsc de los 4 paquetes, tests de `packages/shared`, `audit:tenant`
(baseline 6), lint de web (WARN hoy, ver tarea #1), y chequeo de numeración
de migraciones. Verde obligatorio antes de cerrar cualquier tarea.

`./verificar.sh --rapido` saltea mobile-tsc y tests para iterar; el cierre
usa la versión completa.

## Nivel 1 — Type-check por paquete

```
npx tsc -p backend/tsconfig.json  --noEmit
npx tsc -p web/tsconfig.json      --noEmit
npx tsc -p packages/shared/tsconfig.json --noEmit
npx tsc -p mobile/tsconfig.json   --noEmit
```

## Nivel 2 — Tests unitarios (lógica de dominio nueva)

Lógica no trivial en `packages/shared` o `backend` trae test (`tsx --test`).
Camino feliz con assert del resultado + al menos un camino de error.

## Nivel 3 — E2E contra DEV

- **Supabase:** dev ref `pruwvpnlvrvgtmpetlsr`, prod ref `yjbskbskyadxjooxngjv`.
- **Lectura a prod (permitida):**
  `npx supabase db query --linked --project-ref yjbskbskyadxjooxngjv -f archivo.sql`
- **Auth de un usuario de dev** (para pegarle a endpoints protegidos):
  magiclink → `admin.generateLink` → `verifyOtp({ email, token: email_otp,
  type: "email" })` con la anon key. (`/auth/v1/verify` con `token_hash` ya
  no funciona.)
- **Usuarios dev:** `prueba@bitacora.app` (admin), `pedro.chofer.qa@example.com`
  (colaborador). Empresa dev `eed8f39b-e218-4e2a-a9a0-b14c32932ddc`.
- Datos de prueba: creá con `service_role`, **limpiá al terminar**.

## Nivel 4 — PDFs

`brew install poppler`; `pdftoppm -png -r 110 archivo.pdf out` para renderizar
y mirar las páginas. Generá el PDF por el endpoint real
(`GET /api/trabajos/:id/pdf`), no llamando la función suelta.

## Nivel 5 — Mobile

```
npx expo export --platform android      # que compile el bundle
```
Para un APK: el humano lo pide. Al verificar un bundle de prod, confirmá **0**
referencias a dev:
```
strings -n 8 assets/index.android.bundle | grep -c 'localhost:8080\|pruwvpnlvrvgtmpetlsr'   # == 0
```

## Nivel 6 — Prod (post-deploy)

- Push a `main` → Vercel + Render auto (~3-5 min Render).
- Marcador "backend nuevo live": `GET /api/portal/config` → 401 (código nuevo)
  vs 404 (viejo).
- Health backend: `curl -s https://bitacora-cgt7.onrender.com/health/ready`.
- **No** hagas `curl` repetido a la web (Attack Challenge Mode de Vercel
  responde 403 a curl).
- Migración aplicada en prod: `SELECT` sobre
  `supabase_migrations.schema_migrations` e `information_schema.columns`.

## Anti-patrones

- ❌ "Ya lo implementé, debería andar." → falta evidencia.
- ❌ Test que solo comprueba que no se lanzó una excepción.
- ❌ Mockear el filesystem/red donde se puede usar un recurso temporal real.
- ❌ Marcar `done` con `./verificar.sh` en rojo → anotá `blocked`.
