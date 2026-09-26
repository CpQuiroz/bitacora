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

### ⚠️ `supabase db push --linked` NO funciona para NN ≥ 100

`db push` compara las versiones como **texto**, no como número. Como el
historial de prod tiene decenas de migraciones de 2 dígitos (10-99) y esas
comparan como texto MAYOR que cualquier "10X"/"11X" (ej. `"15" > "104"`,
compara carácter por carácter), **cualquier migración nueva de 3 dígitos
siempre va a tirar** `Found local migration files to be inserted before the
last migration on remote database`. No es un glitch puntual de la 103/104
(ver `progress/current.md`, 2026-09-14) — va a pasar con cada migración
nueva mientras el historial tenga alguna versión de 2 dígitos. **No usar
`--include-all`** (re-ejecutaría migraciones viejas ya aplicadas).

Se evaluó renumerar todo con ceros a la izquierda (fix permanente) vs.
seguir con un workaround manual — la usuaria eligió el workaround por ser
de riesgo cero (renumerar exige tocar ~104 archivos locales Y el historial
de migraciones ya grabado en prod; un desalineamiento ahí puede hacer que
`db push` intente re-aplicar migraciones viejas). Procedimiento para **cada
migración nueva** (el humano la corre, ver arriba):

```bash
# en vez de `supabase db push --linked`:
npx supabase db query --linked --project-ref <ref> -f supabase/migrations/NNN_descripcion.sql
npx supabase migration repair --status applied --linked NNN
```

El primer comando aplica el archivo directo (funciona para cualquier SQL,
no solo funciones — para DDL no-idempotente como `create table`, confirmar
antes que no se haya aplicado ya). El segundo es solo bookkeeping, no
ejecuta nada.

## Mobile

- Bump `mobile/app.json` `version` + `android.versionCode` en cada build.
- **Builds: solo locales por ahora** (decisión de la usuaria, 23-sep-2026 —
  "ya no haremos build en EAS, los haremos local por unas semanas"). No
  lanzar `eas build`. El build local se hace en la Mac, usuario `cquiroz`
  (`expo prebuild` + `gradlew assembleRelease`, `.env` con los valores de
  prod de `eas.json` → `build.preview.env` durante el build y restaurado
  a dev después). La llave de firma es la de ese usuario: un APK firmado
  en otra máquina/usuario no se instala encima del existente.
- Fotos y archivos: `multipart/form-data`, nunca base64 en JSON.

## Listas y tablas (UI)

Decisión de la usuaria (25-sep-2026, tarea 148): **todo objeto que se lista
tiene acción al tocarlo**.
- **Web:** en `Table` (`@bitacora/ui/web`) pasar `onFilaClick`: clic, doble
  clic y Enter sobre la fila abren el objeto (su ficha o su edición). Las
  demás acciones van en el menú "⋯" (`accionesEnMenu` + `acciones`), no
  como botones sueltos en la fila. Controles dentro de la fila deben frenar
  la propagación.
- **Mobile:** tocar la fila abre el detalle (ListRow `onPress` / `Pressable`).
- Las tablas que aún no cumplen están en la tarea 149.

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
