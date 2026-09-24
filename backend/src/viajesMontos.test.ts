import { test } from "node:test";
import assert from "node:assert/strict";
import { calcularMontos, normalizarHora, nuevosMontosViaje } from "./viajesMontos";

const existente = { subtotal: 150000, aplica_iva: true, iva: 28500, total: 178500 };

test("calcularMontos: IVA 19% redondeado", () => {
  assert.deepEqual(calcularMontos(100000, true), { subtotal: 100000, iva: 19000, total: 119000 });
  assert.deepEqual(calcularMontos(100000, false), { subtotal: 100000, iva: 0, total: 100000 });
});

test("nuevosMontosViaje: sin subtotal ni IVA no hay cambio", () => {
  assert.deepEqual(nuevosMontosViaje(existente, undefined, undefined), { cambio: null });
});

test("nuevosMontosViaje: la app 1.10.17 manda el mismo monto como texto → sin cambio", () => {
  assert.deepEqual(nuevosMontosViaje(existente, "150000", true), { cambio: null });
});

test("nuevosMontosViaje: cambia el monto → anterior y nuevo con IVA recalculado", () => {
  const r = nuevosMontosViaje(existente, 200000, undefined);
  assert.ok("cambio" in r && r.cambio);
  assert.deepEqual(r.cambio.anterior, { subtotal: 150000, aplica_iva: true, iva: 28500, total: 178500 });
  assert.deepEqual(r.cambio.nuevo, { subtotal: 200000, aplica_iva: true, iva: 38000, total: 238000 });
});

test("nuevosMontosViaje: solo cambia el IVA (incluido el texto \"false\") → hay cambio", () => {
  for (const sinIva of [false, "false"]) {
    const r = nuevosMontosViaje(existente, undefined, sinIva);
    assert.ok("cambio" in r && r.cambio);
    assert.deepEqual(r.cambio.nuevo, { subtotal: 150000, aplica_iva: false, iva: 0, total: 150000 });
  }
});

test("nuevosMontosViaje: monto negativo o no numérico → error", () => {
  assert.ok("error" in nuevosMontosViaje(existente, -1, undefined));
  assert.ok("error" in nuevosMontosViaje(existente, "abc", undefined));
});

test("normalizarHora: vacío → null; HH:MM → HH:MM:SS; inválida → error", () => {
  assert.deepEqual(normalizarHora(undefined), { hora: null });
  assert.deepEqual(normalizarHora(""), { hora: null });
  assert.deepEqual(normalizarHora("08:30"), { hora: "08:30:00" });
  assert.deepEqual(normalizarHora("23:59:59"), { hora: "23:59:59" });
  for (const mala of ["25:00", "8:30", "12:60", 830, "hola"]) assert.ok("error" in normalizarHora(mala), String(mala));
});
