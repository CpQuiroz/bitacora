# Sesión actual

- **Tarea en curso:** 8 — sistema_diseno (Paso 2 hecho, Paso 3 siguiente)
- **Inicio:** 2026-09-09
- **Agente:** Claude Sonnet 5 (directo)

## Decisiones confirmadas por la usuaria

- 2026-09-09: se reemplaza "Faena" por crema/Caprasimo. Íconos: Lucide en
  ambos. Caprasimo: solo headings + botones lg. Storybook: web + pantalla
  /dev/ui en mobile.
- 2026-09-10: coexistencia web durante la migración = **tokens con namespace
  `ds-`** (bg-ds-bg, rounded-ds-lg…). Cero impacto en pantallas Faena.

## Estado por paso

- Paso 0 — Auditoría: ✅ `docs/design-audit.md`
- Paso 1 — `packages/design-tokens`: ✅ (`28c7f49`)
- Paso 2 — Marca por tenant: ✅
  - Generador reescrito: `@theme` con namespace `ds-` (colores, rampas,
    tipos, espaciado, radios, sombras) + `:root` con `--ds-brand*`.
  - `--ds-brand-hover/pressed` = `oklch(from var(--ds-brand) calc(l - N) c h)`
    en `tokens.css` → se re-resuelven en el scope del shell.
  - Web: `DashboardShell` pone `--ds-brand` + `--ds-brand-foreground` desde
    `color_primario`. (Desviación del prompt: no hay layout server con
    tenant en esta app; el shell cliente no da FOUC porque bloquea el render
    hasta `/api/me`. Documentado en design-system.md.)
  - Mobile: `ThemeProvider` → `tema.ds` (`.marca`, `.color`, `.size`,
    `.radius`, `.shadow`, `.font`). `oscurecerOklch` movido a
    `@bitacora/design-tokens/src/oklch.ts` + 5 tests (`tsx --test`).
  - `scripts/check-colores.mjs` + `colores-permitidos.json` + paso en
    verificar.sh. Baseline 19 (todo pantallas Faena).
  - Verificado: Tailwind compila `bg-ds-brand`, `hover:bg-ds-brand-hover`,
    `oklch(from…)` pasa por Lightning CSS; Faena intacto; tsc x5 verde;
    22 tests verdes; `./verificar.sh` verde.

## Próximo paso

Paso 3 — Tipografía: Caprasimo + Figtree self-hosted. Web: `next/font`
(reemplaza IBM Plex en `layout.tsx`, exponer como `--font-ds-heading/body`).
Mobile: `expo-font` + `@expo-google-fonts/caprasimo` + `.../figtree`,
precargar en el splash (App.tsx `useFonts`). Caprasimo solo headings + botón
lg. Faena (IBM Plex) sigue hasta que migren las pantallas.

## Pendiente / notas

- Falta un `next build` real y verificación visual del Paso 1-2 (compilé con
  el CLI de Tailwind, mismo motor, pero no el build completo).
- eslint web sigue roto (tarea #1) — bloquea la regla ESLint del Paso 7.
