# Sistema de diseño de Bitácora

> Estado: **en construcción** (reemplazando la dirección "Faena"). Ver
> `docs/design-audit.md` para el punto de partida y el plan por pasos.
> Regla de oro: **ningún color, tamaño, radio, sombra ni espaciado se
> escribe a mano** — todo sale de tokens.

## Fuente de verdad

`packages/design-tokens/tokens.json`. Se regenera con:

```
npm run gen:tokens        # tokens.css + src/generated.ts
```

`verificar.sh` falla si los generados quedan fuera de sync.

### Consumo

| Plataforma | Cómo |
|---|---|
| Web (Next + Tailwind v4) | `@import "@bitacora/design-tokens/tokens.css"` en `globals.css`. Utilidades con prefijo **`ds-`** (para no chocar con Faena durante la migración): `bg-ds-bg`, `bg-ds-surface`, `bg-ds-accent-200`, `text-ds-accent-800`, `text-ds-h1`, `rounded-ds-pill`, `rounded-ds-lg`, `shadow-ds-md`, `font-ds-heading`, `border-ds-divider`, `p-ds-4`, `bg-ds-brand`, `hover:bg-ds-brand-hover`… Cuando Faena se retire, un sweep quita el prefijo. |
| Expo / RN / TS | `import { tokens, fontStack, oscurecerOklch } from "@bitacora/design-tokens"`. En mobile: `useTema().ds` (`.ds.marca`, `.ds.color`, `.ds.size`, `.ds.radius`…). |

## Paleta

Crema `#f5ead8` (bg) · `#ebddc5` (surface) · `#201e1d` (text) ·
`#c67139` (accent) · `#7a8a5e` (accent2) · divider `rgba(32,30,29,.16)`.

Tres rampas de 9 pasos: `neutral`, `accent` (cálida), `accent2` (oliva).
- **100–300**: rellenos tenues, hovers, bordes suaves.
- **500**: base del rol.
- **700–900**: **texto sobre esos rellenos tenues** y estados presionados.
- Para texto chico en acento sobre el crema: **`accent-700`**, nunca `accent`.

## Marca por tenant (Paso 2 — hecho)

`--ds-brand` = `empresas.color_primario`. Reemplaza al acento en botones
primarios, nav activa, focus ring, badges de acción y FAB de mobile. Todo
lo demás es igual para todos los tenants.

- **Web:** `DashboardShell` pone `--ds-brand` y `--ds-brand-foreground` (de
  `color_primario` / `color_primario_foreground`) como custom properties en
  el wrapper del dashboard. `--ds-brand-hover` / `--ds-brand-pressed` se
  derivan solos: `tokens.css` los define como
  `oklch(from var(--ds-brand) calc(l - 0.05|0.11) c h)`, que se re-resuelve
  en el scope del wrapper. Fallback (login, sin tenant): `--ds-brand` = acento.
  - *Nota de arquitectura:* el prompt pedía inyectarlo desde el layout del
    servidor. La web de Bitácora no tiene resolución de tenant en el
    servidor (sin `@supabase/ssr`, sin middleware; todo el dashboard es
    cliente y bloquea el render hasta cargar `/api/me`). Ponerlo en el
    shell cliente no produce FOUC porque nada se pinta antes de tener la
    empresa. Migrar a SSR sería un cambio de arquitectura (fuera de alcance).
- **Mobile:** `ThemeProvider` resuelve `tema.ds.marca` = `{ base, hover,
  pressed, foreground }` desde `App.tsx` (que ya pasaba la `marca`).
  `hover`/`pressed` con `oscurecerOklch()` (OKLab en JS puro, en
  `@bitacora/design-tokens`, con tests). Fallback `#c67139`.

## Anti-degradación (parcial — resto en Paso 7)

`scripts/check-colores.mjs` (en `verificar.sh`): falla si aparecen colores
literales (`#hex`, `rgb()`) en `web/src` / `mobile/src` / `packages/shared`
fuera del paquete de tokens. Baseline actual **19** (literales de pantallas
Faena que se van con la migración). Exentos con motivo en
`scripts/colores-permitidos.json` (paletas de datos, previews de PDF, SVG).

## Tipografía (Paso 3 — pendiente)

Headings + CTA grandes: **Caprasimo** 400. Resto de la UI: **Figtree** 15px.

## Estado de la migración

| Paso | Estado |
|---|---|
| 0 — Auditoría | ✅ `docs/design-audit.md` |
| 1 — `packages/design-tokens` | ✅ paquete + generadores + consumo web/mobile (namespace `ds-`) |
| 2 — Marca por tenant | ✅ `--ds-brand` en shell web + `tema.ds.marca` en mobile + derivación OKLCH + check anti-hex |
| 3 — Tipografía | ⬜ |
| 4 — `packages/ui` (primitivas) | ⬜ |
| 5 — Reglas transversales | ⬜ |
| 6 — Migración pantalla por pantalla | ⬜ |
| 7 — Anti-degradación (ESLint, Storybook, CI) | ⬜ |

Durante la migración, el bloque "Faena" de `globals.css` y los tokens nuevos
**conviven**. El bloque viejo se retira cuando todas las pantallas usen los
tokens nuevos.
