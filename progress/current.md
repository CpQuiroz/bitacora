# Sesión actual

- **Tarea en curso:** 8 — sistema_diseno (Paso 3 hecho, Paso 4 siguiente)
- **Inicio:** 2026-09-09
- **Agente:** Claude Sonnet 5 (directo)

## Decisiones confirmadas por la usuaria

- 2026-09-09: se reemplaza "Faena" por crema/Caprasimo. Íconos: Lucide en
  ambos. Caprasimo: solo headings + botones lg. Storybook: web + pantalla
  /dev/ui en mobile.
- 2026-09-10: coexistencia web = tokens con namespace `ds-`.

## Estado por paso

- Paso 0 — Auditoría: ✅ `docs/design-audit.md`
- Paso 1 — `packages/design-tokens`: ✅ `28c7f49`
- Paso 2 — Marca por tenant: ✅ `748611f`
- Paso 3 — Tipografía: ✅
  - Web: `layout.tsx` carga Caprasimo (400) + Figtree (400/500/600/700) con
    `next/font/google` self-hosted, `display: swap`, como `--font-caprasimo`
    / `--font-figtree`. tokens.css: `--font-ds-heading`/`--font-ds-body` los
    referencian. `@utility ds-heading` (familia+peso+leading 1.12+tracking
    -0.015em) y `@utility ds-body` (familia+15px+leading 1.55).
  - Mobile: `fuentes.ts` + `FUENTE_DS` (Caprasimo_400Regular,
    Figtree_400/500/600/700). `App.tsx` `useFonts({...fuentesFaena,
    ...fuentesDS})` (sin salto de fuente). `tema.ds.font` = nombres RN;
    `ds.headingLeading` / `ds.headingTracking`.
  - deps mobile: `@expo-google-fonts/caprasimo` `^0.4.0`,
    `@expo-google-fonts/figtree` `^0.4.1`.
  - Verificado: Tailwind compila `ds-heading` con `line-height:1.12`,
    `letter-spacing:-0.015em`, `var(--font-caprasimo)`; `.ttf` presentes;
    tsc x5 verde; 22 tests; `./verificar.sh` verde. Faena/IBM Plex intacto.

## Próximo paso

Paso 4 — `packages/ui`: primitivas con API única web/mobile (español).
Button (primary/secondary/ghost/danger · sm/md/lg · block/loading/icon),
Input/Textarea/Select/DatePicker, Card, Tag/Badge, StatusBadge (un solo
mapa dominio→color), Table (web), Dialog/Sheet, EmptyState/LoadingState/
ErrorState (skeletons, no spinner), Toast. Implementaciones separadas,
props idénticas. Web `ui.tsx` y mobile `ui/` pasan a re-exports.
**Ojo:** empezar por Button (define el patrón) y parar a mostrar la API
antes de hacer las 12 primitivas.

## Pendiente / notas

- Falta `next build` real + verificación visual (Pasos 1-3).
- eslint web roto (tarea #1) — bloquea regla ESLint del Paso 7.
- Lucide (decisión): `lucide-react` + `lucide-react-native` se agregan en
  Paso 4 (los usan los primitivos) o Paso 5.
