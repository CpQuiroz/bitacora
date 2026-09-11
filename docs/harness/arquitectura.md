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

## Roles y permisos

- 4 roles de sistema: `admin | supervisor | contador | colaborador`
  (`packages/shared/src/types.ts` → `Rol`). Editables desde el Panel de
  Super-Admin (tabla `roles`, migración 71) — no son un enum cerrado en
  el código, se resuelven en `backend/src/roles.ts`.
- 3 capas de resolución:
  1. **Plantilla global del rol** — módulos/acciones por defecto.
  2. **Override por empresa** sobre esa plantilla (tabla
     `empresa_rol_modulos`, migración 75).
  3. **Gating por plan** — módulos contratados (`empresa_modulos`,
     `Plan`: `trial | basico | pro`).
  `requiereModulo`/`requiereAccion` (`backend/src/permisos.ts`) validan
  rol + plan juntos.
- Mobile usa un eje aparte de los roles web: `usuarios.funcion`
  (`tecnico | chofer | instalador | administrativo | otro`, migración
  65) filtra qué herramientas ve un colaborador en la app.

## Patrones a reutilizar

No reinventar lo que ya existe:
- `subirAnexo` (`backend/src/storage.ts`) — sube a S3/Storage con el
  límite de cuota por empresa ya resuelto.
- `requiereModulo` / `requiereAccion` (`backend/src/permisos.ts`) —
  guard de rol+plan sobre una ruta.
- `ComboboxCliente` (`web/src/components/ComboboxCliente.tsx`),
  `InputMonto` (web y mobile) — selector de cliente y campo de dinero
  con su UX ya resuelta (formato de miles, símbolo de moneda).
- Toda query: filtrar por `empresa_id`, `.limit()` explícito, columnas
  explícitas — nunca `select("*")`.

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
- **Catálogo de packs**: la definición (`tipos_pack`) es una plantilla
  que nunca se decrementa. Cada venta crea un snapshot inmutable en
  `paquetes_sesiones` (nombre, precio, sesiones — ver
  `packages/shared/src/types.ts:643`) del cual se descuentan las
  sesiones, nunca de la plantilla.
- **Deletes condicionales** en catálogo/configuración con FKs (tipos de
  trabajo, tipos de OS, categorías, proveedores…): intentar el
  hard-delete y traducir el error `23503` (FK violation) a "está en uso
  — desactívalo en vez de eliminarlo" (patrón real en
  `backend/src/routes/tiposTrabajo.ts`). Nunca hard-delete si el ítem ya
  se usó en algo.
- **Índices**: todo objeto nuevo en la DB que se filtra/joinea seguido
  lleva su índice, y el plan (`EXPLAIN ANALYZE`) se valida antes de
  cerrar la tarea — no asumir que ayuda, confirmarlo.
- **IA en Informes** (cuando se construya): se implementa como RAG,
  nunca como fine-tuning.

## Qué NO hacer

- `supabase.from(...)` en `web/` o `mobile/`. Todo por `/api/*`.
- Subir el límite global de `express.json()` para aceptar fotos base64. Las
  fotos van por `multipart/form-data` + `multer` (patrón `trabajos.ts`).
- Tocar `generarPdfCotizacion.ts` / `generarPdfLiquidacion.ts` al trabajar en
  otros PDFs.
- Crear migraciones que no sean aditivas sin avisar (prod ya tiene datos).
- Correr writes/DDL contra la DB de prod (lo hace el humano).
- Reestructurar las tabs **Agenda** y **Hoy** de mobile sin que se pida
  explícitamente — quedaron congeladas tras el refresco de navegación
  de 2026-08/09.
- Hacer que el módulo de **Mantención de flota** toque `trabajos` /
  `ordenes_servicio` — es deliberado, evita los efectos secundarios de
  facturación automática y requisitos de cliente que ese flujo dispara.
- Proponer descartar RLS "porque el backend ya filtra por `empresa_id`"
  — son mecanismos complementarios, no alternativos (ver §Multi-tenant
  arriba). No reabrir esta discusión sin que se pida.
