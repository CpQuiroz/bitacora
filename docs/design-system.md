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

### Bucket 2 — Hoy / dashboard ✅

**Decisión de alcance (no pedí confirmación porque encaja en la regla ya
establecida en el bucket 1, solo a mayor escala):** `dashboard/page.tsx`
(web) renderiza dentro de `DashboardShell`, que usan ~38 pantallas más —
y `HoyScreen` (mobile) corre dentro del header de `HoyStack`, compartido
con 2 pantallas más. Migrar el **shell completo** ahora habría
recoloreado toda la app de una. Se migró solo el **contenido de la
página/pantalla** en los dos casos:

- Web: `dashboard/page.tsx` — saludo, accesos rápidos (`Button`), selector
  de período (`Select` + `DatePicker` para el rango personalizado — antes
  `<input type=date>` a mano), tarjetas KPI (`Card` + `Cifra` nueva,
  `tabular-nums`), estados vacío/error/carga (`LoadingState`+`Skeleton`),
  accesos de abajo. Íconos → Lucide.
  - **Seam conocido:** `GraficoIngresos`/`GraficoDistribucion` (Recharts)
    son compartidos con Informes → Visión General — siguen leyendo
    `var(--success)` etc. de Faena, ahora **dentro** de una `Card` ya
    migrada. `DashboardShell` (sidebar/header) también sigue Faena.
- Mobile: `HoyScreen.tsx` + header de `HoyStack.tsx` (solo afecta
  `HoyInicio`/`Asistente`, los stacks anidados tienen su propio
  `screenOptions`) — `Card`/`StatusBadge`/`EmptyState`/`ErrorState`/
  `LoadingState`+`Skeleton`. Ionicons → Lucide. `MAPA_ESTADO_TONO` +
  `cancelada_anticipada` (síntesis clara → cancelado); los estados
  genuinamente ambiguos de esta pantalla (`pendiente`, `enviada`,
  `borrador`, `facturado`) quedan sin mapear a propósito — caen al
  neutral `cerrado` por defecto (el sistema nuevo solo define 4 tonos,
  no hay un 5to "alerta" como en Faena).

Verificado por `tsc` (ambas plataformas) + compilación real de Tailwind
para la página web (clases + valores). **Sin captura en vivo** — ninguna
de las dos pantallas se puede ver sin una sesión autenticada real, y no
tengo credenciales para loguearme (ni las pediría: entrar con una cuenta
no es algo que deba hacer sin que la usuaria lo autorice). Mismo
criterio que `onboarding`/`invitacion` en el bucket 1.

### Bucket 3 — Órdenes de servicio (listado + ficha) ✅

**Web (listado + ficha): ✅.** `ordenes/page.tsx` y `ordenes/[id]/page.tsx`
migradas completas. Primero se extendió `Table` (`encabezado: ReactNode`
para el checkbox "seleccionar todas"; `onFilaClick` para navegar al
detalle) e `Input` (`tipo="hora"`, `maxLongitud`/`minLongitud`/`requerido`
ya del bucket 1). Se retokenizaron 3 widgets compartidos de bajo riesgo
(atómicos, no shells): `Combobox.tsx`, `ComboboxResponsable.tsx`,
`InputMonto.tsx` — los usan otras pantallas no migradas, que ahora ven
ese control puntual con la paleta nueva (mismo tipo de seam que ya
documentamos, solo que en la dirección inversa: control nuevo dentro de
pantalla vieja).
**Seam conocido:** `CatalogoSelectorModal` (compartido con Catálogo y
Cotizaciones — 5 pantallas) queda Faena, embebido en el modo edición
ya migrado.

**Mobile: listado ✅, ficha pendiente.** `TrabajosScreen.tsx` +
`TrabajosStack.tsx` (solo header). Botón "Continuar" pasó de la variante
Faena `acento` (naranja fijo) a `primario` — el sistema nuevo no separa
"marca" de "acción de terreno", el brand del tenant ES el acento.
**Seam conocido:** `TrabajosMapa.tsx` (vista de mapa) sigue Faena.

**Mobile ficha: ✅.** `TrabajoDetalleScreen.tsx` + sus 3 componentes de uso
exclusivo (`CamposDinamicos.tsx`, `FotosSection.tsx`, `CierreFirma.tsx` —
verifiqué que ningún otro archivo los importa, cero riesgo de blast
radius). El bloque de foco (check-in) pasó de `t.colores.brand` (navy
fijo) a `marca.base` (tenant); mismo criterio que el header de
`TrabajosScreen`. Banner de "finalizado" pasó de verde Faena a
`accent2Ramp` (el sistema nuevo no tiene un tono "éxito" separado del
accent2). Ionicons → Lucide en los 4 archivos.

