import { test } from "node:test";
import assert from "node:assert/strict";
import { esRegionMetropolitana, sugerirTipoViatico } from "./regionMetropolitana";

test("comunas de la RM, sin importar tildes ni mayúsculas", () => {
  for (const l of ["Santiago", "maipu", "ÑUÑOA", "Las Condes", "Puente Alto", "Maipú, RM", "Quilicura, Región Metropolitana", "Batuco"]) {
    assert.equal(esRegionMetropolitana(l), true, l);
  }
});

test("fuera de la RM o vacío", () => {
  for (const l of ["Rancagua", "Valparaíso", "San Pedro de la Paz", "San Pedro de Atacama", "Concepción", "", null, undefined]) {
    assert.equal(esRegionMetropolitana(l), false, String(l));
  }
});

test("sugerencia: local solo si origen y destino están en la RM", () => {
  assert.equal(sugerirTipoViatico("Santiago", "Puente Alto"), "local");
  assert.equal(sugerirTipoViatico("Santiago", "Rancagua"), "interregional");
  assert.equal(sugerirTipoViatico("Temuco", "Santiago"), "interregional");
});
