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

## Tipografía (Paso 3 — hecho)

- **Caprasimo** 400 — voz display: SOLO titulares y botones grandes (`size lg`),
  nunca párrafos. `line-height 1.12`, `letter-spacing -0.015em`.
- **Figtree** — toda la UI. 15px base, `line-height 1.55`. Pesos 400/500/600/700.
- **Web:** `next/font/google` self-hosted, `display: swap`, en `layout.tsx`
  como `--font-caprasimo` / `--font-figtree`. `tokens.css` los referencia en
  `--font-ds-heading` / `--font-ds-body` (con el literal de fallback).
  Utilidades: `font-ds-heading` / `font-ds-body`, más `ds-heading` (familia +
  peso + leading + tracking) y `ds-body` (familia + 15px + leading), a
  combinar con `text-ds-h1…h5`. IBM Plex (Faena) sigue cargado hasta que
  migren todas las pantallas.
- **Mobile:** `@expo-google-fonts/caprasimo` + `.../figtree`, precargadas en
  `App.tsx` con `useFonts({ ...fuentesFaena, ...fuentesDS })` — nada se pinta
  hasta que están listas, sin salto de fuente. `useTema().ds.font` =
  `{ heading, body, bodyMedium, bodySemiBold, bodyBold }` (nombres RN).
  `ds.headingLeading` (1.12) y `ds.headingTracking` (-0.015).

## Estado de la migración

| Paso | Estado |
|---|---|
| 0 — Auditoría | ✅ `docs/design-audit.md` |
| 1 — `packages/design-tokens` | ✅ paquete + generadores + consumo web/mobile (namespace `ds-`) |
| 2 — Marca por tenant | ✅ `--ds-brand` en shell web + `tema.ds.marca` en mobile + derivación OKLCH + check anti-hex |
| 3 — Tipografía | ✅ Caprasimo + Figtree self-hosted (next/font + expo-font), `ds-heading`/`ds-body`, precarga sin salto |
| 4 — `packages/ui` (primitivas) | ✅ 12 primitivas (ver arriba) |
| 5 — Reglas transversales | ✅ (ver abajo) |
| 6 — Migración pantalla por pantalla | ⬜ |
| 7 — Anti-degradación (ESLint, Storybook, CI) | ⬜ |

Durante la migración, el bloque "Faena" de `globals.css` y los tokens nuevos
**conviven**. El bloque viejo se retira cuando todas las pantallas usen los
tokens nuevos.

## `packages/ui` — primitivas (Paso 4)

API única en español, definida en `packages/ui/src/tipos.ts`; una
implementación en `src/web` (Tailwind, exporta `@bitacora/ui/web`) y otra en
`src/native` (RN, exporta `@bitacora/ui/native`). Sin build: web lo transpila
Next (`transpilePackages`), mobile lo transpila Metro (ya observa el
workspace root).

- **`Button`** ✅ — `variante` (primario/secundario/ghost/peligro) ×
  `tamano` (sm 36 · md 44 · lg 52 web; sm 44 · md 48 · lg 52 mobile — nunca
  bajo 44). Todo pill. `primario` = `--ds-brand` (+ hover/pressed OKLCH).
  Caprasimo **solo en `lg`**; sm/md en Figtree bold/semibold. Mobile resuelve
  la marca vía `ProveedorMarca` (`packages/ui/src/native/marca.tsx`) —
  mismo `color_primario` que le llega a `ThemeProvider` (ver `App.tsx`).
  Nombres de familia RN centralizados en `packages/ui/src/native/fuentes.ts`
  (`FUENTE_NATIVE`); `mobile/src/theme/fuentes.ts` los reexporta como
  `FUENTE_DS` para no duplicarlos.
- **`Input` / `Textarea` / `Select` / `DatePicker`** ✅ — mismo look de
  campo (pill en Input/Select, `radius.md` en Textarea; fondo `surface`,
  borde `divider`/`accent-700` en error, `caret-color` en la marca; label
  12px al 70%, error en `accent-700`, ayuda al 60%). `Select` nativo es una
  hoja simple (sin buscador — para eso quedan los `Selector*` propios de la
  app). `DatePicker` nativo reusa el patrón ya establecido en
  `SelectorHora.tsx` (Android: diálogo nativo; iOS: modal propio con
  Listo/Cancelar), con `@react-native-community/datetimepicker` (ya era dep).
- **`Card`** ✅ — fondo `surface`, `border-radius: 32px` (`radius.lg × 1.15`,
  no es un token de `tokens.json` — ver `RADIO_CARD`), `elevacion?`
  sm/md/lg opcional (`shadow-ds-*` en web, shadow+elevation en RN). Sin
  bordes de 1px decorativos.
- **`Tag`** ✅ — pill, 11px, `tracking 0.02em`. Tonos `accent`/`accent2`/
  `neutral`/`outline`. De uso libre (roles, prioridad, canal…).
