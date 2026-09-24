import { test } from "node:test";
import assert from "node:assert/strict";
import { planPermiteAnalisisFotosIA } from "./limites";

test("análisis de fotos con IA: solo plan Pro", () => {
  assert.equal(planPermiteAnalisisFotosIA("pro"), true);
  assert.equal(planPermiteAnalisisFotosIA("basico"), false);
  assert.equal(planPermiteAnalisisFotosIA("trial"), false);
});

test("análisis de fotos con IA: sin plan conocido no se permite", () => {
  assert.equal(planPermiteAnalisisFotosIA(null), false);
  assert.equal(planPermiteAnalisisFotosIA(undefined), false);
});
