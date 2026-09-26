# Auditoría de diseño (UI) y experiencia de usuario (UX): web y mobile

> 26-sep-2026. **Solo diagnóstico: no se cambió código ni diseño.** Base: lectura del repo
> (componentes, tokens, pantallas y conteos con grep) y contraste WCAG calculado desde
> `packages/design-tokens/tokens.json`. No se revisó la app en vivo ni hay capturas en el repo,
> así que las notas de "percepción" (identidad, jerarquía) son criterio experto sobre el código.
> Referencias de mercado: Linear, Stripe Dashboard y Notion (web B2B); Jobber y ServiceTitan
> (field service, web y app de terreno).

Escala: 9-10 = al nivel de los mejores del mercado · 7-8 = bueno, detalles por pulir ·
5-6 = funciona pero con brechas visibles · 3-4 = brecha importante · 1-2 = ausente.

---

## 0. Resumen

| Plataforma | Diseño (UI) | UX | General |
|---|---|---|---|
| Web | **5,8** | **5,1** | **5,4** |
| Mobile | **6,2** | **5,2** | **5,7** |

**Lo mejor hoy:**
- sistema de tokens compartido web/mobile con 3 temas y color por empresa;
- íconos Lucide consistentes;
- zonas táctiles de 44-64 px en mobile;
- cola offline con reintentos;
- filas clicables con menú ⋯ en todas las tablas web (tarea 149).

**Lo que más resta:**
1. Contraste del texto secundario bajo AA (cientos de usos).
2. Dos sistemas de componentes conviviendo en la web.
3. Accesibilidad funcional casi ausente (labels, roles, fuente grande).
4. Feedback con diálogos nativos y sin toasts.
5. **Cero instrumentación de producto.**

---

## 1. Hallazgos medidos (evidencia)

### Contraste WCAG (texto `#201e1d` sobre fondo, tema Faena `#f5ead8`)

| Uso | Contraste | AA texto normal (4,5) | Usos web | Usos mobile |
|---|---|---|---|---|
| Texto 100 % | 13,9 | ✓ | — | — |
| Texto 70 % (`text-ds-text/70`, `…b3`) | 5,65 | ✓ | 384 | 31 |
| **Texto 60 %** (`/60`, `…99`) | **4,13** | ✗ | **334** | **181** |
| **Texto 50 %** (`/50`, `…80`) | **3,12** | ✗ | 12 | 38 |
| **Texto 40 %** (`/40`, `…66`) | **2,39** | ✗ | 6 | 41 |
| Acento `#c67139` como texto sobre fondo | 3,03 | ✗ | — | — |
| **Blanco sobre acento `#c67139`** (botón primario con color por defecto) | **3,61** | ✗ | — | — |
| `accentRamp.700` como texto | 5,72 | ✓ | (se usa en errores) | ✓ |

En los temas Taller (`#d1580f`, blanco encima 4,1) y Confianza (`#2563a6`, 6,2), el texto al 60 % también queda en 3,9-4,1.

### Otros datos

**Web:**
- **Fuentes:** carga 5 familias (IBM Plex Sans, Plex Mono, Caprasimo, Figtree y Archivo; `web/src/app/layout.tsx:2`).
- **Tamaños de texto:** conviven dos escalas (tokens `text-ds-*` y Tailwind `text-sm/xs`) más 121 tamaños arbitrarios (`text-[11px]` ×82, `[10px]` ×23).
- **Componentes:** 87 archivos usan `@bitacora/ui` y 24 siguen con el legacy `web/src/components/ui.tsx`. Hay 164 `<button>` y 90 `<input>` hechos a mano.
- **Modales y tablas:** 3 implementaciones que se solapan (`Modal` contra `Dialog`; `DataTable` contra `Table`; 16 `<table>` crudos).
- **Feedback:** el `Toast` existe pero tiene 0 usos. Hay 32 `confirm()`, 1 `window.prompt` y 2 `alert()`.
- **Labels:** `Input` del paquete sin `htmlFor`/`id` (`packages/ui/src/web/Input.tsx:35`); solo 18 `htmlFor` en toda la web.
- **Navegación:** sidebar con 20 ítems en 8 grupos y 21 secciones en Configuración. Personas e Inventario aparecen en los dos lugares.
- **Responsive:** breakpoints solo `sm` y `lg` (0 usos de `md`/`xl`); `px-6` fijo en móvil; tablas con scroll horizontal y sin vista de tarjetas.
- **Ausente:** búsqueda global, Cmd+K, checklist de onboarding y ayuda contextual.

