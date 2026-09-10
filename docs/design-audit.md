# Auditoría del sistema de diseño — Paso 0

> Generado 2026-09-09. Inventario del estado actual antes de implementar el
> sistema de tokens pedido. **No se tocó código.** Al final hay decisiones
> que necesito que confirmes antes de seguir al Paso 1.

---

## 0. Resumen ejecutivo

Bitácora **ya tiene un sistema de diseño**, llamado **"Faena"** (refresco
"1a", ~24-ago…07-sep, 2 semanas de trabajo, ~30 pantallas web + 11 commits
móvil). No estamos partiendo de cero: estamos ante un **cambio de dirección
visual completo** sobre un sistema que ya está tokenizado y adoptado.

| | Faena (hoy, en prod) | Lo que pide el prompt |
|---|---|---|
| Paleta | Azul tinta `#14314F` + naranja señal `#C2500F` + grises fríos | Crema `#f5ead8` + terracota `#c67139` + oliva `#7a8a5e` + rampas cálidas |
| Tipografía | IBM Plex Sans / IBM Plex Mono | Caprasimo (headings, **y botones**) / Figtree (cuerpo) |
| Forma | Esquina corta (radio 4-8px), borde firme de 1px, **sin sombras** | Todo pill (999px), contenedores 28-32px, sombras sm/md/lg |
| Multi-tenant | Per-tenant **retirado a propósito** (paleta fija, branding solo en el logo) | Color de empresa **reemplaza el acento** en primarios, nav activa, focus, FAB |
| Números | mono tabular (Plex Mono) | `tabular-nums` en Figtree |

**El grueso de la *arquitectura* que pide el prompt ya existe** (tokens,
primitivas, estados vacío/carga/error, mapa de estado→color). Lo que cambia
son **los valores** y la **unificación web/mobile en un paquete compartido**.

---

## 1. Estado actual del sistema

### 1.1 Web — Tailwind v4 con `@theme`

- **`web/src/app/globals.css`** — única fuente de tokens. `:root` define
  ~25 CSS custom properties (`--brand`, `--surface`, `--foreground`,
  `--accent`, `--danger`, `--radius-*`…), reexpuestas como utilidades
  Tailwind vía `@theme inline`. Tiene modo oscuro (`prefers-color-scheme`).
- **`web/src/components/ui.tsx`** (10 KB) — primitivas:
  `Button` (variants: primary/outline/ghost/danger/accent · sizes sm/md/lg ·
  alturas fijas h-8/h-10/h-12), `buttonClass()` helper para `<Link>`,
  `Input`, `Textarea`, `Select` (con chevron propio), `Label`, `Card`,
  `SectionTitle`, `Cifra`, `Stat`, `Aviso`/`ErrorText`/`SuccessText`/
  `WarningText`, `Badge` (mapa de ~70 estados → 5 tonos), `PageHeader`,
  `SinAutorizacion`.
- **`web/src/components/estados.tsx`** — `EstadoCargando` (spinner + label
  mono), `EstadoVacio` (icono + título + mensaje + acción),
  `EstadoError` (icono + mensaje + botón Reintentar).
- **`web/src/components/DataTable.tsx`** — tabla compartida (Card + thead
  mono mayúscula + filas con hover, sin zebra… salvo un `even:bg-[#fafbfc]`
  hardcodeado). Header 10px mayúscula `tracking-[0.1em]`.
- **`web/src/components/Modal.tsx`** — overlay `bg-black/40` + panel
  `rounded-2xl border shadow-lg`, tamaños lg/2xl/3xl.
- **Adopción: alta.** 85 de 97 `page.tsx` importan `components/ui`.
- **Fuentes:** `next/font/google` (`IBM_Plex_Sans`, `IBM_Plex_Mono`) — se
  auto-alojan en build. `display` por defecto (no `swap` explícito).

### 1.2 Mobile — paquete `theme/` con Context

- **`mobile/src/theme/tokens.ts`** — `paletaBase` (los 9 colores con
  nombre → superficies, texto, brand, accent, estados), `estado` (riel
  semántico agendado/enProceso/firmada/vencida/neutro), `espacio(n)=n*4`,
  `radio` {sm:6, md:7, lg:8, contenedor:22, full:999}, `tipografia`
  (tamaños xs 12.5 … xxl 30, pesos), `sombra` {card: none, flotante: sí},
  `TOQUE_MIN = 46`.
