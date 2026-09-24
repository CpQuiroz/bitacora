import { test } from "node:test";
import assert from "node:assert/strict";
import { LIMITES_POR_PLAN, planPermiteAnalisisFotosIA } from "./limites";

test("análisis de fotos con IA: Pro, Empresa y la prueba", () => {
  assert.equal(planPermiteAnalisisFotosIA("pro"), true);
  assert.equal(planPermiteAnalisisFotosIA("empresa"), true);
  assert.equal(planPermiteAnalisisFotosIA("trial"), true);
  assert.equal(planPermiteAnalisisFotosIA("operacion"), false);
  assert.equal(planPermiteAnalisisFotosIA("basico"), false);
});

test("análisis de fotos con IA: sin plan conocido no se permite", () => {
  assert.equal(planPermiteAnalisisFotosIA(null), false);
  assert.equal(planPermiteAnalisisFotosIA(undefined), false);
});

test("usuarios por plan: 3 / 5 / 15 / 30 / 100", () => {
  assert.deepEqual(
    (["trial", "basico", "operacion", "pro", "empresa"] as const).map((p) => LIMITES_POR_PLAN[p].usuarios),
    [3, 5, 15, 30, 100]
  );
});

test("solo Operación tiene tope propio de informes con IA", () => {
  assert.equal(LIMITES_POR_PLAN.operacion.informesIAPorMes, 20);
  assert.equal(LIMITES_POR_PLAN.pro.informesIAPorMes, null);
});
