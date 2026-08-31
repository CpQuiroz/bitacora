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

---
---

# Resumen de trabajo — Inventario configurable, sugerencias por rubro, Panel de Acciones, Google Login

Rama: `feat/inventario-config-acciones-google`, creada desde la punta de `feat/cliente-360-inventario-catalogo` (no desde `main`) porque este spec reemplaza y extiende el Bloque B de la sección anterior — así se modifica el código real en vez de duplicarlo. Contiene todos los commits de la sección de arriba más los descritos acá. No mergeada, sin push.

Spec de 10 bloques (A–J). No se replicó texto/marca/diseño de ninguna herramienta externa.

---

## Bloque B — Inventario configurable (reemplaza el diseño hardcodeado anterior)

El Bloque B original (sección de arriba) descontaba siempre al firmar la OS, sin forma de configurarlo. Ahora es configurable por empresa:

- Migración 54: `empresas.inventario_descontar_en_estado` (uno de los 5 `EstadoOS` reales, default `firmada`), `empresas.inventario_permitir_negativo` (default true), `empresas.inventario_descontar_una_vez` (default true, guard anti-duplicado); `inventario_movimientos.origen` (`manual`|`automatico`, antes solo se distinguía por texto libre en `motivo`).
- `backend/src/inventario.ts` reescrito: `descontarStockPorOS` → `aplicarDescuentoInventarioSiCorresponde(empresaId, ordenId, trabajoId, folio, nuevoEstadoOs)` — corta temprano si el módulo está desactivado o si `nuevoEstadoOs` no es el estado configurado como disparador; si `descontar_una_vez` está activo, respeta `ordenes_servicio.stock_descontado` para no descontar dos veces.
- `estado_os` solo cambia en 3 lugares del código (`POST /trabajos/:id/checklist` en check-in, en check-out, y `POST /trabajos/:id/finalizar`) — se agregó el llamado a la función nueva en los 3, cada uno pasando el estado real que acaba de setear; la función decide internamente si corresponde según la config de la empresa. Así, sea cual sea el estado elegido como disparador, se dispara sin importar por cuál de los 3 caminos se llegó a él.
- `web/dashboard/configuracion/inventario`: toggle "Descontar solo una vez por OS", radio de estado disparador (usa los `EstadoOS` reales, "firmada" marcado como recomendado), toggle "Permitir stock negativo" — mismos controles visuales que el toggle de activación que ya existía.

**Verificado en vivo** (empresa de prueba con `descontar_en_estado='en_proceso'`, `permitir_negativo=false`, `descontar_una_vez=true`; stock=2, OS pide 5): el descuento ocurre exactamente una vez, justo en el check-in (no en check-out ni en finalizar); aparece la advertencia de stock negativo solo por `permitir_negativo=false`; el movimiento queda `origen='automatico'`; no se generan movimientos adicionales en los otros dos puntos.

---

## Bloque C/D — Dashboard de inventario y distinción manual/automático

El ajuste manual (acción "Ajustar" con Entrada/Salida/Cantidad/Notas) **ya existía** como fila inline en `registros/inventario` — no se duplicó.

- 4 tarjetas de resumen nuevas: SKUs con stock, Cantidad total, Stock bajo, Sin stock (calculadas del listado de productos ya cargado).
- Badge "automático" junto a los movimientos con `origen='automatico'`, para distinguirlos de un vistazo de los ajustes manuales.
- `IconAlertTriangle` nuevo (no existía en el set de íconos propio).

---

## Bloque E — Sugerencias iniciales por rubro (mecanismo genérico, no hardcodeado por pantalla)

**No existía nada** — las 4 pantallas (Tipos de OS, Categorías de gasto, Catálogo, Tipos de documento) tenían cada una su propia lista `SUGERIDOS`/`SUGERIDAS` hardcodeada, sin relación con `empresas.rubro`.

