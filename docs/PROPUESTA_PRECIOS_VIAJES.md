# Propuesta — Viáticos por viaje y precio por tramos / por kilómetro

> Tarea 135 (Parte B del pedido del 24-sep-2026) + pedido de viáticos del mismo día.
> **Solo propuesta: sin código ni migraciones hasta la aprobación de la usuaria.**

---

## 1. Viáticos por viaje (pedido de la usuaria)

"Los viajes locales incluyen viático local y los que salen de Santiago, viático
interregional; cada uno con un monto. Ítem interno para el Admin que después aparezca
en Gastos como Viáticos, sumable por semana o mes."

**Qué ya existe y se reutiliza**
- `gastos.viaje_id` (migración 120): un gasto ya puede apuntar a su viaje.
- `categorias_gasto` por empresa: se agrega (sola, si no existe) la categoría "Viáticos".
- Resumen semanal/mensual de Viajes (`GET /api/viajes/resumen`): mismo patrón para Gastos.

**Propuesta**
- **Configuración › Viajes:** monto por defecto de *Viático local* y de *Viático
  interregional* (por empresa).
- **En el viaje, solo Admin/Supervisor:** campo interno "Viático" con tres opciones:
  ninguno, local o interregional. El monto se precarga con el valor por defecto y se
  puede editar. Sugerencia automática: si origen y destino están en la Región
  Metropolitana → local; si no → interregional. El Admin puede cambiarlo.
- **Gasto automático:** al guardar el viaje con viático se crea (o actualiza) un gasto
  categoría "Viáticos", con el chofer, la fecha del viaje, el monto y el vínculo
  `viaje_id`. Si se quita el viático o se borra el viaje, se quita el gasto.
- **No sale en el cobro ni en el PDF del cliente** (es un costo interno).
- **Gastos › Viáticos:** filtro por categoría y resumen por semana o por mes, y por
  chofer.

**Modelo:** `viajes.viatico_tipo` (`local|interregional`, null) + `viajes.viatico_monto`;
`empresas.viatico_local_default`, `empresas.viatico_interregional_default`. Una migración
aditiva.

**Preguntas para la usuaria**
1. ¿El viático es siempre del chofer asignado (se le paga a él)?
2. ¿Debe entrar en las Rendiciones del chofer o solo como gasto de la empresa?
3. ¿La regla "fuera de la Región Metropolitana = interregional" sirve, o cuenta solo
   la comuna de Santiago?

**Esfuerzo:** 1 a 1,5 días (backend, web y mobile para ver el viático). Riesgo bajo.

---

## 2. Precio por tramos (B1) y por kilómetro (B2)

### 2.1 Dónde vive (UI y datos)
- **Rutas** (hoy Viajes › Rutas, tarea 130) pasa a ser también la **plantilla de
  recorrido**: una ruta con paradas ordenadas (Santiago → Concepción → Temuco).
- **Tabla nueva `tarifas_tramo`** (empresa, origen, destino, precio, cliente opcional):
  el Admin define el precio de cada tramo en **Viajes › Tarifas**. Un tramo con cliente
  gana sobre el general.
- **Tabla nueva `tarifas_km`** (empresa, precio por km, cliente opcional, tipo de
  camión opcional → `equipos.tipo` o categoría): regla más específica gana
  (cliente + camión > cliente > camión > global).
- **El viaje** se asocia a una ruta con `ruta_viajes` (ya existe, migración 134), guarda
  `modo_precio` (`fijo|tramos|km`), `distancia_km`, `tramos_detalle` (jsonb con cada
  tramo, su precio y su km) y el `subtotal` resultante.

### 2.2 Cómo conviven los 3 modos
- **Selector por viaje:** "Monto fijo" (como hoy), "Por tramos" o "Por km".
- **Modo por defecto por cliente** (Clientes › ficha › "Cómo se cobra"): al elegir el
  cliente en un viaje nuevo, se preselecciona su modo; el Admin puede cambiarlo.
- El cálculo solo **propone** el `subtotal`; el Admin puede ajustarlo (queda en el
  historial de monto de la tarea 132). IVA igual que hoy.

### 2.3 Proveedor de distancia (por carretera)

| Opción | Costo | Límites | API key | Comentario |
|---|---|---|---|---|
| **OSRM propio** (Docker, datos de Chile de OpenStreetMap) | Servidor aparte (Render 2–4 GB, ~US$25–85/mes) | Sin límite propio | No | Compatible con el mapa OSM actual; hay que mantenerlo (actualizar el mapa cada tanto). El servidor demo público de OSRM **no** es para producción. |
| **OpenRouteService** (API) | Gratis | ~2.500 pedidos/día, 40.000/mes ([apispine](https://apispine.com/openrouteserviceorg/pricing), [ORS restricciones](https://openrouteservice.org/restrictions/)) | Sí (gratis) | Mismos datos OSM; alcanza de sobra para calcular al crear o editar viajes. |
| **Google Routes (Route Matrix)** | ~US$5 por 1.000 elementos (Basic); 10.000 gratis al mes en Essentials ([Google](https://developers.google.com/maps/documentation/routes/usage-and-billing), [woosmap](https://www.woosmap.com/blog/google-maps-api-pricing-breakdown)) | Por elemento (origen × destino) | Sí, con facturación | Datos más precisos en ciudad; otro proveedor distinto a OSM y costo variable. |

**Recomendación:** empezar con **OpenRouteService** (gratis, mismos datos OSM, una
llamada por tramo al guardar el viaje) detrás de una interfaz propia
(`calcularDistanciaKm(origen, destino)`) para poder cambiar a OSRM propio si el volumen
crece, sin tocar el resto.

### 2.4 ¿Distancia fija o recalculada?
**Fija en el viaje** (`distancia_km` y `tramos_detalle` se guardan al calcular). El
cobro y su PDF no cambian aunque el proveedor mejore el mapa o cambien las tarifas
después. Recalcular solo cuando el Admin lo pide (botón "Recalcular"), y queda en el
historial de monto.

### 2.5 Impacto en Cobros y en el PDF (tarea 134)
- El detalle por viaje suma columnas opcionales: **Km** y **Tarifa** (por km o tramo).
- Un viaje por tramos puede mostrarse en el PDF como una fila con sus tramos debajo
  (Santiago → Concepción $X; Concepción → Temuco $Y).
- Neto, IVA y total no cambian de lógica: siguen saliendo del `subtotal` del viaje.

### 2.6 Esfuerzo y riesgos
| Parte | Esfuerzo |
|---|---|
| Tarifas por tramo (tabla, pantalla, cálculo, viaje con ruta) | 2–3 días |
| Tarifas por km + proveedor de distancia | 2–3 días |
| Modo por cliente, cobro y PDF con km/tramos | 1–2 días |
| **Total** | **5–8 días** |

**Riesgos:** ciudades escritas a mano que el proveedor no encuentra (mitigar con la
lista `CIUDADES_CHILE` + coordenadas); límites del plan gratuito si crece mucho el uso
(mitigar con caché de distancias origen→destino y OSRM propio); el Admin debe poder
corregir siempre el monto propuesto.
