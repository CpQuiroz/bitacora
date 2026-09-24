import { test } from "node:test";
import assert from "node:assert/strict";
import { MODULOS_ESENCIAL, MODULOS_GESTIONADOS_POR_PLAN, modulosDelPlan, packSugeridoDeRubro } from "./planes";

test("Esencial: solo el núcleo, sin packs ni IA", () => {
  const m = modulosDelPlan("basico", "transporte");
  assert.deepEqual(m, [...MODULOS_ESENCIAL]);
  assert.ok(!m.includes("flota"));
  assert.ok(!m.includes("informe_ia"));
});

test("Operación: núcleo + el pack elegido + Informe con IA, sin Asistente", () => {
  const m = modulosDelPlan("operacion", "mantencion");
  assert.ok(m.includes("levantamientos"));
  assert.ok(m.includes("informe_ia"));
  assert.ok(!m.includes("flota"));
  assert.ok(!m.includes("asistente"));
});

test("Operación sin pack cae en Transporte", () => {
  assert.ok(modulosDelPlan("operacion", null).includes("viajes"));
});

test("Pro, Empresa y la prueba traen todo lo gestionado por plan", () => {
  for (const plan of ["pro", "empresa", "trial"] as const) {
    assert.deepEqual(modulosDelPlan(plan, null), [...MODULOS_GESTIONADOS_POR_PLAN]);
  }
});

test("remuneraciones nunca depende del plan", () => {
  assert.ok(!MODULOS_GESTIONADOS_POR_PLAN.includes("remuneraciones"));
});

test("pack sugerido según rubro", () => {
  assert.equal(packSugeridoDeRubro("servicio_tecnico"), "mantencion");
  assert.equal(packSugeridoDeRubro("cosmetologia"), "agenda");
  assert.equal(packSugeridoDeRubro("transporte"), "transporte");
  assert.equal(packSugeridoDeRubro("otro"), "transporte");
});