- Migración 54: tabla `sugerencias_rubro` (rubro, tipo_sugerencia, valor, color, aplica_a, orden) — **sin `empresa_id` y sin RLS**, a propósito: es data de referencia global, mismo criterio que otras tablas de referencia del proyecto que solo toca el backend con service role.
- `backend/src/routes/sugerenciasRubro.ts` (nuevo): `GET /api/sugerencias-rubro` resuelve el rubro de la empresa del token y devuelve las sugerencias de ese rubro (arreglo plano, cada pantalla filtra por su `tipo_sugerencia`).
- Las 4 pantallas anteponen las sugerencias del rubro a su lista genérica existente **sin ocultarla** — así una empresa sin rubro cargado (o con rubro sin contenido todavía) sigue viendo exactamente lo mismo que antes, cero regresión.

**TODO explícito, tal como pedía el spec** (`backend/src/routes/sugerenciasRubro.ts` y migración 54): solo hay contenido real cargado para `rubro='transporte'` (2–3 sugerencias por tipo, como pedía el ejemplo mínimo del spec). `servicio_tecnico` y `otro` quedan sin sugerencias propias hasta que se defina ese contenido — es una decisión de producto, no técnica.

**Verificado en vivo**: `GET /api/sugerencias-rubro` con empresa `rubro='transporte'` devuelve sugerencias de los 4 tipos esperados.

---

## Bloque F — Plantillas de notificación: indicador "N de M completadas"

La sección "Mensajes personalizados" (`configuracion/notificaciones`) ya agrupaba por categoría (5 categorías: Cotizaciones, Órdenes de Trabajo/Servicio, Técnico en camino, Cobranzas, Agenda Pro) en acordeones — se reusó esa estructura, no se restructuró el modelo de datos.

- **Decisión pragmática** (quedaba como pregunta abierta en la investigación previa): "M" se cuenta como los 3 campos personalizables de cada mensaje (WhatsApp / asunto de correo / cuerpo de correo), no como los 7 `TipoNotificacionCliente` del ejemplo "2 de 7" del spec — hacerlo por esos 7 hubiese requerido restructurar `mensajes_personalizados` (que vive agrupado por `TipoMensajePersonalizado`, un enum de 5, no de 7).
- Badge "N de 3 completados" por categoría (en vivo mientras se edita, antes de guardar) + contador total "X de 5 completados" en el header de la tarjeta.

---

## Bloque G — Gastos: vínculo a OS, fecha de pago condicional, ficha de detalle

Puntos 12/13 del spec (vínculo a una OS vía `trabajo_id` + selector; creación inline de categoría con "+") **ya existían** — sin cambios.

- Punto 14: campo "Fecha de pago" en el formulario, visible y requerido solo cuando Estado=Pagado (el backend ya aceptaba `fecha_pago` desde antes, no hacía falta tocarlo).
- Punto 15: nueva ficha `web/dashboard/gastos/[id]` con tarjetas agrupadas (Información del Gasto, Proveedor, Categoría, Información Adicional); nuevo `GET /api/gastos/:id` en el backend (no existía); enlazada desde la descripción de cada fila en el listado.

**Verificado en vivo**: gasto creado con `estado=pagado` + `fecha_pago` explícita persiste esa fecha; `GET /api/gastos/:id` trae `categoria_info` anidada correctamente.

---

## Bloque H — Panel de Acciones reutilizable

**No existía** — Cotización y Cobro tenían cada una sus propios botones sueltos repartidos por la pantalla.

- `web/src/components/PanelAcciones.tsx` (nuevo): drawer lateral genérico con 4 secciones opcionales (`seccionEstado`, `seccionCompartir`, `seccionOtras`, `seccionPeligro`), cada una un `ReactNode` — a propósito no es una API rígida de lista de acciones, porque Cotización tiene infraestructura real de compartir (PDF/WhatsApp/Email) y Cobro no; forzar paridad hubiera significado botones falsos en Cobro que no llaman a nada.
- `cotizaciones/[id]`: el botón Eliminar suelto del header, el link "Editar" inline y la tarjeta completa de "PDF de la cotización" se reemplazaron por un único botón "Acciones" que abre el panel, con las 4 secciones armadas a partir de los handlers que ya existían (nada de lógica nueva, solo reorganización).
- `cobros/[id]` (ver Bloque J) usa el mismo componente.