**Mobile:**
- **Pantallas:** 49 de 50 pantallas ya usan el sistema nuevo. Quedan piezas viejas: `PickerBuscable` en 6 formularios, `OfflineBanner`, `LienzoFirma`, `BloqueoBiometrico` y modales de agenda.
- **Texto chico:** 10 textos de 9-11 px fuera de la escala, y las etiquetas de la tab bar miden 11 px.
- **Zonas táctiles:** buenas (Button 44/48/52, Input 44, ListRow 64). El texto-acción "Editar" de la ficha del equipo es de 13 px y no tiene altura mínima.
- **Feedback:** 183 `Alert.alert`; el `Toast` existe pero tiene 0 usos. "Gastos" abre un diálogo nativo para elegir la acción.
- **Accesibilidad:** 4 `accessibilityLabel` y 5 `accessibilityRole` en toda la app. No se controla el tamaño de fuente del sistema (`maxFontSizeMultiplier`).
- **Modo oscuro:** `app.json` fija `light`, aunque existe `colorDark` en los tokens.
- **Formularios:** Nueva OS, Nuevo gasto y Viaje no usan `KeyboardAvoidingView`, así que el teclado puede tapar campos.
- **Encabezados:** mezcla de header nativo (7 formularios modales) y `ScreenHeader` (38 pantallas).
- **Instrumentación:** ninguna. Ni Sentry, ni analytics, ni eventos, en web ni en mobile. El backend solo guarda errores 5xx (`errores_backend`) y requests lentos (`requests_lentos`); tiene `@sentry/node` pero inactivo sin `SENTRY_DSN`.

---

## 2. Web — Diseño (UI)

| # | Ítem | Nota | Qué se comparó | Sugerencia concreta para llegar a 9-10 |
|---|---|---|---|---|
| 1 | Color | **6** | Stripe/Linear: paleta corta, texto secundario ≥ 4,5:1, un acento, estados semánticos | (a) Token único `texto-secundario` = texto al 72 % (≈5,9:1) y reemplazar los 352 `/60`, `/50` y `/40`. (b) Texto de acento siempre con `accentRamp.700`. (c) Botón primario: elegir texto blanco u oscuro por contraste WCAG real (hoy blanco sobre `#c67139` da 3,6). (d) Test automático de contraste en `design-tokens` que falle bajo 4,5. |
| 2 | Tipografía | **5** | Linear/Notion: 1-2 familias, una escala, sin tamaños sueltos | (a) Quitar IBM Plex (y Archivo si Taller puede vivir con Figtree) del `layout.tsx`: menos peso y un solo tono. (b) Prohibir `text-[Npx]` y `text-sm/xs` con lint (como `anti-token`) y pasar los 121 casos a `text-ds-caption/small`. (c) Piso de 12 px para texto informativo; 11 px solo en etiquetas en mayúscula con tracking. |
| 3 | Layout / composición | **6** | Stripe: encabezado de página + acciones a la derecha + contenido en tarjetas con ritmo de 8 px; detalle en panel lateral | (a) Plantilla de página única (`PageHeader` nuevo: título, subtítulo, acción primaria, filtros). (b) Partir las páginas gigantes (Viajes 1120, Agenda 1490 líneas) en listado + panel lateral de detalle o edición, en vez de editar dentro de la fila. (c) `px-4 sm:px-6` en el contenedor. |
| 4 | Identidad visual / rubro | **6** | Jobber: cálida y cercana, pero con alto contraste y densidad de oficina | La paleta crema y terracota es distintiva y cálida, un acierto frente al "azul SaaS". Le falta firmeza: más contraste, bordes y títulos Caprasimo solo en encabezados grandes. Mantener la identidad y subir la legibilidad (ítem 1). |
| 5 | Iconografía e imágenes | **8** | Linear: un set, un grosor | Lucide en todo, grosor 2.75 constante. Falta: (a) ilustraciones simples para estados vacíos clave (primer cliente, primera OS) y (b) reemplazar el emoji 📱 de Viajes por un ícono. |
| 6 | Branding por empresa | **7** | Stripe Connect / Jobber: logo + color de marca aplicados con contraste garantizado | Buena base: 3 temas, `color_primario` con hover y pressed en OKLCH, y logo en el sidebar. Para 9-10: (a) validar contraste del color de marca al guardarlo en Configuración › Empresa, con aviso y sugerencia; (b) aplicar el logo también en PDF, portal y correos (revisar consistencia); (c) vista previa del tema antes de guardar. |
| 7 | Responsive | **5** | Linear/Stripe: tablas que pasan a tarjetas bajo 640 px y drawer accesible | (a) Variante "tarjeta" del `Table` bajo `sm` (título + 2-3 datos + estado). (b) Usar `md` para layouts de 2 columnas en tablet. (c) Formularios de 1 columna en móvil. |
| 8 | Consistencia de componentes | **4** | Stripe/Linear: un solo sistema, sin controles sueltos | (a) Migrar los 24 archivos de `components/ui.tsx` al paquete (superadmin, portal, ordenes/nueva, trabajos/[id]) y borrar el legacy. (b) `Modal` → `Dialog` y `DataTable`/`<table>` → `Table`. (c) Lint que marque `<button>`/`<input>` crudos fuera de `packages/ui`. |
| 9 | Accesibilidad visual | **5** | WCAG AA | El estado no depende solo del color (StatusBadge con texto) ✓. Falta: contraste (ítem 1), texto de 10-11 px (105 usos) y foco visible en controles hechos a mano (hay solo 71 `focus-visible:`). |

