# Exploración: adicionales por empresa en la suscripción Flow

> Solo investigación, no se tocó código. Fecha: 2026-09-24.
> Fuente principal: la especificación OpenAPI oficial que sirve la página
> https://www.flow.cl/docs/api.html. Esa página es un ReDoc que carga
> `https://www.flow.cl/docs/apiFlow.yaml?v=7` (versión 3.0.1 de la API,
> 6500 líneas). Los números de línea `L…` citados abajo son de ese YAML,
> descargado hoy. Anclas ReDoc: `https://www.flow.cl/docs/api.html#tag/<tag>`
> (tags: `plans`, `subscription`, `subscription_items`, `coupon`,
> `invoice`, `customer`).
>
> Marcas usadas: **[DOC]** lo dice textualmente la documentación oficial;
> **[INFERIDO]** se deduce de la documentación pero no está dicho;
> **[NO CONFIRMADO]** no está en la documentación y hay que probarlo en el
> sandbox antes de confiar en eso.

---

## 0. Qué usa hoy bitacora

- `backend/src/flow.ts`: `customer/create`, `customer/get`,
  `customer/register`, `customer/getRegisterStatus`, `subscription/create`
  (solo `customerId` y `planId`), `subscription/cancel` (sin
  `at_period_end`, o sea que cancela de inmediato), `subscription/get` y
  `payment/getStatus` (webhook).
- Hay 4 planes creados a mano en el panel de Flow y referenciados con
  `FLOW_PLAN_ID_BASICO/OPERACION/PRO/EMPRESA` (`env.ts` L87-90,
  `flowPlanIdDe`).
- `routes/suscripcion.ts`: registra la tarjeta y, al confirmarla, llama a
  `subscription/create` con el plan pendiente. **Hoy no existe ningún
  cambio de plan del lado de Flow**: `cambiarPlanEmpresa` solo cambia el
  plan en nuestra base de datos.
