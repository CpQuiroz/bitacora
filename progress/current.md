# Sesión actual

- **Tarea en curso:** 8 — sistema_diseno (Paso 4 COMPLETO, Paso 5 siguiente)
- **Inicio:** 2026-09-09
- **Agente:** Claude Sonnet 5 (directo)

## Decisiones confirmadas por la usuaria

- 2026-09-09: reemplazar Faena por crema/Caprasimo. Lucide en ambos.
  Caprasimo solo headings+lg. Storybook web + /dev/ui mobile.
- 2026-09-10: coexistencia web = namespace `ds-`. API de Button en español
  ("va así"). "sigue derecho" = continuar sin pausar por grupo.

## Estado por paso

- Paso 0-3: ✅ (`28c7f49`, `748611f`, `35bfa4f`)
- **Paso 4 — `packages/ui`: ✅ COMPLETO** (`627abc5`, `b0af4f8`, `2660ebc`,
  `d092104`, + este commit con Dialog/Toast). Las 12 primitivas del
  prompt: Button, Input, Textarea, Select, DatePicker, Card, Tag,
  StatusBadge, Skeleton/LoadingState/EmptyState/ErrorState, Table (web),
  Dialog (mobile = siempre bottom sheet), Toast (Provider+hook).
  - Ninguna pantalla las usa todavía — eso es el Paso 6.
  - `verificar.sh` cubre `packages/ui` con `tsc --noEmit` (solo lado web +
    tipos; el lado native lo typechea transitivamente el tsc de mobile).

## Próximo paso — Paso 5: reglas transversales

- Forma: auditar que no queden esquinas rectas ni líneas de 1px
  decorativas en las primitivas nuevas (ya cumplido, pero revisar).
- Aire: nada que hacer nuevo (ya se usa la escala `space`).
- Iconos: **agregar Lucide** (`lucide-react` + `lucide-react-native`),
  `stroke-width: 2.75`. Reemplazar el "✕" a mano en Dialog por un ícono.
- Estados interactivos: revisar que TODO elemento clickeable tenga
  hover/pressed/focus-visible — falta hover real en native (RN no tiene
  hover; usar Pressable con estados).
- Contraste: verificar 4.5:1 en los pares de color usados (StatusBadge,
  Tag, texto sobre --ds-brand con foreground calculado).
- Touch targets: ya 44px mínimo en native.
- `font-variant-numeric: tabular-nums` en montos/fechas/folios — falta un
  helper/prop en las primitivas o un componente `Cifra` nuevo.
- Helper de CLP único — hoy duplicado (`web/lib/formatMoneda.ts` vs
  `mobile/lib/plata.ts`). Consolidar en `packages/shared` o `packages/ui`.

## Pendiente / notas generales

- Falta `next build` real + verificación visual de todo el Paso 1-4. Sin
  Storybook todavía (Paso 7) para ver los componentes renderizados de
  verdad — toda la verificación hasta ahora es tsc + compilación real de
  clases Tailwind (CLI), no un screenshot.
- eslint web roto (tarea #1) — bloquea regla ESLint del Paso 7.
- StatusBadge: `MAPA_ESTADO_TONO` tiene solo los estados que caen sin
  forzar en los 4 tonos — completar por pantalla es trabajo del Paso 6.
