import { test } from "node:test";
import assert from "node:assert/strict";
import { LIMITES_POR_PLAN, planPermiteAnalisisFotosIA, planPermiteIACompleta } from "./limites";

test("IA completa (asistente y fotos): prueba, Pro y Empresa", () => {
  for (const plan of ["trial", "pro", "empresa"] as const) assert.equal(planPermiteIACompleta(plan), true);
  for (const plan of ["basico", "operacion"] as const) assert.equal(planPermiteIACompleta(plan), false);
  assert.equal(planPermiteAnalisisFotosIA("pro"), true);
});

test("IA completa: sin plan conocido no se permite", () => {
  assert.equal(planPermiteIACompleta(null), false);
  assert.equal(planPermiteIACompleta(undefined), false);
});

test("usuarios por plan: 3 / 5 / 15 / 30 / 100", () => {
  assert.deepEqual(
    (["trial", "basico", "operacion", "pro", "empresa"] as const).map((p) => LIMITES_POR_PLAN[p].usuarios),
    [3, 5, 15, 30, 100]
  );
});

test("tope de módulos: Esencial 6, Operación 10, el resto sin tope", () => {
  assert.equal(LIMITES_POR_PLAN.basico.modulosMax, 6);
  assert.equal(LIMITES_POR_PLAN.operacion.modulosMax, 10);
  for (const plan of ["trial", "pro", "empresa"] as const) assert.equal(LIMITES_POR_PLAN[plan].modulosMax, null);
});

test("informes con IA: 10 en la prueba, 5 y 20 al mes, Pro y Empresa sin tope", () => {
  assert.deepEqual(LIMITES_POR_PLAN.trial.informesIA, { tope: 10, periodo: "prueba" });
  assert.deepEqual(LIMITES_POR_PLAN.basico.informesIA, { tope: 5, periodo: "mes" });
  assert.deepEqual(LIMITES_POR_PLAN.operacion.informesIA, { tope: 20, periodo: "mes" });
  assert.equal(LIMITES_POR_PLAN.pro.informesIA, null);
  assert.equal(LIMITES_POR_PLAN.empresa.informesIA, null);
});