- **Hallazgo importante:** el comentario de `flow.ts` dice que "plan/create,
  plan/get y plan/list no existen". Es correcto *en singular*, pero la API
  documenta **`/plans/create`, `/plans/get`, `/plans/edit`,
  `/plans/delete` y `/plans/list` en plural** (L2331-2660,
  https://www.flow.cl/docs/api.html#tag/plans). Lo más probable es que la
  prueba contra el sandbox usara la ruta en singular. **[NO CONFIRMADO en
  sandbox]**, pero está documentado: los planes **sí** se pueden crear por
  API.

---

## 1. ¿Una suscripción Flow puede tener ítems adicionales o un monto variable?

**Sí, con "Items adicionales de suscripción"** (tag `subscription_items`,
https://www.flow.cl/docs/api.html#tag/subscription_items). La introducción
del doc los lista como recurso propio: *"Subscriptions Items (Items
adicionales de suscripciones)"* (L24). **[DOC]**

### 1.1 Catálogo de ítems (entidad global del comercio, no de una suscripción)

| Endpoint | Parámetros | Notas |
|---|---|---|
| `POST subscription_item/create` (L3309) | `name`, `currency`, `amount` (todos obligatorios) | *"Monto del item adicional, si es negativo es un descuento, si es positivo un recargo"* **[DOC]**. Devuelve `ItemAdditional` con un `id` numérico. |
| `GET subscription_item/get` (L3361) | `itemId` | |
| `POST subscription_item/edit` (L3405) | `itemId`, `name?`, `amount?`, `changeType` | `changeType` es obligatorio si mandás `name` o `amount`: `to_future` = *"Solo para suscripciones futuras"*, `all` = *"Actualiza para las suscripciones actuales y futuras"* **[DOC]**. |
| `POST subscription_item/delete` (L3463) | `itemId`, `changeType` (`to_future` / `all`) | |
| `GET subscription_item/list` (L3514) | `start`, `limit` (máx. 100), `filter`, `status` | |

El esquema `ItemAdditional` (L5487) tiene `id`, `name`, `amount`,
`currency`, **`associatedSubscriptionsCount`**, `status` y `created`. Eso
confirma que **el ítem es una entidad de catálogo compartida**, con un
monto fijo, que se asocia a N suscripciones. **[DOC]**

### 1.2 Asociar o quitar un ítem en una suscripción

| Endpoint | Parámetros |
|---|---|
| `POST subscription/addItem` (L3059) | `subscriptionId`, `itemId` |
| `POST subscription/deleteItem` (L3107) | `subscriptionId`, `itemId` |

Ambos devuelven `SubscriptionItemChangeResponse {sub_id, item_id, success}`
(L6382). **[DOC]**

### 1.3 Limitaciones importantes

- **No hay parámetro de cantidad** (`quantity`) en `addItem` ni en ningún
  endpoint de ítems. Busqué "quantity/cantidad" en todo el YAML y no
  aparece. **[DOC, por ausencia]** Por lo tanto "usuario extra 0,2 UF × N"
  no se puede modelar como "ítem × cantidad".
- **¿Se puede agregar el mismo ítem 2 veces a una suscripción?** No está
  documentado. **[NO CONFIRMADO]** No conviene depender de eso.
- **El monto de un ítem no se puede sobrescribir por suscripción.** Si se
  edita con `changeType=all`, cambia en *todas* las suscripciones que lo
  tienen. **[DOC]** El truco para tener un monto por empresa es **un ítem
  por empresa** (ver la recomendación).
- **Prorrateo al agregar o quitar un ítem a mitad de ciclo:** no está
  documentado. **[NO CONFIRMADO]** Lo más probable es que aplique desde el
  próximo importe (invoice).
- **Decimales en UF** (p. ej. `amount=0.2` con `currency=UF`): el tipo es
  `number`, pero no hay ningún ejemplo en UF. **[NO CONFIRMADO]**
- **¿La moneda del ítem tiene que coincidir con la del plan?** No está
  documentado. **[NO CONFIRMADO]**
- **¿En qué momento se "congela" el monto editado?** No se sabe desde
  cuándo un `edit` con `all` ya no afecta al importe del período en curso
  (¿el importe se genera en `next_invoice_date`?). **[NO CONFIRMADO]**
- El invoice sí muestra el detalle por líneas: `InvoiceItem.type` = 1
  cargo por plan, 2 descuento, 3 ítem pendiente, 9 otros (L5638). **[DOC]**
  No está documentado con qué `type` aparece un ítem adicional. **[NO
  CONFIRMADO]**

### 1.4 Otras palancas para variar el monto

- **Cupones** (https://www.flow.cl/docs/api.html#tag/coupon):
  `coupon/create` (L3579) recibe `name`, `percent_off` (0-100, con 2
  decimales) **o** `currency` + `amount`, `duration` (1 definida / 0
  indefinida), `times` (en suscripciones cuenta *"períodos del Plan"*),
  `max_redemptions`, `expires` y **`discount_scope`** (0 = solo el plan
  base, 1 = *"plan base + adicionales de la suscripción"*; solo aplica a
  cupones de porcentaje). `subscription/addCoupon` (L2966) recibe
  `subscriptionId` y `couponId`, y *"Si la suscripción ya tenía un
  descuento, será reemplazado por este"*: **un solo cupón a la vez**.
  `subscription/deleteCoupon` (L3015). `coupon/edit` solo permite cambiar
  el nombre (L3656). **[DOC]** Los cupones sirven para descuentos
  (promociones), no para recargos.
- **Ítem con monto negativo** = descuento recurrente (L3340). **[DOC]**
- **Cambiar de plan**: ver §5.
- **Override del monto por suscripción:** no existe. `subscription/create`
  solo acepta `planId`, `customerId`, `subscription_start`, `couponId`,
  `trial_period_days` y `periods_number` (L2661-2745). **[DOC]**
- **Editar el monto del plan:** `plans/edit` (L2466) dice *"Si el plan
  tiene clientes suscritos sólo se puede modificar el campo
  trial_period_days"*. **[DOC]** O sea que no se puede subir el precio de
  un plan que ya tiene suscriptores.

---

## 2. ¿Los planes soportan UF o solo CLP?

- `plans/create` → `currency`: *"Moneda del Plan, por omisión CLP"* (L2360).
  La documentación **no enumera** los valores permitidos. **[DOC]**
- `plans/create` tiene **`currency_convert_option`**: *"Si hay conversión
  de moneda, en qué momento hará la conversión: 1 al pago (default), 2 al
  importe (invoice)"* (L2395, también en el esquema `Plan`, L5285). **[DOC]**
  Esto indica que un plan puede estar en una moneda distinta de CLP y que
  Flow la convierte a pesos **al momento del pago** o **al generar el
  importe**. **[INFERIDO]**: con un plan en UF, Flow calcula el monto en
  CLP con el valor UF del día del pago (opción 1) o del día en que se
  genera el invoice (opción 2).
- En `customer/charge` y `customer/collect`, `currency` es *"Moneda del
  cargo (CLP, UF)"* (L1789, L1862). **[DOC]** **El código de moneda es
  `UF`, no `CLF`.** La documentación de Flow no menciona `CLF` en ninguna
  parte.
- En la FAQ oficial, pregunta 25: *"En Chile, los comercios pueden cobrar
  únicamente en CLP o UF."* (https://web.flow.cl/es-cl/ayuda/). **[DOC]**
- La documentación **no dice explícitamente** "`plans/create` acepta
  `currency=UF`". La página https://developers.flow.cl/en/docs/suscripciones/create-plan
  solo menciona CLP. **[NO CONFIRMADO]**, aunque es muy probable por la
  existencia de `currency_convert_option` y porque el panel de Flow
  históricamente ofrece UF. Hay que confirmarlo creando un plan UF en el
  sandbox.
- Fuente del valor UF, redondeo y montos con decimales en UF: no están
  documentados. **[NO CONFIRMADO]**
- Monto mínimo: el ejemplo del esquema `Invoice.errorDescription` es *"The
  minimum amount is 350 CLP"* (L5601). **[DOC, solo como ejemplo]**
- **IVA:** Flow cobra el `amount` tal cual, y no hay ningún parámetro de
  impuesto en planes ni en ítems. **[DOC, por ausencia]** Los montos
  cargados en Flow deben venir **con IVA incluido**. Por ejemplo, 1,5 UF +
  IVA = 1,785 UF, y 0,2 UF + IVA = 0,238 UF.

---

## 3. Cobro anual

- `interval` en `plans/create`: *"1 diario, 2 semanal, 3 mensual, 4
  anual"* (L2367). `interval_count` sirve como multiplicador (su ejemplo:
  interval=2 con interval_count=2 da un cobro quincenal) (L2375). **[DOC]**
- Para el cobro anual con "10 meses" hay que crear **planes anuales
  aparte** (`interval=4`, `interval_count=1`) con `amount` = 10 × la
  mensualidad con IVA. Por ejemplo, Esencial anual = 17,85 UF. **[DOC +
  decisión nuestra]** También sirve `interval=3` + `interval_count=12`
  **[INFERIDO]**, pero `interval=4` es lo más claro.
- **Ojo con los ítems en un plan anual:** el ítem se suma a cada importe,
  y en un plan anual hay un importe al año. Entonces el ítem de adicionales
  de una empresa anual tiene que valer 10 × el monto mensual de sus
  adicionales. **[INFERIDO]** Si la empresa agrega adicionales a mitad de
  año, Flow no cobra la diferencia sola **[NO CONFIRMADO]**. Habría que
  cobrarla aparte con `customer/charge` (ver §4) o dejarla para la
  renovación.
- Alternativa con cupón: dejar el plan mensual y aplicar un cupón de
  porcentaje no convierte el pago en anual por adelantado. No sirve para
  esto.
- Cambiar de mensual a anual con `subscription/changePlan`: el esquema de
  preview trae `interval` para el plan viejo y el nuevo (L6440-6500), lo
  que sugiere que se permite cambiar entre intervalos distintos.
  **[INFERIDO / NO CONFIRMADO]**

---

## 4. Alternativas si los adicionales no calzan: cobros aparte con la tarjeta registrada

Todos están en https://www.flow.cl/docs/api.html#tag/customer:

| Endpoint | Qué hace | ¿Cobra la tarjeta sin que el cliente la vuelva a ingresar? |
|---|---|---|
| `POST customer/charge` (L1742) | *"efectuar un cargo automático en la tarjeta de crédito previamente registrada por el cliente. Si el cliente no tiene registrada una tarjeta el metodo retornará error."* Parámetros: `customerId`, `amount`, `subject`, `commerceOrder`, `currency` (CLP, UF) y `optionals`. Devuelve `PaymentStatus` **de forma síncrona**. | **Sí** **[DOC]** |
| `POST customer/collect` (L1807) | *"Si el cliente tiene registrada una tarjeta de crédito se le hace un cargo automático, si no tiene registrada una tarjeta de credito se genera un cobro. Si se envía el parámetro byEmail = 1, se genera un cobro por email."* Parámetros: `customerId`, `commerceOrder`, `subject`, `amount`, `currency` (CLP, UF), `urlConfirmation`, `urlReturn`, `byEmail`, `forward_days_after`, `forward_times`, `ignore_auto_charging` y `timeout`. Devuelve `CollectResponse` con `type` (1 automático, 2 link, 3 email) y `paymenResult`. | **Sí** si hay tarjeta; si no, cae a un link de pago **[DOC]** |
| `POST customer/batchCollect` (L1902) + `customer/getBatchCollectStatus` | Lo mismo que collect, pero en lote y asíncrono, con `urlCallBack` | Sí **[DOC]** |
| `POST customer/reverseCharge` (L2068) | Reversa un cargo | — |
| `GET customer/getCharges`, `customer/getChargeAttemps` | Historial de cargos | — |
| `POST payment/create` (L978) | Crea una orden de pago con URL: el pagador va a Flow y paga. | **No**: exige que el cliente pague en la página de Flow **[DOC]** |

- Requisito comercial: tener contratado el medio de pago **"Cargo
  Automático"**. Si no, Flow manda un cobro por email
  (https://web.flow.cl/es-cl/preguntas-frecuentes/cargo-automatico/). **[DOC]**
- Reintentos: `customer/charge` es un intento único y síncrono. No trae
  los reintentos automáticos que sí tienen los planes
  (`charges_retries_number`). Los reintentos corren por nuestra cuenta.
  **[INFERIDO]**
- También está `invoice/retryToCollect`, que reintenta un invoice vencido
  de la suscripción (L4066), además de `invoice/getOverDue`,
  `invoice/cancel` e `invoice/outsidePayment`
  (https://www.flow.cl/docs/api.html#tag/invoice). **[DOC]**

---

## 5. Cambio de plan a mitad de ciclo (prorrateo)

https://www.flow.cl/docs/api.html#tag/subscription

- `POST subscription/changePlan` (L3156): recibe `subscriptionId`,
  `newPlanId` y `startDateOfNewPlan?` (YYYY-mm-dd). La fecha *"debe estar
  en el rango del ciclo de facturación actual de la suscripción"* y *"puede
  ser a futuro"*. **[DOC]**
- La respuesta `SubscriptionChangePlanResponse` (L6338) trae
  **`balance`**: *"Saldo prorrateado (si es negativo es un descuento, si es
  positivo es un cargo que se cobrará al momento de cambiar el plan)"*.
  También trae `old_amount`/`new_amount`, las monedas y
  `start_date_of_new_plan`. **[DOC]** O sea: **Flow prorratea**. En un
  upgrade cobra la diferencia al tiro; en un downgrade deja un saldo a
  favor (`Subscription.discount_balance`, L5390).
- `POST subscription/changePlanPreview` (L3210): calcula lo mismo sin
  aplicarlo. Devuelve `balance.amount`, `credit_expiration_date`,
  `credit_expiration_amount`, `credit_expiration_warning` (el saldo a
  favor puede vencer sin usarse), `next_invoice_date` y los datos de
  `old_plan`/`new_plan`. **[DOC]**
- `POST subscription/changePlanCancel` (L3264): cancela un cambio
  programado. La suscripción expone `newPlanId`,
  `new_plan_scheduled_change_date` e `in_new_plan_next_attempt_date`.
  **[DOC]** Que exista `in_new_plan_next_attempt_date` sugiere que el
  cobro del balance positivo se reintenta si falla. **[INFERIDO]**
- Detalle exacto de la fórmula de prorrateo (¿por días?) y comportamiento
  con planes en UF: no documentados. **[NO CONFIRMADO]**
- Hoy bitacora **no llama a `changePlan`**. Si una empresa cambia de plan
  en la app, Flow le sigue cobrando el plan original. Es un hueco aparte
  de los adicionales, pero conviene cerrarlo en el mismo trabajo.

---

## 6. Recomendación

### Opción A (recomendada): plan base + **un ítem adicional por empresa** con el total de sus adicionales

**Cómo funciona**

1. Se mantienen los planes base, en UF con IVA incluido: 4 mensuales + 4
   anuales (monto = 10 meses). Se pueden seguir creando a mano en el panel
   o, mejor, con un script único que use `plans/create`, dejando los ids
   en `FLOW_PLAN_ID_*` (más 4 nuevos `FLOW_PLAN_ID_*_ANUAL`).
2. Cuando una empresa tiene adicionales por primera vez, el backend llama
   a `subscription_item/create` (`name` = "Adicionales Bitácora –
   <empresa>", `currency=UF`, `amount` = total mensual con IVA, o × 10 si
   es anual) y después a `subscription/addItem`. El `itemId` se guarda en
   `suscripciones` (columna nueva, p. ej. `flow_item_adicionales_id`).
3. Nuestro backend calcula el total: usuarios extra × 0,2, más
   max(1; 0,06 × trabajadores), más módulos extra × 0,5, más pack IA 1,5,
   y todo × 1,19. Cuando el total cambia, se llama a
   `subscription_item/edit` con `changeType=all`. Como ese ítem pertenece a
   una sola suscripción, "all" solo afecta a esa empresa. Si el total queda
   en 0, se usa `subscription/deleteItem`.
4. Para remuneraciones, que varía cada mes: un cron diario revisa las
   suscripciones cuyo `next_invoice_date` (de `subscription/get`) sea
   mañana y recalcula el ítem antes de que se genere el importe.
5. Cambio de plan base: `subscription/changePlanPreview` para mostrarle el
   monto al usuario y después `subscription/changePlan`. Flow prorratea.

**Pros**
- Un solo cobro mensual (o anual) por empresa, con la línea de
  adicionales separada del plan en el invoice.
- Reintentos, morosidad (`morose`), invoices y el webhook actual
  (`payment/getStatus` por token) quedan igual que hoy.
- Catálogo mínimo en Flow: solo 8 planes base. Los ítems los crea el
  backend.
- Poco código nuevo en `flow.ts`: unas 5 funciones delgadas.

**Contras y riesgos**
- El catálogo de ítems crece a 1 ítem por empresa. Es manejable (listas
  paginadas de 100), pero un poco raro.
- No hay prorrateo de adicionales a mitad de ciclo **[NO CONFIRMADO]**:
  hay que definir la política "se cobran desde el próximo ciclo" o cobrar
  la diferencia con `customer/charge`.
- Antes de programar hay que confirmar en el sandbox: (a) plan con
  `currency=UF`; (b) ítem con `currency=UF` y `amount` decimal, por
  ejemplo 0,238; (c) que `subscription_item/edit` con `all` se refleje en
  el próximo invoice de una suscripción ya activa; (d) qué pasa con
  `addItem` a mitad de ciclo y con qué `type` aparece en `invoice.items`;
  (e) moneda del ítem distinta de la del plan.

### Opción B: plan a medida por empresa (`plans/create`) + `subscription/changePlan`

- El backend crea un plan con el monto exacto (base + adicionales), por
  ejemplo `planId = emp_<empresaId>_v<n>`. Cuando algo cambia, crea un plan
  nuevo y llama a `changePlan`, porque `plans/edit` no puede cambiar el
  monto de un plan con suscriptores.
- **Pros:** prorrateo nativo de Flow en cada cambio y una sola línea en el
  invoice.
- **Contras:** el catálogo de planes explota (un plan nuevo por cada
  cambio). Remuneraciones cambiaría el plan todos los meses, y cada cambio
  a mitad de ciclo gatilla un cargo o crédito prorrateado inmediato, lo que
  complica la conciliación (con saldos a favor que pueden vencer). Además,
  dependemos de que `plans/create` funcione en plural en el sandbox.
- Solo conviene si la opción A falla en el sandbox (p. ej., ítems en UF no
  soportados).

### Opción C (fallback): suscripción solo al plan base + cobro mensual propio de adicionales con `customer/charge`

- Un cron nuestro calcula los adicionales y cobra la tarjeta ya registrada
  con `customer/charge` (`currency=UF`, `commerceOrder` único por empresa y
  período).
- **Pros:** control total, sirve para montos arbitrarios y para cobrar
  prorrateos o diferencias anuales. Está 100 % documentado **[DOC]**.
- **Contras:** 2 cargos por mes en la tarjeta del cliente. Los reintentos,
  la morosidad y la conciliación corren por nuestra cuenta, y hay que
  cuidar la idempotencia del cron. Aunque las comisiones no estén
  documentadas acá, cada cargo es una transacción aparte.
- Igual conviene como herramienta complementaria de A: para prorrateos
  puntuales y para la diferencia de adicionales en planes anuales.

### Qué crear en el panel y qué por API (con la opción A)

| Qué | Dónde |
|---|---|
| Contratar el medio de pago "Cargo Automático" (si no está) | Comercial / panel de Flow |
| 4 planes mensuales + 4 anuales en UF, con IVA incluido, `urlCallback` al webhook actual y reintentos | Panel **o** script único con `plans/create` (preferible: queda versionado). Ids en variables de entorno `FLOW_PLAN_ID_*`. |
| Ítem de adicionales por empresa | API: `subscription_item/create` + `subscription/addItem`, y después `edit`/`deleteItem` |
| Cambio de plan base | API: `subscription/changePlanPreview` + `subscription/changePlan` |
| Cupones promocionales (opcional) | Panel o `coupon/create`. Con `discount_scope=1`, el descuento cubre también los adicionales. |
| Cancelación al final del período | API: `subscription/cancel` con `at_period_end=1` (hoy se cancela de inmediato) |

### Pruebas mínimas en sandbox antes de implementar

1. `plans/create` (plural) con `currency=UF`, `amount=1.785` e `interval=3`.
2. `subscription_item/create` con `currency=UF` y `amount=0.238`, después
   `addItem` en una suscripción de prueba y `subscription/get` para ver
   `invoices[].items`.
3. `subscription_item/edit` con `changeType=all` y verificar el siguiente
   invoice (se puede usar `trial_period_days` corto o un plan con
   `interval=1`, diario, para acelerar el ciclo).
4. `subscription/changePlanPreview` de un plan mensual UF a uno anual UF.
5. `customer/charge` con `currency=UF` y un monto decimal.

---

## Fuentes

- Especificación oficial: https://www.flow.cl/docs/api.html (ReDoc) →
  https://www.flow.cl/docs/apiFlow.yaml?v=7
  - plans: L2331-2660 · subscription: L2661-3308 · subscription_items:
    L3309-3578 · coupon: L3579-3860 · invoice: L3861-4109 · customer
    charge/collect: L1742-2330 · esquemas Plan L5227, Subscription L5308,
    Coupon L5431, ItemAdditional L5487, Invoice L5519, InvoiceItem L5638,
    SubscriptionChangePlan* L6338-6500.
- Changelog de la API: https://www.flow.cl/docs/api_changelog.txt (no
  menciona ítems ni UF en planes).
- Colecciones Postman oficiales:
  https://www.flow.cl/docs/Flow%20Plans.postman_collection.json (solo
  ejemplos en CLP) y `Flow Subscription.postman_collection.json` (no
  incluye addItem ni changePlan: está desactualizada respecto del YAML).
- FAQ, "En Chile, los comercios pueden cobrar únicamente en CLP o UF":
  https://web.flow.cl/es-cl/ayuda/
- Cargo automático vs. suscripciones:
  https://web.flow.cl/es-cl/preguntas-frecuentes/cargo-automatico/
- Guía "Crear un plan" (solo menciona CLP):
  https://developers.flow.cl/en/docs/suscripciones/create-plan
