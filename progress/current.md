# Sesión actual

- **Tarea en curso:** 8 — sistema_diseno (Paso 4 en curso: Button hecho)
- **Inicio:** 2026-09-09
- **Agente:** Claude Sonnet 5 (directo)

## Decisiones confirmadas por la usuaria

- 2026-09-09: reemplazar Faena por crema/Caprasimo. Lucide en ambos.
  Caprasimo solo headings+lg. Storybook web + /dev/ui mobile.
- 2026-09-10: coexistencia web = namespace `ds-`.
- 2026-09-10: API de Button en español confirmada ("va así").

## Estado por paso

- Paso 0-3: ✅ (`28c7f49`, `748611f`, `35bfa4f`)
- Paso 4 — `packages/ui`: 🔶 en curso
  - Paquete nuevo, source-only (sin build): `src/tipos.ts` (contrato
    compartido), `src/web/` (Tailwind), `src/native/` (RN).
  - Web: `transpilePackages` += `@bitacora/ui` en `next.config.ts`.
  - Mobile: Metro ya observa el workspace root (config existente) — no
    hizo falta tocarlo.
  - **Button** hecho en ambas plataformas. Marca del tenant vía
    `ProveedorMarca`/`useMarca` (`packages/ui/src/native/marca.tsx`) en
    mobile — `App.tsx` lo envuelve con el mismo `color_primario` que ya le
    pasa a `ThemeProvider` (para no divergir).
  - Nombres de fuente RN centralizados en `packages/ui/src/native/fuentes.ts`
    (`FUENTE_NATIVE`) — `mobile/theme/fuentes.ts` los reexporta como
    `FUENTE_DS` (antes eran independientes, ahora una sola fuente de verdad).
  - Verificado: tsc de `ui`/`mobile`/`web` verde; Tailwind CLI compiló las
    clases reales de `Button.tsx` con los valores correctos (`bg-ds-brand`
    → `#c67139`, `rounded-ds-pill` → `999px`, `h-11` → `44px`, `ds-heading`
    con `outline-color: var(--ds-brand)` en focus). `./verificar.sh` verde.
  - **Pendiente:** no hay render real (ni jsdom ni Expo corriendo) — la
    verificación es tsc + compilación de clases, no un screenshot. Storybook
    (Paso 7) va a cubrir esto.

## Próximo paso

Seguir Paso 4: Input/Textarea/Select/DatePicker (siguiente commit), después
Card, Tag/Badge/StatusBadge (unificar los 5 mapas dominio→color del
audit), Table (solo web), Dialog/Sheet, Empty/Loading/ErrorState (skeletons,
no spinner), Toast.

## Pendiente / notas generales

- Falta `next build` real + verificación visual (Pasos 1-4).
- eslint web roto (tarea #1) — bloquea regla ESLint del Paso 7.
- Lucide no agregado todavía — se suma cuando un primitivo lo necesite
  (Input con icono, Toast, etc.) o al final del Paso 4.
