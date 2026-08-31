# Resumen de trabajo — Cliente 360°, inventario automático, catálogo

Rama: `feat/cliente-360-inventario-catalogo` (desde `main`), no mergeada, sin push.

Spec de 7 bloques (A–G) comparando Bitácora con una herramienta de referencia del rubro. No se replicó texto/marca/diseño de esa herramienta — solo los patrones funcionales, adaptados al design system propio.

---

## Bloque A — Vista 360° del Cliente

**Ya existía parcial**: el backend (`GET /api/clientes/:id`) ya traía trabajos/presupuestos/facturas anidados; el frontend los mostraba como 3 `Card` apiladas, sin pestañas ni timeline.

- `web/src/app/dashboard/registros/clientes/[id]/page.tsx` — reescrita: pestañas **Historial** (timeline único, cronológico, combina OS+cotizaciones+cobros — antes eran 3 listas separadas sin orden común), **Equipos** (nuevo), **Financiero** (cobros, contenido equivalente a la card vieja).
- `backend/src/routes/clientes.ts` — `GET /:id` ahora también trae `equipos` (por `cliente_id`).
- Botones "+ Nueva Cotización / + Nueva OS / + Nuevo Cobro" en la ficha, cada uno navega con `?cliente_id=X` para preseleccionar. Cobros no tenía ruta "nueva" propia (form inline en la misma página de listado) — se agregó `?nuevo=1&cliente_id=X` que abre y prellena ese form al cargar.
- Cada evento del Historial es clickeable: OS → ficha de la OS, Cotización → ficha de la cotización, Cobro → lista de Cobros (no existe ficha por id de un cobro individual).

**Scope no cubierto**: el botón "Nuevo Equipo" dentro de la pestaña Equipos manda al listado general de Equipos, sin preseleccionar el cliente — esa página no lee query params hoy (a diferencia de Cotizaciones/OS que sí se les agregó). Se puede agregar después si hace falta.

---

## Bloque B — Descuento de inventario al vender/usar productos

**Investigación (pedida antes de construir nada) — NO EXISTÍA NADA automático.** Dos sistemas de inventario en paralelo: la tabla `inventario` (legacy, migración 01, sin ningún endpoint que la use — está muerta) y `catalogo_items.stock_actual` + `inventario_movimientos` (el real). El único punto de escritura era `POST /api/inventario/movimientos`, 100% manual, y además **bloquea stock negativo** — no se podía reusar tal cual para esto.

- `backend/src/inventario.ts` (nuevo): `descontarStockPorOS()` — se dispara en `POST /trabajos/:id/finalizar` (OS pasa a "firmada"), que es la recomendación que traía el spec y la implementé tal cual (no quedó como TODO — el spec pedía confirmarla "si es posible" y la recomendación ya venía resuelta). Expande kits a sus productos componentes vía `catalogo_kit_items` (el kit no descuenta como unidad abstracta). Permite stock negativo — no bloquea el cierre de la OS — y junta advertencias (`advertencias_stock` en la respuesta de `/finalizar`) en vez de impedir la operación.
- `revertirStockPorOS()` — si una OS que ya descontó stock (`ordenes_servicio.stock_descontado`) se cancela después, revierte devolviendo el stock. Recalcula desde los mismos `os_items` (seguro: los ítems quedan bloqueados apenas hay firma, no pueden haber cambiado).
- **Ajuste necesario, no pedido explícitamente pero indispensable**: el guard de "OS finalizada" en `PATCH /trabajos/:id` bloqueaba TODO cambio de estado una vez finalizada — sin ajustarlo, la reversión de este mismo bloque quedaba en código muerto (nunca alcanzable). Se agregó una excepción puntual: cancelar una OS finalizada se permite como cambio aislado (nada más en el mismo PATCH).
- **TODO dejado explícitamente** (punto 6 del spec): si en el futuro se quiere *bloquear* el cierre de una OS por falta de stock (en vez de solo advertir), es una decisión de producto — está marcado en `backend/src/inventario.ts`.

