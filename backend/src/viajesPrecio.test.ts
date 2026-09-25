import { test } from "node:test";
import assert from "node:assert/strict";
import { leerPedidoPrecio } from "./viajesPrecio";

test("leerPedidoPrecio: sin forma de cobro no toca nada", () => {
  assert.deepEqual(leerPedidoPrecio({}), { sinCambio: true });
});

test("leerPedidoPrecio: fijo, tramos y km válidos", () => {
  assert.deepEqual(leerPedidoPrecio({ modo_precio: "fijo" }), { pedido: { modo: "fijo" } });
  assert.deepEqual(leerPedidoPrecio({ modo_precio: "tramos", paradas: [" Santiago ", "", "Temuco"] }), { pedido: { modo: "tramos", paradas: ["Santiago", "Temuco"] } });
  assert.deepEqual(leerPedidoPrecio({ modo_precio: "km", distancia_km: "123.45" }), { pedido: { modo: "km", distanciaKm: 123.5 } });
});

test("leerPedidoPrecio: errores", () => {
  assert.ok("error" in leerPedidoPrecio({ modo_precio: "otro" }));
  assert.ok("error" in leerPedidoPrecio({ modo_precio: "tramos", paradas: ["Santiago"] }));
  assert.ok("error" in leerPedidoPrecio({ modo_precio: "km", distancia_km: -3 }));
  assert.ok("error" in leerPedidoPrecio({ modo_precio: "km" }));
});

import { mismaFormaDeCobro, paradasDelViaje } from "./viajesPrecio";

const porTramos = {
  modo_precio: "tramos" as const,
  origen: "Santiago",
  destino: "Temuco",
  distancia_km: null,
  tramos_detalle: [
    { origen: "Santiago", destino: "Concepción", precio: 300000 },
    { origen: "Concepción", destino: "Temuco", precio: 200000 },
  ],
};

test("paradasDelViaje: origen + destino de cada tramo; sin detalle, origen y destino", () => {
  assert.deepEqual(paradasDelViaje(porTramos), ["Santiago", "Concepción", "Temuco"]);
  assert.deepEqual(paradasDelViaje({ origen: "A", destino: "B", tramos_detalle: null }), ["A", "B"]);
});

test("mismaFormaDeCobro: igual no recalcula; otra parada, otros km u otra forma sí", () => {
  assert.equal(mismaFormaDeCobro(porTramos, { modo: "tramos", paradas: ["santiago", "Concepción", "Temuco"] }), true);
  assert.equal(mismaFormaDeCobro(porTramos, { modo: "tramos", paradas: ["Santiago", "Temuco"] }), false);
  assert.equal(mismaFormaDeCobro(porTramos, { modo: "fijo" }), false);
  const porKm = { ...porTramos, modo_precio: "km" as const, distancia_km: "87.0", tramos_detalle: null };
  assert.equal(mismaFormaDeCobro(porKm, { modo: "km", distanciaKm: 87 }), true);
  assert.equal(mismaFormaDeCobro(porKm, { modo: "km", distanciaKm: 90 }), false);
  assert.equal(mismaFormaDeCobro({ ...porKm, modo_precio: "fijo" as const }, { modo: "fijo" }), true);
});
