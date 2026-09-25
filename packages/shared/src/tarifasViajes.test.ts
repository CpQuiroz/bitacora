import { test } from "node:test";
import assert from "node:assert/strict";
import { armarTramos, calcularPorKm, calcularPorTramos, elegirTarifaTramo, parTramo } from "./tarifasViajes";

test("parTramo: mismo par en ambos sentidos, sin tildes ni mayúsculas", () => {
  assert.deepEqual(parTramo("Temuco", "Santiago"), parTramo("santiago", "TEMUCO"));
  assert.deepEqual(parTramo("Concepción", "Santiago"), { par_a: "concepcion", par_b: "santiago" });
});

test("armarTramos: paradas consecutivas, ignora vacías y repetidas seguidas", () => {
  assert.deepEqual(armarTramos(["Santiago", "", "Concepción", "concepcion", "Temuco"]), [
    { origen: "Santiago", destino: "Concepción" },
    { origen: "Concepción", destino: "Temuco" },
  ]);
  assert.deepEqual(armarTramos(["Santiago"]), []);
});

const tarifas = [
  { ...parTramo("Santiago", "Concepción"), cliente_id: null, precio: 300000, activo: true },
  { ...parTramo("Santiago", "Concepción"), cliente_id: "c1", precio: 280000, activo: true },
  { ...parTramo("Concepción", "Temuco"), cliente_id: null, precio: 200000, activo: true },
  { ...parTramo("Santiago", "Rancagua"), cliente_id: null, precio: 90000, activo: false },
];

test("elegirTarifaTramo: la del cliente gana; inactivas no cuentan; ambos sentidos", () => {
  assert.equal(elegirTarifaTramo(tarifas, "Concepción", "Santiago", "c1"), 280000);
  assert.equal(elegirTarifaTramo(tarifas, "Santiago", "Concepción", "c2"), 300000);
  assert.equal(elegirTarifaTramo(tarifas, "Santiago", "Rancagua", null), null);
});

test("calcularPorTramos: suma los tramos y lista los que no tienen tarifa", () => {
  const r = calcularPorTramos(["Santiago", "Concepción", "Temuco", "Puerto Montt"], tarifas, "c1");
  assert.equal(r.subtotal, 480000);
  assert.deepEqual(r.faltantes, [{ origen: "Temuco", destino: "Puerto Montt" }]);
  assert.equal(r.tramos.length, 3);
});

test("calcularPorKm: redondea a peso y rechaza negativos", () => {
  assert.equal(calcularPorKm(123.4, 950), 117230);
  assert.equal(calcularPorKm(-1, 950), 0);
});