Verificado en vivo: producto directo + kit (2x producto por kit) descuentan correctamente; producto con stock insuficiente queda negativo y genera advertencia; cancelar la OS finalizada revierte todo el stock a su valor original.

---

## Bloque C — Dashboard y vistas ampliadas de Equipos

- **Hallazgo de infraestructura**: `trabajos`/`ordenes_servicio` no tenían ninguna forma de vincularse a un Equipo específico (solo a `cliente_id`) — sin esto, el histórico de mantenciones no tenía de dónde salir. Se agregó `trabajos.equipo_id` (opcional, nullable).
- `equipos.garantia_vencimiento` (nuevo campo, cualquier categoría — no solo Vehículo) para la métrica de garantías.
- Tabla `planes_mantencion` — CRUD completo (`/api/planes-mantencion`). **TODO explícito** (como pedía el spec): generación automática de una OS al cumplirse `proxima_fecha` no implementada — requiere definir con qué datos se arma esa OS.
- `GET /api/equipos/dashboard` (nuevo) — las 6 métricas pedidas: total, activos, planes de mantención activos, garantías por vencer (30d), por categoría, próximas mantenciones (30d), equipos con más OS.
- Equipos nunca tuvo ficha por id — nueva `web/src/app/dashboard/registros/equipos/[id]/page.tsx`: datos básicos (solo lectura — la edición sigue en el listado, no se duplicó ese formulario), Plan de Mantención (crear/activar-desactivar/eliminar), Histórico de Mantenciones (OS con ese `equipo_id`, click lleva a la ficha de la OS).
- Nueva `web/src/app/dashboard/registros/equipos/dashboard/page.tsx` con las 6 métricas, accesible desde un botón en el listado.
- `ordenes/nueva`: selector "Equipo del cliente (opcional)" — solo aparece si el cliente elegido tiene equipos, guarda `equipo_id` en la OS.

**Scope no cubierto**: `ordenes/[id]` (edición de una OS existente) no tiene el selector de Equipo — solo se puede fijar al crear. Se puede agregar después si hace falta, mismo patrón.

---

## Bloque D — Catálogo: etiquetado por tipo de equipo

**No existía nada** — ni tabla de "tipos de equipo" ni relación con catálogo.

- Tabla `catalogo_item_tipos_equipo` (m2m, texto libre — mismo criterio que `equipos.categoria`, que tampoco tiene tabla maestra propia; no se inventó una taxonomía nueva).
- Form de ítem de Catálogo: chips multi-selección de tipos de equipo (sugeridos + los que ya estén en uso en otros ítems).
- `CatalogoSelectorModal` recibe `categoriaEquipoDestacar` — si se pasa, los ítems etiquetados con ese tipo aparecen primero, con una marca visual (✨), **sin ocultar el resto** (tal como pedía el spec).

**Scope no cubierto**: el destacado solo está conectado en `ordenes/nueva` (donde ya existe el selector de Equipo del Bloque C). Cotizaciones no tiene ningún vínculo a un Equipo específico hoy (los presupuestos no tienen `equipo_id`) — agregarlo hubiese significado otra migración fuera de lo pedido explícitamente; quedó fuera, se puede evaluar si se quiere extender ahí también.

---

## Bloque E — Catálogo: pulir la experiencia existente

- Pestañas Todos/Productos/Servicios/Kits: **ya existían**, sin cambios.
- "Crear categorías propias": **ya existía** (categoría es texto libre con sugerencias por uso) — no se duplicó, solo se fusionó la lista de categorías sugeridas por defecto (la que ya había: Repuestos/Insumos/Herramientas/Materiales/Mano de obra) con la pedida en el hallazgo de UX (Insumos/Desplazamiento/Mano de Obra/Materiales/Piezas y Componentes), sin duplicar los solapes.
- Ícono distintivo por tipo (Producto/Servicio/Kit) en el listado — no existía ahí (sí en el selector modal); se reusó la misma constante (`ICONO_TIPO`, exportada de `CatalogoSelectorModal.tsx`) en vez de duplicarla.