- **`StatusBadge`** ✅ — **un solo mapa** `estado → tono` en
  `packages/ui/src/tipos.ts` (`MAPA_ESTADO_TONO`), consolidando lo que
  antes estaba repetido en 5 lugares (ver `docs/design-audit.md` §3). Solo
  4 tonos fijos: `en_progreso` (accentRamp.200/800), `completado`
  (accent2Ramp.200/800), `cerrado` (neutral.300/900), `cancelado`
  (neutral.200/700). **Alcance deliberado:** solo entran estados de ciclo
  de vida que caen sin forzar en uno de los 4 — roles/prioridad/canal
  siguen siendo `<Tag>`, y un estado ambiguo (`pendiente`, `borrador`) usa
  `tonoForzado` en el call-site en vez de adivinar. Terminar de mapear
  cada estado real de cada pantalla es trabajo del Paso 6.
- **`Skeleton` / `LoadingState` / `EmptyState` / `ErrorState`** ✅ — nunca
  spinner de pantalla completa: `LoadingState` son esqueletos (`Skeleton`
  pulsante en `neutral.200`, 3 líneas genéricas por defecto o `children` a
  medida del contenido real). `EmptyState`: círculo 64px `accent2Ramp.200`
  + título en `ds-heading` + frase + `accion` (CTA). `ErrorState`: círculo
  `accentRamp.200` + botón Reintentar — el **texto** (red vs. permiso) y
  que reintentar conserve filtros quedan a cargo de quien llama, no del
  primitivo.
- **`Table`** ✅ (solo web — mobile usa listas/cards). Header 11px
  mayúscula `tracking-[0.08em]` color `text/60`, borde inferior `divider`.
  Filas con borde `text/[0.08]`, hover `text/[0.04]`. Sin zebra. Compone
  `Loading/Empty/ErrorState` internamente (`cargando`/`error`/`vacio` props).
- **`Dialog`** ✅ — backdrop `neutral.900/50`, contenedor `radius.lg × 1.15`
  (32px), `shadow.lg`. Web: modal centrado. Mobile: **siempre** bottom
  sheet (no hay variante centrada) — mismo backdrop/radio/sombra, deslizado
  desde abajo.
- **`Toast`** ✅ — `ToastProvider` + `useToast()` (contexto). Pill oscuro
  `neutral.900` / texto `neutral.100`, abajo y centrado, 2.6s. Montar
  `ToastProvider` una vez en la raíz de cada plataforma.

**Paso 4 completo — las 12 primitivas del prompt están hechas** (`Button`,
`Input`, `Textarea`, `Select`, `DatePicker`, `Card`, `Tag`, `StatusBadge`,
`Skeleton`+`LoadingState`+`EmptyState`+`ErrorState`, `Table`, `Dialog`,
`Toast`). Ninguna pantalla las usa todavía — eso es el Paso 6.

## Paso 5 — Reglas transversales

- **Forma/Aire:** ya cumplido por construcción en las 12 primitivas (pill,
  28-32px, escala `space`, sin bordes de 1px decorativos).
- **Iconos:** agregado **Lucide** (`lucide-react` web, `lucide-react-native`
  mobile — ya había `react-native-svg`, no se agregó nada más). `Dialog`
  (web+native) y `Select` (web+native) migrados de glifos a mano
  (`✕`, `▾`, un SVG propio) a `X`/`ChevronDown` de Lucide, `strokeWidth={2.75}`.
- **Estados interactivos:** `focus-visible` con el outline de marca ya en
  Button/Input/Textarea/Select/DatePicker/Card(botón)/Dialog. Mobile no
  tiene "hover" (no aplica); `pressed` vía `Pressable` ya en todos.
- **Touch targets:** ya 44px mínimo en todos los campos/botones mobile.
- **`tabular-nums`:** nueva primitiva **`Cifra`** (web: clase `tabular-nums`;
  native: `fontVariant: ["tabular-nums"]`) para montos/cantidades/fechas/folios.
- **Helper de CLP único:** `formatearCLP()` en `packages/shared/src/dinero.ts`
  (con 5 tests) — `web/lib/formatMoneda.ts` y `mobile/lib/plata.ts` ahora
  **delegan** ahí para CLP (verificado: mismo resultado exacto que antes,
  cero cambio visible; el resto de monedas sigue con `Intl` en web).
- **Contraste — hallazgo, sin resolver:** el color de marca por defecto
  (`accent` `#c67139`, cuando el tenant no fija `color_primario`) da
  **3.61:1** de contraste con texto blanco — no llega a 4.5:1 (WCAG AA
  texto normal). Texto oscuro tampoco sirve: empeora en `hover`/`pressed`
  (3.70 → 2.44) mientras que blanco mejora (3.61 → 4.49 → 6.81). No hay un
  solo foreground que cumpla 4.5:1 en los 3 estados con ese hex exacto, y
  no puedo inventar un color fuera de `tokens.json`. Como es solo el
  *fallback* (un tenant real normalmente fija su propio
  `color_primario_foreground`), lo dejo documentado en vez de improvisar
  — **tu decisión** si esto amerita revisar el token `accent` o aceptar el
  fallback como está.

Verificado: tsc `ui`/`mobile`/`web` verde, `packages/shared` 22 tests
(17+5 nuevos de `dinero.test.ts`), Tailwind CLI compiló `tabular-nums`.
`./verificar.sh` verde, 19 literales (baseline, sin cambios).
