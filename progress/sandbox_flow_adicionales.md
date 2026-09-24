# Pruebas en SANDBOX de Flow — adicionales, planes UF y cambio de plan

Fecha: 2026-09-24. Entorno: `https://sandbox.flow.cl/api`. El script abortaba
si la URL no contenía "sandbox". Complementa `progress/explore_flow_adicionales.md`.
Script descartable: `scratchpad/flow/call.mts`. Replica la firma HMAC-SHA256
de `backend/src/flow.ts` y toma las credenciales de `backend/src/env.ts`.
No se imprimieron claves (se revisó el log: sin fugas).

## Resumen

| # | Prueba | Resultado |
|---|---|---|
| 1a | `plans/create` (plural), UF 1.785, interval=3 | **CONFIRMADO** |
| 1b | `plans/create`, UF 17.85, interval=4 (anual) | **CONFIRMADO** |
| 1c | `plan/get` (singular) | NO FUNCIONA (`105 No services available`). La ruta correcta es la plural. |
| 2 | `subscription_item/create` UF 0.238 | **CONFIRMADO** (el nombre solo puede tener letras, números y espacios) |
| 3 | `subscription_item/edit` changeType=all + `get` | **CONFIRMADO**. Se refleja en la suscripción activa. |
| 4a | `subscription/addItem` | **CONFIRMADO**. Además acepta `quantity`, un parámetro **no documentado**. |
| 4b | `subscription/get` (invoices/items) | **CONFIRMADO** |
| 4c | `subscription/changePlanPreview` mensual UF → anual UF | **CONFIRMADO** |
| 5 | `customer/charge` UF 0.238 | **CONFIRMADO** (cobro síncrono, pagado) |

**Hay que corregir `flow.ts`.** Su comentario dice que "plan/create, plan/get y
plan/list no existen". Es cierto solo para el **singular**. Las rutas
`plans/*` en plural sí existen y funcionan. Por lo tanto, los planes pueden
crearse por API.

## Detalle

### 1a. `POST plans/create` mensual UF
- Params: `planId=PRUEBA-BITACORA-MENSUAL-UF`, `name=<igual>`, `currency=UF`, `amount=1.785`, `interval=3`
- HTTP 200. Campos de la respuesta: `planId` (el mismo que enviamos, en texto), `currency:"UF"`, `amount:"1.7850"` (4 decimales), `interval:3`, `interval_count:1`, `trial_period_days:0`, `days_until_due:3`, `charges_retries_number:3`, `currency_convert_option:1` (valor por defecto), `status:1`, `public:0`, `urlCallback:null`.
- `plans/get` con el mismo `planId` devuelve lo mismo (HTTP 200).
- **CONFIRMADO.**

### 1b. `POST plans/create` anual UF
- Params: `planId=PRUEBA-BITACORA-ANUAL-UF`, `currency=UF`, `amount=17.85`, `interval=4`
- HTTP 200: `amount:"17.8500"`, `interval:4`, `interval_count:1`, sin otras diferencias con 1a.
- **CONFIRMADO.**

### 2. `POST subscription_item/create` UF con decimales
- Primer intento con `name=PRUEBA-BITACORA-ITEM-UF`: **HTTP 400**, código 1001, *"El nombre solo puede contener caractéres alfanuméricos."* Tampoco se aceptan guiones ni tildes (`"PRUEBA Bitácora acento"` también dio 400). Los espacios sí se aceptan.
  - **Consecuencia:** el nombre que proponía el informe (`"Adicionales Bitácora – <empresa>"`) **no sirve**. Hay que sanitizarlo a ASCII, dejando solo letras, números y espacios.
- `name="PRUEBA BITACORA ITEM UF"`, `currency=UF`, `amount=0.238`: HTTP 200. Respuesta: `id:851` (numérico), `amount:0.238` (number), `currency:"UF"`, `associatedSubscriptionsCount:0`, `status:1`.
- También se aceptó un monto negativo (descuento): `name="PRUEBA BITACORA NEG"`, `amount=-0.1`, que devolvió `id:852`.
- **CONFIRMADO.**

### 3. `subscription_item/edit` y `subscription_item/get`
- `edit itemId=851 amount=0.476 changeType=all`: HTTP 200 con `amount:0.476`. `get itemId=851` devuelve el valor ya actualizado.
- Con el ítem ya asociado a una suscripción activa (paso 4) se editó `amount=0.238 changeType=all`. Resultado: HTTP 200 y `associatedSubscriptionsCount:1`. Después, `subscription/get` mostró el ítem con `amount:0.238` y `updated_at` nuevo. **Con `all`, el cambio se refleja de inmediato en las suscripciones actuales.**
- **CONFIRMADO.**

### 4. Suscripción de prueba
- `customer/list`: hay 20 clientes y 2 tienen tarjeta de prueba registrada (Visa 6623): `cus_yb18b7f6ee` ("Test Suscripcion Empresa") y `cus_se2e0c9522`. El segundo tiene la suscripción activa `sus_m178acbe47` (plan `orbix-2026`), que **no se tocó**.
- Se creó una suscripción **nueva y descartable** para `cus_yb18b7f6ee` en el plan `PRUEBA-BITACORA-MENSUAL-UF`: `sus_y9d3b570dc` (HTTP 200).
  - Al crearla se generó y **cobró de inmediato** la primera factura (sin días de prueba). Factura `1215073`: `currency:"UF"`, `amount:"1.7850"`, `status:1`. En `invoice/get`: `payment.status:2` (pagado), `paymentData.conversionRate:"41008.10000"`, `amount:"73199.00" CLP` (1.785 × 41008,1 = 73199,46, redondeado a peso entero), `media:"Cargo automático"`. **Flow convierte la UF a CLP con el valor del día del cobro.**