---

## Bloque F — Selector de catálogo reutilizable (el de mayor impacto)

**Ya existía y ya se reutilizaba** en las 4 pantallas esperadas (`ordenes/nueva`, `ordenes/[id]`, `cotizaciones/nueva`, `cotizaciones/[id]`) — no había que construirlo ni resolver duplicación, era pulirlo:

- Cantidad con **stepper** (−/número/+) en vez de un input numérico plano.
- Cada ítem se **elige** (check) sin agregarse todavía — antes cada click en "Agregar" insertaba inmediato al documento. Botón final **"Agregar (N)"** confirma todos los elegidos juntos.
- "Agregar ítem manual" se mantiene igual (pasa por el mismo contrato, como arreglo de un solo elemento).
- El contrato de `onAgregar` pasó de recibir un ítem a un arreglo — se ajustaron los 4 call sites.
- Subtotal/Total siguen recalculando en vivo (no se tocó esa lógica, solo cómo se agregan los ítems al arreglo que ya alimentaba el cálculo).
- Nuevo ícono `IconMinus` (no existía en el set propio).

---

## Bloque G — Selector de Cliente en Cotizaciones

`ComboboxCliente` ya existía (de un trabajo previo) pero no estaba aplicado en `cotizaciones/nueva` — era un `<Select>` simple. Se reemplazó por el combobox reutilizado (buscar/crear inline), igual que ya estaba en `ordenes/nueva`.

---

## Cómo se verificó

`npx tsc --noEmit` limpio en `packages/shared`, `backend` y `web` en cada commit.

Verificación en vivo con datos 100% desechables (empresa/cliente/colaborador creados y borrados en la misma corrida), 3 corridas separadas:
1. **Bloque B**: producto directo + kit (expande a 2 productos por kit) descuentan correctamente al firmar; producto con stock insuficiente queda negativo con advertencia; cancelar la OS finalizada revierte el stock exacto y limpia `stock_descontado`.
2. **Bloque C/D backend**: dashboard de Equipos con métricas correctas (total, activos, planes activos, garantías por vencer, próximas mantenciones, equipos con más OS); plan de mantención CRUD; histórico de mantenciones de un equipo trae la OS esperada; catálogo con `tipos_equipo` en POST/GET/PATCH.

No hice click-through de la UI con Playwright para las pantallas nuevas (Cliente 360°, ficha de Equipo, dashboard de Equipos, formulario de Catálogo con tipos de equipo, selector de catálogo rediseñado) — son reescrituras/adiciones de componentes que reusan patrones ya probados del proyecto (`Modal`, `DataTable`-style tablas, chips de filtro, `ComboboxCliente`), y el backend que consumen ya está verificado. Si querés que las recorra en el navegador antes de mergear, avisame.

## Decisiones tomadas por mi cuenta (no explícitas en el spec)

- Bloque B punto 5 (timing del descuento): implementado según la recomendación del spec (al firmar la OS), no quedó como TODO — la recomendación ya venía resuelta, solo pedían confirmarla si era posible.
- El guard de "OS finalizada bloquea todo" tuvo que ajustarse para permitir cancelar como excepción puntual — si no, la reversión de stock (pedida explícitamente) nunca sería alcanzable.
- `catalogo_item_tipos_equipo.tipo_equipo` es texto libre (no una tabla maestra de "tipos de equipo") — mismo criterio que `equipos.categoria`, que tampoco la tiene.
- El Historial del Cliente 360° es un timeline de verdad (ordenado, un solo lugar) en vez de simplemente agregar una pestaña más con las mismas 3 listas separadas de antes — interpretación de "línea de tiempo" tomada literalmente.
