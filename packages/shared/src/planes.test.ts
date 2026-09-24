import { test } from "node:test";
import assert from "node:assert/strict";
import { MODULOS } from "./permisos";
import { DIAS_PRUEBA, MODULOS_CONTABLES, PLANES_CONTRATABLES, cuentaParaTope, esPlanPago, filtrarModulosVisibles, modulosContablesActivos, modulosSobrantesParaPlan } from "./planes";

test("las 17 secciones del menú cuentan para el tope", () => {
  assert.equal(MODULOS_CONTABLES.length, 17);
  for (const m of ["registros", "equipos", "inventario", "catalogo", "proveedores", "financiero", "flota"] as const) {
    assert.ok(cuentaParaTope(m), m);
  }
});

test("base e IA no cuentan para el tope", () => {
  for (const m of ["configuracion", "gestion_control", "informe_ia", "asistente"] as const) assert.equal(cuentaParaTope(m), false, m);
  assert.equal(MODULOS_CONTABLES.length + 4, MODULOS.length);
});

test("el plan Empresa está programado pero no se ofrece", () => {
  assert.deepEqual([...PLANES_CONTRATABLES], ["basico", "operacion", "pro"]);
  assert.ok(esPlanPago("empresa"));
});

test("la prueba dura 7 días", () => {
  assert.equal(DIAS_PRUEBA, 7);
});

test("módulos activos: sin filas rige el default (los opcionales parten apagados)", () => {
  const activos = modulosContablesActivos([]);
  assert.ok(activos.includes("registros"));
  assert.ok(activos.includes("equipos"));
  assert.ok(!activos.includes("levantamientos"));
  assert.ok(!activos.includes("agenda_pro"));
  assert.ok(!activos.includes("remuneraciones"));
});

test("módulos activos: una fila explícita manda sobre el default", () => {
  const activos = modulosContablesActivos([
    { modulo: "registros", activado: false },
    { modulo: "levantamientos", activado: true },
    { modulo: "informe_ia", activado: true },
  ]);
  assert.ok(!activos.includes("registros"));
  assert.ok(activos.includes("levantamientos"));
  assert.ok(!activos.includes("informe_ia" as never), "la IA no cuenta para el tope");
});

test("módulos activos: una empresa con todo activo cuenta las 17 secciones", () => {
  const filas = MODULOS.map((modulo) => ({ modulo, activado: true }));
  assert.equal(modulosContablesActivos(filas).length, 17);
});

test("módulos sobrantes al cambiar de plan", () => {
  assert.equal(modulosSobrantesParaPlan("basico", 17), 11);
  assert.equal(modulosSobrantesParaPlan("operacion", 10), 0);
  assert.equal(modulosSobrantesParaPlan("operacion", 12), 2);
  assert.equal(modulosSobrantesParaPlan("pro", 17), 0);
});

test("visibles: el admin conserva Informe con IA y Asistente en planes con IA completa", () => {
  const v = filtrarModulosVisibles(["agenda", "informe_ia", "asistente"], "admin", "pro");
  assert.deepEqual(v, ["agenda", "informe_ia", "asistente"]);
});

test("visibles: supervisor y colaborador nunca ven Informe con IA ni Asistente", () => {
  for (const rol of ["supervisor", "colaborador", "contador"]) {
    assert.deepEqual(filtrarModulosVisibles(["agenda", "informe_ia", "asistente"], rol, "pro"), ["agenda"]);
  }
});

test("visibles: en Esencial y Operación el admin ve el Informe con IA pero no el Asistente", () => {
  for (const plan of ["basico", "operacion"] as const) {
    assert.deepEqual(filtrarModulosVisibles(["informe_ia", "asistente", "registros"], "admin", plan), ["informe_ia", "registros"]);
  }
});