---

## Bloque I — Estado "Expirado" de Cotización

El valor `"expirado"` ya era aceptado por el backend como estado válido, pero **nada lo calculaba ni lo persistía** — el frontend simulaba una "vencida" visual comparando fechas en el cliente, sin tocar la base.

- `backend/src/routes/cotizaciones.ts`: `marcarCotizacionesExpiradas(empresaId)` (nueva) — chequeo perezoso (sin infraestructura de cron en el proyecto, mismo patrón que `generarVencimientosPerezosos`), pero **awaited de forma síncrona** antes de responder (a diferencia del chequeo de notificación de al lado, que es fire-and-forget) para que el estado ya esté actualizado en la misma respuesta. Se llama al principio de `GET /` y `GET /:id`.
- Frontend (`cotizaciones/page.tsx` y `[id]/page.tsx`): se eliminó el cálculo sintético `estadoMostrado()`/`vencida` — ahora todo usa `cotizacion.estado` real.
- `docs/5_Estados_Cotizacion.mermaid` actualizado con las transiciones `Borrador/Enviada → Expirada → [*]`.

---

## Bloque J — Cobro: combobox de cliente + Registrar Pago

- El selector de cliente del formulario manual de "Nuevo Cobro" era un `<Select>` simple — se reemplazó por `ComboboxCliente` (el mismo componente de buscar/crear ya usado en OS y Cotizaciones), sin reconstruirlo.
- Cobro **no tenía ficha de detalle** — se creó `web/dashboard/financiero/cobros/[id]` (nueva), con `PanelAcciones` (sección Estado con el shortcut "Marcar como Pagada", sección Otras = "Registrar Pago", sección Peligro = "Eliminar cobro" bloqueada si ya está pagado).
- Nuevos endpoints backend: `GET /api/cobros/:id` y `DELETE /api/cobros/:id` (403 si `estado='pagada'`) — no existían.
- Modal "Registrar Pago": valor original (solo lectura, de referencia), fecha del pago, valor recibido, forma de pago, observaciones → hace `PATCH` con `estado:'pagada'` + los 4 campos nuevos (`facturas.valor_recibido`, `facturas.observaciones_pago`, migración 54). Funciona sin ninguna pasarela de pago real detrás, tal como pedía el spec.

---

## Bloque A — Login con Google

- `web/app/login/page.tsx`: botón "Iniciar sesión con Google" vía `supabase.auth.signInWithOAuth({ provider: 'google' })` — flujo separado del login por contraseña (ese pasa por `POST /api/auth/login` para el gate de 2FA; Google no pasa por ahí, es OAuth directo de Supabase).
- `web/app/auth/callback/page.tsx` (nuevo): espera la sesión OAuth y sigue el mismo camino que el login por contraseña — `GET /api/me` decide `/dashboard` (usuario ya asociado a una empresa) vs `/onboarding` (cuenta nueva o huérfana). Confirmado por lectura de código que `/api/me` y `/onboarding` son agnósticos a cómo se creó la fila en `auth.users` (password vs OAuth) — no hizo falta ningún cambio de backend para que una cuenta nueva por Google pase por el mismo alta de empresa que una por contraseña.
- **TODO explícito** (comentario en `auth/callback/page.tsx`): si el correo de Google coincide con una invitación pendiente (tabla `invitaciones`), hoy no se detecta automáticamente — es una limitación preexistente de `/onboarding` para cualquier método de login, no algo nuevo de este bloque.
- **Pendiente del lado del usuario, no de código**: habilitar el proveedor Google en Supabase Auth (Dashboard → Authentication → Providers, con Client ID/Secret de Google Cloud) — no hay API para hacerlo desde el repo. Sin ese paso manual, el botón queda visible pero el flujo de Google fallará.
- **No verificado en vivo**: requiere el proveedor habilitado en el dashboard de Supabase (paso manual pendiente arriba) y un flujo real de consentimiento de Google en navegador — fuera del alcance de la verificación automatizada con empresas desechables usada en el resto de los bloques.