Extendí `Input`/`Textarea` en el camino: `Textarea` reemplaza al
`Input multiline` que no existía en el contrato nuevo (el campo de
observación del cierre de firma lo necesitaba).

Verificado: tsc limpio en los 4 archivos + `expo start --web` carga y
monta el árbol de navegación completo (incluye `TrabajosStack`/`HoyStack`
con las pantallas migradas) sin errores de consola — buena señal de que
los imports de Lucide/primitivas están bien resueltos, aunque no pude
navegar hasta la ficha en sí sin una sesión autenticada real.

`scripts/check-colores.mjs`: BASELINE 18→15 (bajó solo, tres literales
menos: los `rgba()` de scrims/divisores que reemplacé por tokens).

**Bucket 3 completo.**

### Bug real: contraste roto en dark mode (encontrado y corregido)

La usuaria reportó texto ilegible en `/dashboard/ordenes` (texto claro
sobre fondo crema en la tabla, título casi invisible) y trajo un prompt
que pedía abandonar crema y volver a un tema único navy/azul. Antes de
tocar nada, diagnostiqué en vivo (Chrome MCP + `getComputedStyle`) con
la sesión real de la usuaria: **no era un problema de la dirección
crema, era un bug de herencia de color con Faena en dark mode.**

Causa raíz (dos formas del mismo problema):

1. `Card`/`Table` no fijaban `color` propio → el texto heredaba el
   `--foreground` ambiente, que Faena invierte con
   `@media (prefers-color-scheme: dark)`. Con el navegador/OS en modo
   oscuro, esa herencia daba texto claro (`#eef1f4`) sobre `bg-ds-surface`
   (crema) — ilegible. Confirmado con `window.matchMedia(...).matches`
   → `true` en la sesión real.
2. El título y las etiquetas que están fuera de cualquier `Card` (el
   header de la página) se pintan directo sobre el fondo de
   `DashboardShell` (`mx-auto max-w-6xl px-6 py-10`, todavía Faena) —
   con texto `text-ds-text` fijo oscuro. En dark mode ese fondo también
   se invierte a navy oscuro → texto oscuro sobre navy oscuro,
   igualmente ilegible (por eso el título se veía "casi invisible" aun
   con su color computado correcto).

Fix aplicado (sin tocar `DashboardShell` ni rutas/lógica):

- `Card.tsx`: agregado `text-ds-text` explícito a la clase base — cubre
  también a `Table` (que renderiza dentro de un `Card`).
- Las 3 páginas migradas de momento (`dashboard/page.tsx`,
  `dashboard/ordenes/page.tsx`, `dashboard/ordenes/[id]/page.tsx`):
  el contenido que pasa como `children` de `DashboardShell` ahora va
  envuelto en un panel propio (`rounded-[32px] bg-ds-bg p-ds-6
  text-ds-text`) — mismo patrón que ya usa `AuthLayout` para Login
  (fondo `ds-bg` explícito en su wrapper más externo), aplicado acá al
  área de contenido en vez de a toda la pantalla. Así ninguna pantalla
  migrada depende de qué fondo tenga Faena alrededor (claro u oscuro).
  `Dialog` queda afuera del panel (es un overlay, no contenido de
  página).

Verificado en vivo (Chrome MCP, sesión real de la usuaria) en las 3
pantallas: tabla, filtros, título, ficha de OS y KPIs del dashboard —
todo legible, un solo panel crema continuo, naranja aislado a las CTAs
("Nueva OS", "Actualizar"). `./verificar.sh` en verde, sin literales
nuevos.

Pendiente de decisión de la usuaria: si migrar `DashboardShell` mismo
(el seam de siempre) para que el "gutter" alrededor del panel deje de
depender del dark mode de Faena también — hoy sigue siendo Faena
(sidebar/header), a propósito, fuera del alcance de este bucket.

**Actualización — la usuaria pidió migrar la shell y homologar todo.**

`DashboardShell.tsx` migrado completo: íconos propios (`./icons`,
SVG a mano) → `lucide-react` (mismo set que ya usan las páginas
migradas); clases Faena (`bg-background`, `bg-surface`,
`text-foreground`, `text-muted`, `border-border`, `bg-brand`,
`bg-brand-soft`, `bg-danger`, el literal `amber-500` del banner de
consentimiento) → tokens `ds-` (`bg-ds-bg`, `bg-ds-surface`,
`text-ds-text`, `border-ds-divider`, `bg-ds-brand`, `hover:bg-ds-brand/
[0.08]`). Sin tono "danger" propio en la paleta nueva: se reusa
`accent-700/800` (mismo criterio que `Button` variante `peligro` y
`Table` tono `peligro`) para impersonación, y `accent2-700` (informativo,
no alarmante) para el banner de consentimiento — cero literales nuevos.

