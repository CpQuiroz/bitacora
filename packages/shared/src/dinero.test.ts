import { test } from "node:test";
import assert from "node:assert/strict";
import { formatearCLP } from "./dinero";

test("agrupa de a miles con punto", () => {
  assert.equal(formatearCLP(1250000), "$1.250.000");
});

test("sin decimales, redondea", () => {
  assert.equal(formatearCLP(999.6), "$1.000");
});

test("cero y NaN no rompen", () => {
  assert.equal(formatearCLP(0), "$0");
  assert.equal(formatearCLP(Number.NaN), "$0");
});

test("negativo — mismo comportamiento que el pesos() de mobile de antes (signo pegado al monto, no al símbolo)", () => {
  assert.equal(formatearCLP(-500), "$-500");
});

test("coincide con Intl.NumberFormat para CLP (mismo resultado visible que antes)", () => {
  const intl = new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 }).format(1250000);
  assert.equal(formatearCLP(1250000), intl);
});