---

## Cómo se verificó (bloques A–J)

`npx tsc --noEmit` limpio en `backend` y `web` después de cada bloque commiteado.

Verificación en vivo con datos desechables (empresa/usuario creados y borrados en la misma corrida):
- **Bloque B**: descuento configurable dispara exactamente una vez, en el estado configurado (no en los otros dos puntos donde cambia `estado_os`), con advertencia de stock negativo y `origen='automatico'` correctos.
- **Bloque E**: `GET /api/sugerencias-rubro` devuelve las sugerencias de las 4 categorías para una empresa `rubro='transporte'`.
- **Bloque G**: gasto con `fecha_pago` explícita la persiste; `GET /api/gastos/:id` trae la categoría anidada.

No se hizo click-through de UI con Playwright para las pantallas nuevas/reescritas de esta sección (Panel de Acciones, ficha de Cobro, ficha de Gasto, formulario de inventario configurable, botón de Google) — reusan componentes y patrones ya probados del proyecto (`Modal`, `Card`, `ComboboxCliente`, `SelectCrear`) y el backend que consumen quedó verificado por separado. Bloque A además depende del paso manual pendiente (habilitar el proveedor en Supabase) para poder probarse de punta a punta.

## Decisiones tomadas por mi cuenta (no explícitas en el spec)

- Bloque E: sugerencias del rubro se anteponen a la lista genérica existente en vez de reemplazarla — así ninguna empresa pierde las sugerencias que ya tenía si su rubro no tiene contenido cargado todavía.
- Bloque F: "M" del indicador de progreso se definió como los 3 campos por mensaje (no los 7 `TipoNotificacionCliente`) para no restructurar el modelo de datos existente — ver detalle en la sección del bloque.
- Bloque H: `PanelAcciones` con secciones opcionales (`ReactNode`), no una API de lista de acciones — Cotización y Cobro tienen capacidades reales distintas (compartir por PDF/WhatsApp/Email vs. no) y no quería fabricar botones sin funcionalidad real detrás.
- Bloque I: el chequeo de expiración se dejó `await`-eado de forma síncrona (no fire-and-forget) para que el estado ya esté correcto en la misma respuesta que lo devuelve — a diferencia del patrón fire-and-forget de la notificación de al lado, que no bloquea la respuesta porque no afecta el dato que se está devolviendo.
- Bloque A: el alta/cambio de proveedor OAuth es 100% responsabilidad del usuario en el dashboard de Supabase — no hay endpoint de administración de proveedores en la API de Supabase que se pueda invocar desde el backend propio.

---
---

# Resumen de trabajo — Diferenciación de planes, límites de uso, resiliencia

Rama: `feat/planes-limites-y-resiliencia`, desde `main` (con las dos secciones de arriba ya mergeadas). No mergeada, sin push.

Pedido en dos partes: (1) diferenciar de verdad Trial/Básico/Pro, hoy prácticamente idénticos salvo Agenda Pro; (2) dos riesgos de escala detectados en un análisis de costos previo — PDF síncrono/CPU-bound bloqueando el event loop, y ninguna cola/límite para las llamadas a Claude.

Antes de escribir código se hizo un análisis de costos real (pricing en vivo de Claude API y Supabase, no inventado): el costo marginal por cliente (IA + storage) es de centavos de dólar incluso en los topes más generosos — el costo real es el piso fijo compartido de infraestructura (~US$70/mes), no el uso por empresa. Esto definió que los límites de uso son un freno anti-abuso, no un control de costo — se fijaron generosos a propósito.

