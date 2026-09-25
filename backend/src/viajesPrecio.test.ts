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
