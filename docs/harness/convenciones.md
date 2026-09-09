# Convenciones de código — bitacora

> Homogeneidad extrema. El repo tiene que parecerse a sí mismo en todas
> partes. Antes de escribir, mirá 2-3 archivos vecinos y copiá su estilo.

## TypeScript

- `strict: true` en los 4 paquetes. Nada de `any` sin comentario que lo
  justifique. Nada de `@ts-ignore` — usá `@ts-expect-error` con razón.
- Imports: builtins / paquetes externos primero, luego `@bitacora/shared`,
  luego relativos.
- Tipos de dominio: **siempre** desde `@bitacora/shared`, no redefinidos
  localmente.

## Idioma

- **Nombres de dominio en español**: `ordenes_servicio`, `folio`, `cobro`,
  `liquidacion`, `empresa_id`. Los nombres técnicos genéricos pueden quedar
  en inglés (`load`, `save`, `parse`).
- **Comentarios y mensajes de commit en español.**
- Mensajes de error que ve el usuario final: español, claros, sin stack
  traces, sin "Error:".

## Manejo de errores

- Backend: cada endpoint devuelve el status HTTP correcto (400 validación,
  401 sin sesión, 403 sin permiso, 404 no existe, 409 conflicto/estado,
  500 solo para lo inesperado). No devuelvas 200 con `{ error }`.
- Guards habituales en rutas de trabajos: `trabajoExiste`, `trabajoBloqueado`
  / `obtenerOCrearOrden` antes de mutar.

## Migraciones (`supabase/migrations/`)

- Nombre: `NN_descripcion_corta.sql`, `NN` correlativo sin huecos.
- **Aditivas** siempre que se pueda (prod tiene datos). Backfill explícito si
  agregás columna `not null`.
- `alter table X enable row level security;` en la misma migración que crea
  la tabla (ver `arquitectura.md` §Multi-tenant).
- RPC nueva → agregala a `Database.Functions` en `packages/shared/src/types.ts`
  o `tsc` de backend falla.
- Tras crear la migración local, el humano la corre en prod y hace
  `supabase migration repair --status applied NN --linked`. El CI
  `check-migraciones-prod` queda rojo hasta entonces.

## Mobile

- Bump `mobile/app.json` `version` + `android.versionCode` en cada build EAS.
- Fotos y archivos: `multipart/form-data`, nunca base64 en JSON.

## Tests

- Runner: `node:test` vía `tsx --test` (como `packages/shared`).
- Un archivo por módulo: `<modulo>.test.ts` al lado del código.
- Recursos reales o temporales (`fs.mkdtemp`), no mocks del filesystem/red.
- Asserts del **resultado concreto**, no "no lanzó excepción".

## Commits

- Formato: `tipo(scope): descripción` en español —
  `fix(backend): ...`, `feat(web): ...`, `chore(mobile): ...`. Para tandas
  grandes multi-paso, el proyecto ha usado `PASO N: ...`.
- **Respaldo:** commiteá cada cambio grande **verificado** (`./verificar.sh`
  verde) antes de pasar al siguiente. No hace falta pedir permiso para estos
  commits de backup.
- Revisá `git status` / `git diff` por `.env` o secretos antes de `git add`.
- Cierre de mensaje de commit:
  ```
  Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
  ```
- **Prohibido sin confirmación explícita del humano:** `push --force`,
  `reset --hard`, `commit --amend`, `rebase`, borrar ramas.

## Comentarios

Por defecto **no**. Solo para explicar un *por qué* no obvio (workaround
documentado, invariante sutil, `// tenant-ok:`). Los nombres hacen el resto.