**Promedio web diseño: 5,8**

## 3. Web — UX

| # | Ítem | Nota | Qué se comparó | Sugerencia concreta para llegar a 9-10 |
|---|---|---|---|---|
| 10 | Usabilidad general | **6** | Jobber: crear trabajo, cobrar y asignar en ≤ 3 pasos, con valores por defecto inteligentes | (a) Acción "Nuevo" global (botón + atajo) que abre OS, cobro, viaje o cliente sin navegar. (b) Precargar datos del cliente anterior, del chofer habitual o de la última tarifa. (c) Registrar pago desde el listado de cobros (menú ⋯), sin entrar al detalle. |
| 11 | Arquitectura de información | **6** | Linear: pocos grupos, búsqueda global, configuración separada del trabajo diario | (a) Sacar Personas e Inventario del duplicado: uno solo en el sidebar y en Configuración solo sus ajustes. (b) Agrupar las 21 secciones de Configuración en 4 bloques (Empresa, Equipo y permisos, Operación, Cuenta). (c) Búsqueda global Cmd+K sobre clientes, OS, viajes y cobros. |
| 12 | Flujos de usuario | **6** | Nueva OS ≈ 8-10 clics; cobro + pago ≈ 3 navegaciones + 4 campos; viaje ≈ 14 campos en una fila editable | (a) Viaje: formulario en panel lateral con secciones plegables (Datos, Precio, Viático) y avanzados ocultos por defecto. (b) Nueva OS: ítems desde el catálogo con autocompletar y cantidad 1 por defecto. (c) Donde el usuario se pierde: edición dentro de la fila (Viajes) y Configuración (21 ítems). |
| 13 | Feedback del sistema | **5** | Stripe: toasts de éxito con "Deshacer", diálogos propios, esqueletos de carga | (a) Montar `ToastProvider` y usarlo en cada guardado. (b) Reemplazar los 32 `confirm()`, el `prompt` y los 2 `alert()` por `Dialog` con texto específico y botón destructivo en rojo. (c) Skeletons en listas (hoy 79 textos "Cargando…"). |
| 14 | Carga cognitiva | **5** | Notion/Linear: revelación progresiva | (a) Campos opcionales detrás de "Más opciones" (OC, costos y precios mayoristas en ítems, km). (b) Viajes: filas de 10 columnas → mostrar 6 y el resto en el detalle. (c) Resumen arriba de cada listado (totales y vencidos). |
| 15 | Consistencia de patrones | **6** | Mismo patrón para editar, borrar y confirmar en todos los módulos | Mejoró con la tarea 149 (fila abre, menú ⋯). Queda mezcla de edición en modal, dentro de la fila y en página aparte. Elegir una sola: panel lateral para editar y página propia para el detalle. |
| 16 | Accesibilidad funcional | **4** | WCAG 2.2 AA: label asociado, roles, teclado, Escape | (a) `Input`/`Select`/`Textarea` del paquete con `useId()` y `htmlFor`: arregla cientos de campos de una vez. (b) Drawer móvil y menú de usuario con Escape, `aria-expanded` y foco atrapado. (c) `aria-current` en el ítem activo del sidebar. (d) Prueba automática con axe en Vitest. |
| 17 | Heurísticas de Nielsen | **6** | Ver §6 | Las más débiles son control y libertad (sin deshacer), prevención de errores (`confirm` genérico) y ayuda y documentación. |
| 18 | Instrumentación | **2** | Linear/Stripe: analytics de producto + errores de frontend + métricas de tarea | Nada en el frontend. Ver §7. |