- **`mobile/src/theme/ThemeProvider.tsx`** — `useTema()` expone
  `{ colores, estado, espacio, radio, tipografia, sombra, duracion }`.
  **Recibe `MarcaEmpresa` pero la ignora** (`marca: _marca` — el tema es
  único; comentario explícito: "el color y la fuente de la empresa ya NO
  cambian la paleta").
- **`mobile/src/theme/color.ts`** — utilidades JS: `mezclar`, `aclarar`,
  `contraste(fondo)` (luminancia → `#fff`/`#111`), `esHexValido`. RN no
  tiene `color-mix()`.
- **`mobile/src/theme/fuentes.ts`** — IBM Plex Sans/Mono vía
  `@expo-google-fonts/*` (.ttf en el bundle), cargadas con `useFonts()` en
  `shell/App.tsx`.
- **`mobile/src/components/ui/`** — `Button` (variantes primario/secundario/
  ghost/peligro/acento · tamaños md/lg · `minHeight: TOQUE_MIN`),
  `Card` (borde 1px + sombra opcional), `Input` (label + error + foco en
  brand), `Badge` (mapa estado→par de colores), `Text` (variantes
  titulo/subtitulo/cuerpo/etiqueta/caption/cifra · tonos · resolución de
  familia por peso), `estados.tsx` (`LoadingScreen`, `ErrorState`,
  `EmptyState`), `Screen`, `PickerBuscable`, `SelectorHora`, `LogoMark`.
- **Adopción: alta.** 360 referencias a `t.colores.*` en 51 archivos de
  `features/` — todo pasa por el tema, casi nada hardcodeado.

### 1.3 Qué se comparte hoy web ↔ mobile

**Casi nada de UI.** Se comparte vía `@bitacora/shared`: tipos, lógica de
dominio (`liquidacionChile`, `mapearCamposPersonalizados`), y **helpers de
plata duplicados**:
- `mobile/src/lib/plata.ts` → `pesos()`, `agruparMiles()`, `formatearMoneda()`
- `web/src/lib/formatMoneda.ts` → `formatMoneda()`, símbolo, parser

Los componentes son **implementaciones separadas con APIs parecidas pero no
idénticas** (web `variant="primary"` vs mobile `variante="primario"`; web
`size` vs mobile `tamano`; textos en inglés vs español). No hay
`packages/ui` ni `packages/design-tokens`.

---

## 2. Inventario — colores hardcodeados

### Web (`web/src`, fuera de `globals.css`)

- **52 literales hex.** Desglose:
  - **Legítimos / de datos (≈40):** selector de color de categorías de
    gasto (`configuracion/categorias-gastos` — 18 colores de paleta de
    datos), color primario/secundario de **plantillas de PDF**
    (`configuracion/plantillas`, `configuracion/empresa` — `#4338ca`,
    `#0d9488` como defaults del branding del PDF, no de la app),
    función `contraste()` local.
  - **A migrar (≈12):** `DataTable.tsx:66` `even:bg-[#fafbfc]`,
    `RegistrosMantencion.tsx:166` idem, `plantillas/page.tsx` varios
    `text-gray-*` en el preview del PDF, `plantillas/page.tsx:321`
    `style={{ borderColor: "#e6e6ee" }}`.
- **8 clases de color literales de Tailwind** (`bg-amber-50`, `text-gray-500`,
  `bg-amber-500`…): `superadmin/empresas/[id]:775`, `plantillas/page.tsx`
  (x5, todas en el preview del PDF), `DashboardShell.tsx:459` (banda de
  aviso de impersonación — `bg-amber-500`).
- **22 `style={{…}}` con color/background/border** en pantallas —
  principalmente el color de marca del tenant aplicado a mano en el preview
  de plantillas y en algún badge.

### Mobile (`mobile/src`, fuera de `theme/`)

- **9 literales hex** + **9 `rgba()`**. Casi todos legítimos:
  `LienzoFirma` (tinta negra del trazo de firma, papel blanco),
  `MapaLienzo` (verde/blanco de los pines del SVG del mapa),
  `CierreFirma:135` y `AgendaScreen:295` (`#F3F6F9` para "día de hoy" —
  este sí debería ser token), `#D3D8DD` en `LienzoFirma` (línea de firma).
- **`mobile/app.json`**: `backgroundColor` del splash `#1e4e8c` (azul viejo,
  pre-Faena — quedó desactualizado) y `#ffffff`.

**Conclusión:** el repo está **notablemente limpio** de colores hardcodeados.
El "trabajo sucio" de tokenizar ya se hizo con Faena. Lo que queda son ~15
casos reales + los defaults de branding de PDF (que son otra cosa).

---

## 3. Inventario — componentes

| Familia | Web | Mobile | ¿API idéntica? |
|---|---|---|---|
| **Button** | `ui.tsx` — `variant` primary/outline/ghost/danger/**accent**, `size` sm/md/lg, alturas 32/40/48 | `ui/Button.tsx` — `variante` primario/secundario/ghost/peligro/**acento**, `tamano` md/lg, `minHeight` 46, `cargando`, `icono` | ❌ nombres distintos, sin `loading`/`iconLeft` en web, sin `sm` en mobile, sin `block` explícito |
| **Input / Textarea / Select** | `ui.tsx` — `Input`, `Textarea`, `Select` (chevron propio). Sin DatePicker (usa `<input type=date>`) | `ui/Input.tsx` (label+error+ayuda), `SelectorHora`, `PickerBuscable`, `HojaCrearCliente`. Sin Select genérico | ❌ |
| **Card** | `ui.tsx` — `rounded-2xl border p-5` | `ui/Card.tsx` — `radio.lg` + sombra opcional + `onPress` | ~ parecida |
| **Tag / Badge** | `ui.tsx` `Badge` — mapa ~70 estados → 5 tonos (`bg-*-soft text-*`) | `ui/Badge.tsx` — mapa ~20 estados → 6 pares | ❌ web cubre más estados |
| **StatusBadge** (mapa dominio→color) | En `ui.tsx` (`TONO_DE_ESTADO`) **+ duplicado** en `agenda/page.tsx`, `EstadoCitaRiel.tsx` | En `ui/Badge.tsx` (`POR_ESTADO`) **+ duplicado** en `TareaDetalleScreen`, `DetalleReservaCosmetologia`, `EstadoCitaRiel` (mobile) | ❌ **5 definiciones del mismo mapa** repartidas |
| **Table** | `DataTable.tsx` (compartido, 4+ pantallas) | — (mobile usa listas/cards) | n/a |
| **Dialog / Sheet** | `Modal.tsx` (overlay) + varios paneles inline | `HojaCrearCliente`, `SelectorCliente`, sheets ad-hoc con `Modal` de RN | ❌ sin primitiva de sheet |
| **Estados vacío/carga/error** | `estados.tsx` — 3 componentes ✅ | `ui/estados.tsx` — 3 componentes ✅ | ~ parecida (spinner en web, no esqueletos) |
| **Toast** | ❌ no hay (se usan `Aviso`/`ErrorText` inline) | ❌ no hay | falta en ambos |
| **Nav** | `DashboardShell.tsx` (25 KB) — sidebar, activo = `bg-brand text-brand-foreground` | `shell/navigation/AppTabs.tsx` — 4 tabs, `tabBarActiveTintColor: brand`, FAB `bg accent` | separadas |
| **Iconos** | `components/icons.tsx` — set SVG **propio**, `strokeWidth={1.75}`, sin dependencia | `@expo/vector-icons` (Ionicons) | ❌ dos sets distintos, ninguno es Lucide |
| **Charts** | `components/charts/` (9 archivos) | — | n/a |
| **Logo** | `Logo.tsx` | `LogoMark.tsx` | separados |

---

## 4. Gaps vs. lo que pide el prompt

| Pide el prompt | Estado |
|---|---|
| `packages/design-tokens/tokens.json` + generadores CSS y JS | ❌ no existe (hoy: CSS a mano en web, `tokens.ts` a mano en mobile) |
| `packages/ui` con API idéntica web/mobile | ❌ no existe (implementaciones separadas, APIs divergentes) |
| Paleta crema/terracota/oliva + 3 rampas de 9 pasos | ❌ paleta actual es azul/naranja |
| Caprasimo + Figtree, self-hosted, botones en heading | ❌ hoy IBM Plex |
| Color de marca por tenant reemplaza el acento (`--brand` desde layout server; ThemeProvider con `brand`) | ⚠️ infra existe (`empresas.color_primario` + `color_primario_foreground` en DB, `contraste()` en mobile) pero **está desconectada a propósito** |
| `--brand-hover` / `--brand-pressed` derivados en OKLCH | ❌ (mobile deriva en RGB con `mezclar`; web no deriva) |
| Test que falla si hay hex fuera de `tokens.json` | ❌ (se puede sumar a `verificar.sh`) |
| Todo pill / contenedores 28-32px / sombras | ❌ Faena es lo contrario (esquina corta, sin sombra) |
| StatusBadge: **un** mapa dominio→color | ⚠️ existe pero **duplicado 5 veces** |
| Toast | ❌ no existe |
| Skeletons (no spinner) en LoadingState | ❌ hoy es spinner |
| Regla ESLint anti-hex / anti-`px` / anti-color-Tailwind | ❌ (+ **el eslint de web está roto hoy**, tarea #1 del harness) |
| Storybook / Expo Storybook | ❌ no existe en el repo |
| Check de CI: pantalla solo importa de `packages/ui`/`design-tokens` | ❌ |
| Helper único de CLP | ⚠️ **duplicado** (`web/lib/formatMoneda.ts` vs `mobile/lib/plata.ts`) |
| Lucide, `stroke-width: 2.75`, un set | ❌ web tiene set propio (1.75), mobile usa Ionicons |

---

## 5. Contradicciones / riesgos a confirmar

1. **Faena se tira.** El prompt reemplaza un sistema de diseño terminado y
   desplegado hace 2 semanas (ver memoria `refresco-diseno-1a.md`). No es
   "migrar a tokens" (eso ya pasó), es **rehacer la identidad visual y
   re-migrar las ~40 pantallas**. Confirmá que esa es la intención y no un
   malentendido.

2. **Per-tenant se reactiva.** Faena retiró el theming por empresa a
   propósito. El prompt lo vuelve a poner (el color de la empresa pinta
   primarios, nav activa, focus, FAB). Hay que rehidratar
   `empresas.color_primario` en el layout server (web) y en el
   `ThemeProvider` (mobile). ¿Confirmás?

3. **Lucide = dependencia nueva.** El prompt dice "no agregar dependencias
   de UI" pero también "usá Lucide". `lucide-react` + `lucide-react-native`
   son deps. Web hoy tiene un set SVG propio de ~40 íconos con `stroke 1.75`.
   Opciones: (a) sumar Lucide en ambos, (b) mantener el set propio y solo
   estandarizar `stroke-width: 2.75`. Decime cuál.

4. **Botones en Caprasimo.** Caprasimo es una display muy marcada (casi
   decorativa). En botones chicos y densos (tablas, toolbars) puede leerse
   mal y bajar el contraste percibido. ¿Seguro los botones van en heading, o
   solo los CTA grandes?

5. **Escala de espaciado `4.4 / 8.8 / 13.2…`** — valores raros (base 4.4px).
   El prompt dice "no los cambies". En web van como CSS vars sin problema;
   en RN son números y también sirven. Solo confirmo que es deliberado.

6. **Storybook en Expo** — montar Storybook para RN es no-trivial (build
   aparte, no corre en el bundle de la app). ¿Storybook solo para web y un
   catálogo más simple para mobile, o Storybook en ambos aunque cueste?

7. **`CLAUDE.md`** — ya existe uno (del harness). El resumen del sistema de
   diseño lo pondría en `docs/design-system.md` y lo **enlazaría** desde
   `CLAUDE.md` y `docs/harness/convenciones.md`, no lo piso.

8. **ESLint roto (tarea #1 del harness).** La regla anti-hex y el check de
   CI dependen de que `npm run lint -w web` funcione. Conviene hacer la
   tarea #1 antes del Paso 7 (o como parte de él).

---

## 6. Plan propuesto (ajustado al estado real)

Asumiendo que confirmás la nueva dirección:

- **Paso 1 — `packages/design-tokens`.** `tokens.json` (los valores exactos
  del prompt) + generador a `tokens.css` (custom props para web) y a
  `tokens.ts` (objeto tipado para Expo). Reemplaza los `:root` de
  `globals.css` y `mobile/src/theme/tokens.ts`.
- **Paso 2 — Marca por tenant.** `--brand` inyectado en `<html>` desde el
  layout server (web) leyendo el tenant; `ThemeProvider` que expone `brand`
  (mobile). `brand-hover`/`brand-pressed` derivados en OKLCH (web) / su
  equivaliente (mobile `color.ts`). Test anti-hex en `verificar.sh`.
- **Paso 3 — Tipografía.** Caprasimo + Figtree; `next/font` (web),
  `expo-font` con precarga en splash (mobile). Reemplaza IBM Plex.
- **Paso 4 — `packages/ui`.** Primitivas con **API única** (una decisión de
  idioma: propongo español, como el resto del dominio). Web y mobile
  implementan la misma interfaz. Migrar `web/components/ui.tsx` y
  `mobile/components/ui/` a re-exports de `packages/ui`.
- **Paso 5 — Reglas transversales** (forma, aire, foco, contraste, touch,
  `tabular-nums`, helper CLP único en `packages/ui` o `packages/shared`).
- **Paso 6 — Migración** pantalla por pantalla, 1 commit c/u, en el orden
  del prompt. Cada pantalla entra como su propia tarea en `trabajo_list.json`.
- **Paso 7 — Anti-degradación.** Regla ESLint (tras arreglar la tarea #1),
  Storybook web (+ catálogo mobile), check de CI, `docs/design-system.md`
  enlazado desde `CLAUDE.md`.

**Encaje con el harness:** cada paso es una tarea en `trabajo_list.json`,
una a la vez, `./verificar.sh` verde antes de cerrar, informe en
`progress/`. El Paso 6 genera 7+ sub-tareas (una por pantalla).

---

## 7. Lo que necesito de vos

Respondé a los 8 puntos de la sección 5 (o al menos: **¿confirmás tirar
Faena y hacer la dirección crema/Caprasimo?** y **¿Lucide sí o mantenemos
el set propio?**). Con eso arranco el Paso 1.