#### 4a. `POST subscription/addItem`
- `subscriptionId=sus_y9d3b570dc`, `itemId=851`: HTTP 200 → `{sub_id, item_id:851, quantity:1, success:true}`.
- **Hallazgo:** `addItem` acepta **`quantity`**, aunque no está documentado. `itemId=852 quantity=3` devolvió `quantity:3`. En `subscription/get` el ítem aparece con `quantity:3` y `totalAmount:-0.30000000000000004`, un error de coma flotante del lado de Flow.
- Volver a llamar `addItem` sobre un ítem ya agregado da HTTP 400 *"The item is already added in the subscription"*. Para cambiar la cantidad hay que hacer `subscription/deleteItem` y después `addItem` con la nueva `quantity`. Se probó y funciona: con `quantity=5` la respuesta trajo `totalAmount:1.19` y un nuevo `s_item_id`.
  - Esto habilita el modelo "ítem por unidad (0,238 UF) × N". Aun así, conviene tratarlo con cautela porque el parámetro no está documentado.
- Agregar el ítem a mitad de ciclo **no cambió la factura ya emitida**, que siguió en 1.785. No hubo prorrateo ni factura extra. Se infiere que el ítem se cobra desde la próxima factura (`next_invoice_date` 2026-10-24), aunque eso no se pudo observar.
- **CONFIRMADO** (addItem y deleteItem).

#### 4b. `GET subscription/get`
- Devuelve `invoices[]` (id, currency, amount, period, status, due_date) e `items[]` (`s_item_id`, `item_id`, `name`, `currency`, `amount`, `quantity`, `totalAmount`, `amountFormat`, `adjustmentTypeLabel` "Aumenta"/"Disminuye"). También trae `newPlanId`, `new_plan_scheduled_change_date` y `discount`. **CONFIRMADO.**

#### 4c. `POST subscription/changePlanPreview` (mensual UF → anual UF)
- `subscriptionId=sus_y9d3b570dc`, `newPlanId=PRUEBA-BITACORA-ANUAL-UF`: HTTP 200.
- Respuesta: `balance.amount:16.065` (= 17.85 − 1.785, es decir, un crédito completo del mes ya pagado porque se pidió el mismo día), `next_invoice_date:"24-09-2027"`, y `old_plan`/`new_plan` con `currency`, `amount`, `interval` (3 → 4) e `interval_count`.
- El preview **no incluye los ítems adicionales** en el cálculo y **no aplica el cambio**: después, `newPlanId` sigue en `null`.
- Cambiar entre intervalos distintos está permitido. **CONFIRMADO.**
- No se probó el `changePlan` real porque no estaba pedido.

### 5. `POST customer/charge`
- `customerId=cus_yb18b7f6ee`, `amount=0.238`, `currency=UF`, `subject="PRUEBA-BITACORA-CHARGE adicionales"`, `commerceOrder=PRUEBA-BITACORA-CHARGE-1790293966`
- HTTP 200 **síncrono**: `flowOrder:10628395`, `status:2` (pagado), `currency:"UF"`, `amount:"0.238"`, `paymentData.amount:"9760.00" CLP` (tasa 41008,1), `fee:"282.00"`.
- **CONFIRMADO.** Un cargo puntual en UF con decimales funciona.

## Limpieza

| Recurso | Acción | Estado |
|---|---|---|
| Ítems en `sus_y9d3b570dc` | `subscription/deleteItem` 851 y 852 | OK |
| Suscripción `sus_y9d3b570dc` | `subscription/cancel at_period_end=0` | OK (`status:4`) |
| Ítem 851 | `subscription_item/delete changeType=all` | OK (`status:0`) |
| Ítem 852 | `subscription_item/delete changeType=all` | OK (`status:0`) |
| Plan `PRUEBA-BITACORA-MENSUAL-UF` | `plans/delete` | OK (`status:0`) |
| Plan `PRUEBA-BITACORA-ANUAL-UF` | `plans/delete` | OK (`status:0`) |
| Pagos sandbox (flowOrder 10628350 por 73.199 CLP y 10628395 por 9.760 CLP) | Sin revertir | Son cobros ficticios del sandbox a la tarjeta de prueba y no se reembolsaron. |

Los ítems con nombres inválidos no llegaron a crearse. Todos los recursos
llevan el prefijo "PRUEBA BITACORA": en los ítems va con espacios porque
Flow rechaza los guiones.

## Implicancias para el diseño (Opción A del informe)
1. Los planes base en UF (mensual y anual) pueden crearse con un script que use `plans/create`.
2. Hay dos formas de manejar los adicionales:
   - **Un ítem por empresa**, editado con `changeType=all`. Está documentado y probado.
   - **Un ítem por unidad** combinado con `quantity`. Funciona, pero no está documentado, y para cambiar N hay que hacer deleteItem + addItem.
3. Los nombres de los ítems tienen que ser ASCII (letras, números y espacios).
4. Los adicionales no se prorratean a mitad de ciclo. La diferencia puede cobrarse al momento con `customer/charge` en UF.
5. `changePlanPreview` no suma los ítems adicionales al calcular el saldo.