**Promedio web UX: 5,1**

---

## 4. Mobile — Diseño (UI)

| # | Ítem | Nota | Qué se comparó | Sugerencia concreta para llegar a 9-10 |
|---|---|---|---|---|
| 1 | Color | **6** | Jobber y ServiceTitan mobile: alto contraste, fondo claro neutro | (a) Reemplazar los 267 `${tokens.color.text}XX` por 2 tokens (`textoSecundario` ≈ 72 % y `textoTerciario` solo para decoración). (b) Texto sobre la marca por contraste WCAG real (hoy luminancia > 0,6 en `ui/marca.tsx`). |
| 2 | Tipografía | **6** | Apple HIG y Material: cuerpo ≥ 15-16, mínimo 11 solo en etiquetas | Escala de tokens correcta. Faltan: (a) eliminar los 10 textos de 9-10 px (IndicadorPasos, SelectorDias, FotosSection…); (b) etiquetas de la tab bar a 12 px; (c) respetar el tamaño de fuente del sistema con tope (`maxFontSizeMultiplier` ≈ 1,3). |
| 3 | Layout / composición | **7** | Jobber: tarjetas claras, acción principal visible | `ScreenHeader` + tarjetas + ListRow dan orden. Mejoras: la acción principal de cada lista como botón fijo abajo (zona del pulgar) en vez de arriba, y detalle de OS con resumen fijo arriba (cliente, hora, estado). |
| 4 | Identidad / rubro (terreno) | **5** | ServiceTitan y Jobber mobile: legible al sol, targets grandes, pocas decisiones por pantalla | Targets de 44-64 ✓. Faltan: (a) "modo terreno" de alto contraste (fondo blanco puro, texto 100 %, bordes firmes) activable en Perfil o automático con brillo alto; (b) sacar el crema como fondo de lectura en ese modo, porque pierde contraste al sol; (c) botones de acción de 52 px en cierre de OS y confirmar viaje. |
| 5 | Iconografía e imágenes | **8** | Un set y un grosor | Lucide consistente (2.5-2.75). Falta: ilustraciones en estados vacíos principales. |
| 6 | Branding por empresa | **7** | Igual que la web | `useMarca` con 5 variantes y temas. Falta validar contraste del color de marca y que la tipografía del tema Taller también aplique en mobile (hoy solo colores). |
| 7 | Responsive (tamaños de teléfono) | **6** | Tamaños chicos (SE) y grandes, fuente del sistema grande | (a) Probar con iPhone SE y Android de 360 dp, y con fuente grande del sistema (hoy sin control). (b) Tablets: al menos que no se estire a todo el ancho (máx. ~640 dp centrado). |
| 8 | Consistencia de componentes | **7** | Un sistema | Migración casi completa. Faltan `PickerBuscable` (6 formularios), `OfflineBanner`, `LienzoFirma`, `BloqueoBiometrico`, `InputMonto` y los modales de agenda. |
| 9 | Accesibilidad visual | **4** | WCAG AA | Contraste del texto secundario (181 usos al 60 %), textos de 9-11 px, sin fuente dinámica y sin modo oscuro. |

**Promedio mobile diseño: 6,2**

## 5. Mobile — UX

