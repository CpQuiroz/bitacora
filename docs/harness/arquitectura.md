# Arquitectura — Qué significa "hacer un buen trabajo" en bitacora

> El `revisor` evalúa código contra este archivo. **Si no está acá, no es un
> requisito.** Si creés que algo debería serlo, proponelo — no lo impongas.

## Capas del monorepo

```
mobile/ (Expo)  ─┐
web/ (Next 16)  ─┼─→  backend/ (Express, service role)  ─→  Supabase (Postgres + Auth + Storage)
                 │         │
                 │         └─→ pdfWorkerPool (worker threads) → pdfkit-pure
packages/shared/ ┴──── tipos + lógica pura, importada por los 3 de arriba
```

- **`packages/shared`** — fuente única de verdad de tipos y lógica de dominio
  pura (sin IO). Acá viven: los tipos de tabla, `Database.Functions` (nombres
  de RPC tipados — si agregás una RPC y no la ponés acá, `tsc` de backend
  falla), `TABLAS_POR_EMPRESA`, helpers como `mapearCamposPersonalizados`,
  `sustituirVariables`, cálculos de liquidación Chile.
- **`backend`** — la **única** capa que habla con Supabase. Estructura:
  `src/routes/*.ts` (endpoints) → helpers en `src/*.ts` (`storage.ts`,
  `pdfEstilo.ts`, `tenant.ts`, …). Usa la **service role** → **bypassa RLS**.
- **`web`** — App Router de Next 16. **Nunca** hace `supabase.from(...)`:
  todo pasa por `/api/*` del backend. Ver `web/AGENTS.md` (Next 16 tiene
  breaking changes; leé `node_modules/next/dist/docs/`).
- **`mobile`** — Expo SDK 57, offline-first. Toda mutación pasa por la
  **cola de sync** (`src/services/sync/queue.ts`), que reintenta al
  reconectar. `apiFetch` no adjunta `AbortController.signal` en subidas
  multipart (RN no aborta multipart → cuelga; usa `Promise.race` con timeout
  manual). Ver `mobile/AGENTS.md`.

No introducir capas nuevas (repos, ORMs, un service layer entre routes y
supabase) sin una razón documentada en `trabajo_list.json`.

## Multi-tenant (crítico)

- Cada empresa es un `empresa_id`. **Toda** query a una tabla con `empresa_id`
  filtra por `empresa_id` (en backend, explícito; en SQL/RLS,
  `empresa_id = empresa_actual()`).
- **Toda tabla nueva del schema `public`** lleva `alter table X enable row
  level security;` en su migración. Supabase auto-otorga grants de
  SELECT/INSERT/UPDATE/DELETE a `anon` y `authenticated`; el único cerrojo es
  RLS. Sin RLS, la tabla es leíble y **escribible** con la anon key (que va
  en el bundle del front). Esto expuso `super_admins`, `mfa_totp_secretos`,
  etc. en agosto 2026 (cerrado en la migración 73).
  - Solo-backend → basta `enable row level security` (sin política = deny-all).
  - La lee el front → además política `empresa_id = empresa_actual()`.
- Toda tabla con `empresa_id` va en el allowlist `TABLAS_POR_EMPRESA` de
  `backend/src/tenant.ts`.
- `npm run audit:tenant -w backend` marca `.from("<tabla-empresa>")` sin
  `empresa_id` en ±25 líneas. Baseline: 6 hallazgos preexistentes. Para un
  caso legítimo (ej. `.eq("id", x)` tras un guard de pertenencia), poné un
  comentario `// tenant-ok: <razón>`.

## PDFs

- **pdfkit puro** en un worker thread (`backend/src/workers/pdfWorker.ts`,
  pool en `pdfWorkerPool.ts`). **No** hay HTML→PDF.
- Helpers de estilo compartidos en `backend/src/pdfEstilo.ts` (cajas, grillas,
  títulos de barra, bloques de firma). Reusalos, no reimplementes.
- Fuente base Helvetica (encoding WinAnsi) **no tiene glifo `✓`** → usá
  `[X]` / `[ ]`.
- Fechas/horas en el PDF: `toLocaleString("es-CL", { timeZone:
  "America/Santiago" })` — Render corre en UTC.

## Invariantes

- **Escrituras atómicas** a disco/storage (temp + rename).
- **Aislamiento por tenant** (arriba).
- **La OS es inmutable después de la firma del cliente** (`firma_url`
  presente). El PDF se cachea (`ordenes_servicio.pdf_url`) solo en ese
  momento. Contenido nuevo del PDF debe existir *antes* de la firma.
- `mapearCamposPersonalizados(campos, datos)` es la única forma de casar
  `TipoTrabajo.campos` con `trabajo.datos`.

## Qué NO hacer

- `supabase.from(...)` en `web/` o `mobile/`. Todo por `/api/*`.
- Subir el límite global de `express.json()` para aceptar fotos base64. Las
  fotos van por `multipart/form-data` + `multer` (patrón `trabajos.ts`).
- Tocar `generarPdfCotizacion.ts` / `generarPdfLiquidacion.ts` al trabajar en
  otros PDFs.
- Crear migraciones que no sean aditivas sin avisar (prod ya tiene datos).
- Correr writes/DDL contra la DB de prod (lo hace el humano).