---

## 1 — Trial vencido: bloqueo total

`empresas.plan` solo sale de `'trial'` al confirmarse una tarjeta (`cambiarPlanEmpresa`, disparado desde `suscripcion.ts`) — así que si una empresa sigue en `'trial'` pasada `prueba_termina_en`, es que nunca eligió un plan pago. Gate agregado en `requiereEmpresa` (`backend/src/empresa.ts`), mismo patrón que `suspendida`/`dada_de_baja` y `MFA_REQUERIDA` ya existentes: 403 con `code: "TRIAL_VENCIDO"` en todo excepto `/api/plan*` y `/api/suscripcion*`, para que la empresa pueda seguir eligiendo un plan y salir del bloqueo.

`GET /api/plan` expone `trialVencido: boolean` (no un 403 propio — esa ruta está exceptuada del gate a propósito) y `DashboardShell.tsx` lo chequea proactivamente al montar (mismo criterio que el chequeo de 2FA que ya existía ahí), redirigiendo a Configuración > Plan, donde se agregó un banner explícito.

## 2 — Informe con IA y Asistente pasan a ser exclusivos de Pro

Se sumaron a `MODULOS_OPCIONALES` (antes solo `agenda_pro`). El gate de backend (`requiereModulo`) y el ocultamiento de sidebar ya eran genéricos vía `empresa_modulos` — no hubo que tocar nada de esa parte. Migración 55 hace el backfill explícito para empresas existentes según su plan actual (sin esto, el nuevo default "opt-in = desactivado" las hubiera dejado sin el módulo de golpe, sin importar si ya lo usaban).

## 3 — Límites de uso por plan (usuarios, OS/mes, storage, IA)

`LIMITES_POR_PLAN` en `packages/shared/src/limites.ts` — único lugar con los números:

| Límite | Trial | Básico | Pro |
|---|---|---|---|
| Usuarios | 3 | 5 | 15 |
| OS/mes | 30 | 100 | ilimitado |
| Storage | 2 GB | 10 GB | 50 GB |
| IA (tokens/mes) | 500.000 | 1.500.000 | 5.000.000 |

Enforcement en `backend/src/limites.ts` (`LimiteAlcanzadoError`, status 403), un `verificarLimiteX` por eje:
- **Usuarios**: cuenta `usuarios` activos antes de invitar.
- **OS/mes**: cuenta `trabajos` creados este mes antes de crear uno nuevo.
- **Storage**: contador aproximado (`empresas.storage_bytes_usado`, migración 56, incrementado por la propia app en cada subida vía la función `incrementar_storage_usado`) — **no** se mide escaneando los buckets S3 en cada request (eso ya lo hace `medirUsoStorage` para el Panel de Super-Admin) porque sería demasiado lento en el camino caliente de cada subida. Enganchado en las 5 subidas que de verdad escalan con el uso (`subirFoto`, `subirAnexo`, `subirComprobante`, `subirDocumento`, `subirFotoGuia`) — se dejaron afuera a propósito las subidas "singleton" (firma, logo, foto de perfil, PDF de cotización cacheado), que no crecen sin límite.
- **IA**: suma mensual de `ia_uso` antes de llamar a Claude, en `crearMensajeIA` (único punto que llama a la API).

El handler de errores global (`server.ts`) ahora respeta un `.status` opcional en cualquier error y solo registra en `errores_backend` los `>= 500` — un límite alcanzado es un freno esperado del negocio, no un bug, y no debía ensuciar esa tabla.

**Verificado en vivo** (empresa desechable): los 4 límites bloquean con el mensaje esperado exactamente al alcanzarse, y no bloquean con uso bajo.

## 4 — PDF: caché para OS + generación en worker_thread