| # | Ítem | Nota | Qué se comparó | Sugerencia concreta para llegar a 9-10 |
|---|---|---|---|---|
| 10 | Usabilidad general | **7** | Jobber app: el técnico abre la app y ve "mi próximo trabajo" | Buenos pilares: Pizarra del día, offline con cola, cámara, galería, firma y biometría. Para 9-10: (a) el trabajo en curso fijo arriba con "Llegué / Terminar"; (b) crear un gasto con foto en 1 toque (hoy Más → Gastos → diálogo → formulario). |
| 11 | Arquitectura de información | **6** | Jobber: 4-5 pestañas por tarea, no por módulo | "Más" concentra 11 accesos más la cuenta. El técnico tiene sus OS en Pizarra, pero "Órdenes de servicio" completas quedan en Más. Evaluar pestañas según la función: para técnicos "OS" en lugar de "Clientes", para choferes "Viajes". Gastos abre `Alert.alert`: reemplazar por hoja de acciones propia o dos accesos. |
| 12 | Flujos de usuario | **6** | Crear OS 3 toques, gasto 3 con diálogo nativo, cierre de OS con firma al final de un scroll largo | (a) Botón "Cerrar OS" fijo abajo en el detalle. (b) Formulario de viaje por pasos (11 campos). (c) Volver automático a la lista con toast tras guardar. |
| 13 | Feedback del sistema | **6** | Toast de éxito, estado de sincronización visible | La cola offline es de nivel profesional (reintentos, fallidas en Perfil). Falta: (a) toasts en vez de los 183 `Alert.alert` de éxito o error menor; (b) indicador "sin sincronizar" en cada ítem de lista, no solo en Perfil; (c) pull-to-refresh en Mis trabajos y Levantamientos. |
| 14 | Carga cognitiva | **6** | Una decisión por pantalla en terreno | Formularios de 8-11 campos con 4 selectores en Gasto y Viaje. Usar valores por defecto (fecha hoy, chofer = yo, vehículo asignado) y ocultar opcionales. |
| 15 | Consistencia de patrones | **6** | Mismo patrón para crear, editar y ver | Formularios modales con header nativo frente a pantallas con `ScreenHeader`; listas con ListRow frente a filas propias (OS, Agenda, Pizarra). Unificar ambos. |
| 16 | Accesibilidad funcional | **3** | Apple/Google: rol y label en todo lo tocable, fuente dinámica, teclado sin tapar campos | (a) `accessibilityRole` + `accessibilityLabel` por defecto en ListRow, QuickAccessCard y Pressable de tarjetas (hoy 4 labels en toda la app). (b) `KeyboardAvoidingView` en Nueva OS, Gasto y Viaje. (c) `maxFontSizeMultiplier` global y prueba con fuente grande. (d) "Editar" y otras acciones de texto con zona de 44 px. |
| 17 | Heurísticas de Nielsen | **6** | Ver §6 | Débiles: control y libertad, prevención de errores, ayuda. |
| 18 | Instrumentación | **1** | Sentry y analytics en app | Nada: ni crashes ni eventos. Ver §7. |

**Promedio mobile UX: 5,2**

---

## 6. Evaluación heurística (Nielsen) — pantallas principales

Pantallas revisadas: Visión general, Órdenes, Nueva OS, Viajes, Cobros y Configuración (web); Pizarra, detalle y cierre de OS, Más, Nuevo gasto y Viaje (mobile). ✓ se cumple · ◐ parcial · ✗ no.

| # | Heurística | Web | Mobile | Nota |
|---|---|---|---|---|
| 1 | Visibilidad del estado del sistema | ◐ | ✓ | Mobile: banner offline, cola y estados. Web: carga con texto, sin toasts. |
| 2 | Relación con el mundo real | ✓ | ✓ | Lenguaje de pyme chilena (guía, viático, UF, OS). |
| 3 | Control y libertad del usuario | ✗ | ◐ | No hay "deshacer" tras borrar o marcar pagado; mobile permite reintentar o descartar en la cola. |
| 4 | Consistencia y estándares | ◐ | ◐ | Dos sistemas de componentes (web); headers y listas mezclados (mobile). |
| 5 | Prevención de errores | ◐ | ◐ | Validaciones en backend ✓; confirmaciones con `confirm()` y `Alert` genéricos. |
| 6 | Reconocer antes que recordar | ◐ | ✓ | Combobox y pickers con búsqueda ✓; web sin búsqueda global ni recientes. |
| 7 | Flexibilidad y eficiencia | ✗ | ◐ | Sin atajos, Cmd+K ni acciones masivas amplias (web). Mobile: accesos rápidos. |
| 8 | Estética y diseño minimalista | ◐ | ✓ | Web: páginas y filas densas (Viajes con 10 columnas). |
| 9 | Ayudar a reconocer y recuperarse de errores | ◐ | ◐ | Mensajes en español y específicos del backend ✓; se muestran como texto suelto o `Alert`. |
| 10 | Ayuda y documentación | ✗ | ✗ | Ayuda estática de 53 líneas, sin ayuda contextual ni onboarding guiado. |

**Web: 1 ✓ · 6 ◐ · 3 ✗ · Mobile: 4 ✓ · 5 ◐ · 1 ✗**