Con la shell migrada, el panel `bg-ds-bg` que envolvía manualmente el
contenido de las 3 páginas del bucket 3 quedó redundante (el canvas de
`DashboardShell` ya es `bg-ds-bg` fijo, no depende más de Faena/dark
mode) — se retiró de las 3 páginas.

**Alcance real descubierto:** además de las páginas de
`web/src/app/dashboard/**` (71 archivos sin migrar), hay un shared
`web/src/components/ui.tsx` ("Faena", API en inglés: `variant`,
`onChange` nativo) importado por **87 archivos** — no es un simple
alias, cada página que lo usa tiene que reescribir su JSX contra la
API nueva (española: `variante`, `onPress`, `onCambio`, `valor`),
igual que se hizo en los buckets 1-3. Se sigue con el resto en el mismo
ritmo de un bucket a la vez, comiteando y verificando en cada uno.

### "Homologar todo" — Operación (resto) ✅

Cierra el grupo de nav "Operación" (Agenda queda para su propio bucket
más adelante — usa `DataTable`/`EstadoCitaRiel`, todavía sin migrar):
`rutas/page.tsx`, `rutas/nueva/page.tsx`, `rutas/[id]/page.tsx`,
`viajes/page.tsx`.

Gaps de primitivos reales encontrados (documentados, no inventados
por archivo):
- `Input` (ds-) no tiene `tipo="fecha"` — se usa un `<input type="date">`
  nativo con las mismas clases visuales (helper `FechaCampo`/
  `DatePickerCampo` en cada archivo) en vez de forzar `DatePicker`
  (que trabaja con `Date`, no con el string `YYYY-MM-DD` que ya viaja
  tal cual al backend en estos forms).
- `Textarea` (ds-) no tiene `requerido` (`Input` sí) — se sacó el
  atributo nativo en el único call-site que lo pedía; la validación
  real ya vive en el handler del submit.
- Tabla de `viajes` tiene una fila de edición inline expandible (2do
  `<tr>` con un form completo) — `<Table>` no soporta filas
  expandibles, sigue siendo un `<table>` a mano con las mismas clases
  que usa `<Table>` internamente (mismo criterio que ya se documentó
  para casos así).

Componentes compartidos (fuera de `packages/ui`) migrados de paso,
por su alcance (no son parte de un bucket de páginas, dan leverage):
- `InputMonto.tsx`: ya estaba migrado (se encontró retokenizado a ds-
  de una sesión anterior).
- `Modal.tsx`: migrado ahora. No se reemplazó por `<Dialog>` (packages/ui)
  porque tiene tamaños `wide`/`xl` que `Dialog` no soporta (siempre
  `max-w-lg`) — mismo motivo que `InputMonto` no usa `<Input>`. 7
  archivos dependen de él, todos se benefician sin tocarlos.
- `MapaRutas.tsx`: los pines (Leaflet `divIcon`, HTML insertado al
  DOM) pasaron de colores fijos a `var(--ds-brand)`/`var(--ds-text)`
  — ahora respetan la marca del tenant. La polilínea (Leaflet puede
  usar canvas, que no resuelve `var()`) lee `--ds-brand` con
  `getComputedStyle` en vez de un literal fijo. Ya estaba exento del
  chequeo de literales (`scripts/colores-permitidos.json`) — sigue
  exento, ahora con menos literales igual.

### "Homologar todo" — grupo de nav "Clientes" ✅

`registros/clientes/page.tsx`, `registros/clientes/[id]/page.tsx`,
`agenda/paquetes/page.tsx`, `portal-cliente/page.tsx`.

- `AsignarPackForm.tsx` (compartido entre `paquetes` y la ficha del
  cliente) migrado de paso — mismo criterio que `Modal.tsx` en el
  bucket anterior.
- `SinAutorizacion` (ui.tsx, solo 2 usos) no se migró como export
  compartido — se inlineó con `<Card>` directo en `portal-cliente`
  (y se hace lo mismo en el otro call-site cuando le toque).
- Gap real: `Input` (ds-) no tiene `onBlur` (solo `onSubmit`, que
  dispara con Enter) — se pierde el auto-formateo de RUT "al salir
  del campo"; la validación real (`validarRut`) sigue intacta en el
  submit del form. El formateo (`formatearRut`) se aplica una vez,
  al armar el body del POST/PATCH, no en cada tecla (evita que el
  cursor salte mientras se escribe).

