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
| Web (Next + Tailwind v4) | `@import "@bitacora/design-tokens/tokens.css"` en `globals.css` → habilita utilidades `bg-bg`, `bg-surface`, `bg-accent-200`, `text-accent-800`, `text-h1`, `rounded-pill`, `rounded-lg`, `shadow-md`, `font-heading`, `font-body`, `border-divider`, `p-4` (espaciado 4.4·n)… |
| Expo / RN / TS | `import { tokens, fontStack } from "@bitacora/design-tokens"` |

## Paleta

Crema `#f5ead8` (bg) · `#ebddc5` (surface) · `#201e1d` (text) ·
`#c67139` (accent) · `#7a8a5e` (accent2) · divider `rgba(32,30,29,.16)`.

Tres rampas de 9 pasos: `neutral`, `accent` (cálida), `accent2` (oliva).
- **100–300**: rellenos tenues, hovers, bordes suaves.
- **500**: base del rol.
- **700–900**: **texto sobre esos rellenos tenues** y estados presionados.
- Para texto chico en acento sobre el crema: **`accent-700`**, nunca `accent`.

## Marca por tenant (Paso 2 — pendiente)

`--brand` = `empresas.color_primario`, inyectado en `<html>` desde el layout
server (web) y expuesto por `ThemeProvider` (mobile, fallback `#c67139`).
Reemplaza al acento en: botones primarios, nav activa, focus ring, badges de
acción, FAB de mobile. Todo lo demás es igual para todos los tenants.

## Tipografía (Paso 3 — pendiente)

Headings + CTA grandes: **Caprasimo** 400. Resto de la UI: **Figtree** 15px.

## Estado de la migración

| Paso | Estado |
|---|---|
| 0 — Auditoría | ✅ `docs/design-audit.md` |
| 1 — `packages/design-tokens` | ✅ paquete + generadores + consumo web/mobile habilitado |
| 2 — Marca por tenant | ⬜ |
| 3 — Tipografía | ⬜ |
| 4 — `packages/ui` (primitivas) | ⬜ |
| 5 — Reglas transversales | ⬜ |
| 6 — Migración pantalla por pantalla | ⬜ |
| 7 — Anti-degradación (ESLint, Storybook, CI) | ⬜ |

Durante la migración, el bloque "Faena" de `globals.css` y los tokens nuevos
**conviven**. El bloque viejo se retira cuando todas las pantallas usen los
tokens nuevos.