---

## 7. Instrumentación: qué agregar

Hoy no se puede medir abandono, tiempo en tarea ni errores de pantalla. Propuesta mínima, en orden:

1. **Errores:**
   - **Qué instalar:** Sentry en web (`@sentry/nextjs`), mobile (`@sentry/react-native`, crashes y errores JS) y backend (ya instalado: falta `SENTRY_DSN`).
   - **Cuidado con datos personales:** filtrar RUT, correos y montos (`beforeSend`). Coherente con la Ley 21.719.
2. **Analytics de producto:**
   - **Herramienta:** PostHog (plan gratis generoso, se puede alojar en la UE) con un wrapper propio `registrarEvento(nombre, propiedades)` para no acoplar el código.
   - **Privacidad:** sin datos personales, con `empresa_id` como grupo.
3. **Eventos de tareas core, con inicio y fin:**
   - **Qué medir:** `os_crear_iniciar`/`os_crear_ok`, `cobro_crear_*`, `pago_registrar_*`, `viaje_crear_*`/`viaje_confirmar_*`, `gasto_crear_*`, `os_cerrar_firma_*` y `sync_fallida`.
   - **Qué se obtiene:** tasa de abandono y tiempo en tarea por flujo.
4. **Embudo de activación:** registro → primer cliente → primera OS → primer cobro → primer usuario invitado. Hoy no se sabe dónde se caen las empresas en prueba.
5. **Rendimiento:** Web Vitals en web (`@vercel/speed-insights`) y tiempo de arranque de la app.
6. **Tablero para el Super-Admin:** activación y uso por empresa (ya existe la base "salud de la empresa").

---

## 8. Top 5 de mejoras priorizadas (impacto / esfuerzo)

| # | Mejora | Impacto | Esfuerzo | Por qué primero |
|---|---|---|---|---|
| 1 | **Instrumentación básica**: Sentry web y mobile + `SENTRY_DSN` en backend + PostHog con 10-12 eventos de tareas core y embudo de activación | Alto: decisiones con datos desde el 1-oct | **Bajo** (1-2 días; requiere claves que cargas tú) | Todo lo demás se prioriza mejor midiendo. Sin datos, las notas de esta auditoría son opinión. |
| 2 | **Contraste**: tokens `textoSecundario` (≈72 %) y texto sobre marca por WCAG; reemplazo masivo de `/60`, `/50`, `/40` y `…99/80/66`; test de contraste en tokens | Alto: legibilidad al sol y AA | **Bajo-medio** (reemplazo mecánico + revisión visual) | Afecta a ~620 textos en todas las pantallas y es lo más visible en terreno. |
| 3 | **Accesibilidad funcional base**: `useId` + `htmlFor` en campos web; `accessibilityRole/Label` por defecto en ListRow, QuickAccessCard y tarjetas; `KeyboardAvoidingView` en 3 formularios; tope de fuente dinámica; acciones de texto a 44 px | Alto (lectores de pantalla, teclado tapando campos) | **Medio** (se resuelve en los componentes base, no pantalla por pantalla) | Arreglar las primitivas corrige cientos de usos a la vez. |
| 4 | **Feedback unificado**: montar Toast (web y mobile); `Dialog` propio para confirmar en vez de `confirm()`/`Alert.alert`; "Deshacer" en borrar y marcar pagado; skeletons en listas | Medio-alto (confianza, menos errores) | **Medio** | Sube las heurísticas 1, 3, 5 y 9 de una vez. |
| 5 | **Consolidar el sistema web**: migrar los 24 archivos legacy a `@bitacora/ui`, `Modal`→`Dialog`, `DataTable`→`Table`, quitar Plex y Archivo, lint anti `text-[Npx]` y controles crudos | Medio (consistencia, peso) | **Medio-alto** | Base para todo lo siguiente (Cmd+K, panel lateral, tarjetas en móvil). |

**Siguientes candidatos** (más esfuerzo o menos urgencia):
- búsqueda global Cmd+K (web);
- "modo terreno" de alto contraste (mobile);
- tabla que pasa a tarjetas bajo 640 px (web);
- botón de acción fijo abajo y "Cerrar OS" fijo (mobile);
- pestañas según la función del usuario (mobile);
- checklist de onboarding para empresas nuevas;
- panel lateral de edición en Viajes y Agenda.

> Nada de esto está implementado. Queda para revisar juntos y decidir qué se ataca primero.