### "Homologar todo" — grupo de nav "Dinero" ✅

Cotizaciones (arriba) + `financiero/cobros/page.tsx`, `[id]/page.tsx`,
`gastos/page.tsx`, `[id]/page.tsx`, `remuneraciones/page.tsx`, `[id]/
page.tsx`, `parametros/page.tsx` (`datos-laborales/page.tsx` es un
redirect puro, sin UI).

Componentes compartidos migrados de paso en este grupo:
- `PanelAcciones.tsx`, `ComboboxCliente.tsx`, `ComboboxEquipo.tsx`,
  `SelectCrear.tsx` — mismo criterio que buckets anteriores.
  `Combobox.tsx`/`ComboboxResponsable.tsx` ya estaban migrados.
- **`Stat.tsx` (nuevo, `web/src/components`)**: KPI chico (etiqueta +
  número + nota), migrado desde `ui.tsx`. No es de `packages/ui`
  (layout de KPI específico de web). Lo usan 8 archivos más
  (Informes, Inventario, dashboard de Equipos) — se actualizan
  cuando les toque su bucket, no hace falta tocarlos ahora.

Gaps reales de primitivos encontrados (documentados, no inventados
por archivo):
- `Cifra` (ds-) no acepta `className` — se envuelve en el elemento
  padre en vez de pasarle la clase directo.
- Sin tono "estado ambiguo" para "pendiente"/"borrador"/"emitida"
  (gastos, cobros, liquidaciones) — cada página fuerza el tono
  localmente (`TONO_FORZADO`/`TONO_ESTADO`), nunca inventando un 5°
  tono en el primitivo compartido.

`scripts/check-colores.mjs`: BASELINE 15→14 (bajó solo).

### "Homologar todo" — grupo de nav "Recursos" ✅

`registros/proveedores`, `registros/inventario`, `registros/catalogo`,
`registros/equipos` (listado + ficha + dashboard +
`RegistrosMantencion.tsx`, el formulario grande de checklist con
fotos).

- `DocumentoForm.tsx` migrado de paso (compartido con `perfil` y
  `personas/[id]`, que se actualizan cuando les toque su bucket).
- Gap real: `Select`/`Input` (ds-) no aceptan `id` — un `<label
  htmlFor>` externo (patrón de `DocumentoForm`) queda sin enlace
  programático al control. Impacto visual nulo, gap de accesibilidad
  real — documentado inline, no resuelto en el primitivo compartido
  sin discutirlo antes.
- `scripts/check-colores.mjs`: BASELINE 14→13 (bajó solo).

### "Homologar todo" — grupo de nav "Equipo" ✅

`personas/page.tsx`, `personas/[id]/page.tsx` (4 pestañas: identidad,
acceso y permisos, datos laborales, documentos), `flota/documentos-
por-vencer/page.tsx`.

- `DataTable.tsx` migrado de paso — usado por 8 archivos más (este,
  y 6 páginas de Configuración + `/superadmin`).
- **Efecto colateral encontrado y corregido:** `DataTable.tsx` y
  `Modal.tsx` (migrado en el commit de "Operación") también los usa
  `/superadmin`, un shell aparte (`SuperAdminShell`) fuera de los
  grupos de nav de `DashboardShell` — sin arreglarlo, esa pantalla
  habría quedado mezclando Faena y ds- en la misma vista. Se migró
  `SuperAdminShell.tsx` + `superadmin/page.tsx` (la que realmente usa
  ambos) para cerrar el hueco. Las otras 4 páginas de superadmin
  (`roles`, `resumen`, `cuenta`, `empresas/[id]` — este último solo,
  1447 líneas) quedan como seam nuevo: su contenido sigue en Faena,
  parado sobre un shell ya en ds-, mismo patrón transitorio que tuvo
  el dashboard principal entre el Paso 4 y el cierre de cada bucket.
- `scripts/check-colores.mjs`: BASELINE 13→12 (bajó solo).

### Resto del orden del prompt

6) Configuración · 7) resto — pendientes. Además, el pedido de la
usuaria de homologar TODO suma: Agenda (usa `DataTable`/
`EstadoCitaRiel`, sin migrar), Informes (9 páginas + charts) y las
~14 subpáginas de Configuración. `/superadmin` (roles/resumen/cuenta/
empresas[id]) queda como seam adicional, fuera del alcance original
del pedido (no es parte de la nav de `DashboardShell`).
