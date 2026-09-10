# Sesión actual

- **Tarea en curso:** 8 — sistema_diseno (Paso 1 hecho, Paso 2 siguiente)
- **Inicio:** 2026-09-09
- **Agente:** Claude Sonnet 5 (directo)

## Decisiones confirmadas por la usuaria (2026-09-09)

- Se reemplaza "Faena" por la dirección crema/Caprasimo. Confirmado.
- Íconos: **Lucide en ambos** (lucide-react + lucide-react-native).
- Caprasimo: **solo headings + botones size lg**; el resto Figtree semibold.
- Storybook: **web completo + pantalla /dev/ui en mobile** (no Storybook RN).

## Estado por paso

- Paso 0 — Auditoría: ✅ `docs/design-audit.md`
- Paso 1 — `packages/design-tokens`: ✅
  - `tokens.json` (valores exactos del prompt) = fuente de verdad.
  - `src/build.ts` (tsx) genera `tokens.css` (@theme Tailwind v4) y
    `src/generated.ts` (objeto tipado `as const` + `fontStack`).
  - `package.json` con `exports` (`.`, `./tokens.json`, `./tokens.css`).
  - Añadido a deps de web y mobile (symlink OK). Root: `build:tokens`,
    `build:packages`, `gen:tokens`. `mobile` postinstall → `build:packages`.
  - web `globals.css`: `@import "@bitacora/design-tokens/tokens.css"` arriba;
    bloque "Faena" queda (conviven durante la migración).
  - `verificar.sh`: +tsc tokens, +paso "tokens en sync" (regen + git diff).
  - Verificado: Tailwind CLI compila `bg-accent-200 #ffe1d0`,
    `rounded-pill 999px`, `font-heading Caprasimo`, `text-h1 42px`,
    `bg-bg #f5ead8`. Faena intacto (#14314f presente). `./verificar.sh` verde.
- Paso 2 — Marca por tenant: ⬜ siguiente
- Pasos 3-7: ⬜

## Próximo paso

Paso 2: `--brand` desde el layout server (web, leyendo el tenant) +
`ThemeProvider` mobile con `brand` (fallback #c67139) + `--brand-hover`/
`--brand-pressed` derivados en OKLCH + test que falla si hay hex literal
fuera de `tokens.json`.