- **Caché de OS** (`ordenes_servicio.pdf_url`, migración 57): mismo patrón que el de cotización (que ya existía), pero solo empieza a cachear una vez que la OS queda **firmada** — antes de eso el contenido todavía puede cambiar (checklist, fotos, firma). Firmada, `ordenes_servicio` ya queda inmutable (guard de "OS finalizada" existente), así que no hace falta invalidación.
- **worker_thread** (`backend/src/pdfWorkerPool.ts` + `workers/pdfWorker.ts`): los 3 generadores (OS, cotización, informe) ahora corren fuera del proceso principal — `pdfkit` es síncrono/CPU-bound, así que una generación pesada ya no bloquea el event loop que atiende el resto del tráfico mientras se genera. Gotcha real encontrado y resuelto: en dev (`tsx watch`), un `worker_thread` nuevo **no hereda** el loader de TypeScript del proceso principal (`Unknown file extension ".ts"` al primer intento) — hay que pasarle `execArgv: ["--require", "tsx/cjs"]` explícito al crear el Worker; en producción (compilado a `.js` vía `tsc`) no hace falta nada de esto, se resuelve solo por extensión de archivo.

**Verificado en vivo**: PDF de OS sin firmar se genera sin cachear; se cachea recién al firmar; una segunda lectura viene del caché (mismo `pdf_url`, no se regenera). PDF de cotización confirmado que sigue funcionando igual tras pasar por el worker.

## 5 — Límite de concurrencia para Claude + registro de 429

`backend/src/concurrencia.ts`: semáforo simple en memoria (sin dependencia externa tipo `p-limit`) que capa a **8** las llamadas simultáneas a Claude desde `crearMensajeIA` — antes nada evitaba que un pico de empresas a la vez (ej. todas subiendo fotos de una OS al mismo tiempo) disparara todo junto. El SDK ya reintenta solo ante un 429, pero eso no evitaba el pico en sí. Un 429 real ahora se registra explícito en `errores_backend` (visible en el Panel de Super-Admin) — no pasa por el handler global (que ignora los 4xx a propósito), porque sí conviene saber si esto llega a pasar de verdad.

**Verificado**: semáforo bajo carga sintética (20 tareas, cupo 3) nunca excede el máximo y no pierde ninguna tarea.

## Cómo se verificó

`npx tsc --noEmit` limpio en `backend` y `web` después de cada commit. Verificación en vivo con empresas/usuarios desechables (creados y borrados en la misma corrida) para: los 4 límites de uso, el gate de trial vencido (`GET /api/clientes` → 403 `TRIAL_VENCIDO`, `GET /api/plan` → `trialVencido: true`), el caché + worker_thread de PDF de OS, el PDF de cotización tras el cambio, y el semáforo de concurrencia en aislado.

No se probó en vivo: el flujo completo de cambio de plan con Flow real (usa el mismo mecanismo ya probado en sandbox de la sección de Suscripción B2B, sin cambios acá) ni un 429 real de Anthropic (requeriría forzar el rate limit real de la cuenta).

## Decisiones tomadas por mi cuenta (no explícitas en el pedido)

- Los números de `LIMITES_POR_PLAN` son una propuesta inicial basada en el análisis de costos (freno anti-abuso, no de costo) — quedan fáciles de ajustar en un solo lugar si no calzan con la realidad una vez en uso.
- Storage: contador aproximado incrementado por la app, no un total exacto — decisión de performance (evitar escanear S3 en cada subida), documentada explícita en el código para que no se confunda con el número exacto que sí calcula `medirUsoStorage` para el Super-Admin.
- Se descartó agregar `p-limit` como dependencia nueva — un semáforo de ~30 líneas cubre el caso sin sumar una dependencia externa, coherente con el criterio ya usado en el resto del proyecto (sin ORM, sin librería de componentes UI) de preferir código propio chico antes que una dependencia para algo simple.
- El backfill de módulos Pro (migración 55) sincroniza empresas existentes según su plan actual en vez de dejarlas perder el módulo silenciosamente — no hay clientes reales en producción todavía (repo sin deploy activo), pero se hizo igual por prolijidad de los datos de prueba/demo.
