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

## `packages/ui` — primitivas (Paso 4 — completo)

API única en español, definida en `packages/ui/src/tipos.ts`; una
implementación en `src/web` (Tailwind, exporta `@bitacora/ui/web`) y otra en
`src/native` (RN, exporta `@bitacora/ui/native`). Sin build: web lo transpila
Next (`transpilePackages`), mobile lo transpila Metro (ya observa el
workspace root).

- **`Button`** — `variante` (primario/secundario/ghost/peligro) × `tamano`
  (sm 36 · md 44 · lg 52 web; sm 44 · md 48 · lg 52 mobile — nunca bajo 44).
  Todo pill. `primario` = `--ds-brand` (+ hover/pressed OKLCH). Caprasimo
  **solo en `lg`**; sm/md en Figtree bold/semibold.
- **`Input` / `Textarea` / `Select` / `DatePicker`** — mismo look de campo
  (pill en Input/Select, `radius.md` en Textarea). `Select` nativo: hoja
  modal simple. `DatePicker` nativo reusa el patrón de `SelectorHora.tsx`.
  Extendido en el Paso 6 (migrando Login) con `tipo="codigo"` (OTP,
  `inputMode=numeric` sin las flechas de `type=number`), `maxLongitud`,
  `minLongitud`, `requerido` — huecos reales encontrados al migrar la
  primera pantalla de verdad, no inventados de antemano.
- **`Card`** — 32px (`radius.lg × 1.15`, `RADIO_CARD`), elevación opcional.
- **`Tag`** — pill 11px, 4 tonos de uso libre.
- **`StatusBadge`** — un solo mapa `estado → tono` (`MAPA_ESTADO_TONO`),
  consolida los 5 que estaban duplicados en el audit. Solo 4 tonos fijos;
  roles/prioridad/canal siguen siendo `<Tag>`.
- **`Skeleton`/`LoadingState`/`EmptyState`/`ErrorState`** — nunca spinner de
  pantalla completa.
- **`Table`** (solo web) — header 11px mayúscula, sin zebra.
- **`Dialog`** — web modal centrado; mobile **siempre** bottom sheet.
- **`Toast`** — `ToastProvider`+`useToast()`, pill oscuro, 2.6s.
- **`Cifra`** — `tabular-nums`.

## Reglas transversales (Paso 5 — completo)

- **Lucide** en ambas plataformas (`lucide-react`/`lucide-react-native`),
  `strokeWidth={2.75}`. `Dialog`/`Select` migrados de glifos a mano a
  `X`/`ChevronDown`.
- **`formatearCLP()`** único en `packages/shared/src/dinero.ts` (5 tests);
  `web/lib/formatMoneda.ts` y `mobile/lib/plata.ts` delegan ahí para CLP.
- **Contraste — decisión 2026-09-10:** el `accent` default (#c67139) da
  3.61:1 con blanco (bajo AA 4.5:1) en el botón primario sin tenant. Se
  acepta el fallback tal como está — solo afecta el estado sin tenant.

## Paso 6 — Migración pantalla por pantalla (en curso)

### Bucket 1 — Login y selección de empresa (web) ✅

`web/src/components/AuthLayout.tsx` (shell compartido) +
`web/src/app/{login,registro,invitacion,onboarding}/page.tsx`. Las 4
comparten `AuthLayout`, así que migrarlo de forma aislada solo a Login
hubiera dejado registro/invitacion/onboarding con el Card nuevo por fuera
y los campos Faena por dentro — se migraron las 4 juntas.

**Bug real encontrado corriendo `next dev` de verdad** (no lo agarró
tsc ni el CLI de Tailwind en los Pasos 1-5): `campo.ts` tenía
`outline-none focus-visible:outline-2 …`. En Tailwind v4 `outline-none`
fija `--tw-outline-style: none` de forma incondicional; como
`focus-visible:outline-2` solo pone el ancho (lee la misma variable), el
foco quedaba **sin outline visible nunca**. Se sacó el `outline-none` —
confirmado con captura de pantalla que el anillo de foco aparece.

Verificado con capturas reales (`next dev`, no solo compilación):
`/login`, `/registro` — Caprasimo en el título, pill en inputs/botón,
foco con anillo de marca, card con sombra. `/onboarding` y `/invitacion`
verificados por tsc + mismo patrón de primitivas (necesitan sesión activa
para renderizar, no se pudieron capturar en vivo sin login).

Primitivas extendidas en el camino (huecos reales, no inventados):
`Input.tipo="codigo"` (OTP), `maxLongitud`, `minLongitud`, `requerido`.

### Bucket 1 — Login y selección de empresa (mobile) ✅

`LoginScreen`, `Verify2faScreen`, `SinEmpresaScreen`, `MfaRequeridoScreen` —
las 4 pantallas del flujo de auth de mobile. Nuevo `PantallaAuth.tsx`
(análogo a `AuthLayout` en web): deliberadamente **no reusa**
`components/ui/Screen.tsx` (shell de las ~50 pantallas de la app — tocar
su fondo habría recoloreado todo Faena de una).

Íconos: `Ionicons` → Lucide (`UserX`, `ShieldCheck`), mismo criterio del
Paso 5.

Primitivas extendidas (huecos reales de un formulario nativo real, no
inventados): `Input.autoCapitalizar`, `Input.onSubmit` (encadena
"siguiente"/"ir" del teclado — RN no tiene submit de formulario como el
navegador), `textContentType` por `tipo` (autofill de iOS).

**Bug preexistente arreglado** (a pedido de la usuaria, mismo día):
`mobile/src/lib/fotoCola.ts` construía un `Directory` de
`expo-file-system` (API `Directory`/`Paths`) en el nivel superior del
módulo, sin soporte en web (`this.validatePath is not a function`) —
crasheaba `expo start --web` antes de montar React, en CUALQUIER
pantalla (el módulo lo carga `services/sync/queue.ts`, que carga con
toda la app). Se agregó un guard `Platform.OS === "web"`: en iOS/Android
el comportamiento es idéntico a antes; en web las funciones de la cola de
fotos offline son no-op (no aplica ahí — no hay cámara ni filesystem
persistente real). Con esto **`expo start --web` funciona por primera
vez**, lo que habilitó verificación visual real (screenshot) para Login.

**Verificado con capturas reales** (`expo start --web` + Chrome vía MCP):
Login en mobile — crema, Caprasimo, pill, botón deshabilitado en 45%
opacidad hasta llenar los 2 campos, luego full-color. Coincide
visualmente con la versión web.

**Seam conocido, deliberado:** el ícono de marca (`LogoMark`/`Logo`, web y
mobile) sigue en navy Faena (`--brand`/`t.colores.brand`) en vez del
acento nuevo — se usa también en `DashboardShell`/`SuperAdminShell`/
`PortalShell` (mobile: `BloqueoBiometrico`), shells que no están en este
bucket. Migrarlo ahora habría recoloreado el logo en pantallas Faena
sin tocarlas. Se migra cuando le toque a esas pantallas.

### Resto del orden del prompt

2) Hoy/dashboard · 3) Órdenes de servicio (listado+ficha) · 4) Clientes ·
5) Catálogo y stock · 6) Configuración · 7) resto — pendientes.
