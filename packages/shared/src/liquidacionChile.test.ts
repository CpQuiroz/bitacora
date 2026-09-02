import { test } from "node:test";
import assert from "node:assert/strict";
import {
  calcularImpuestoUnico,
  calcularLiquidacion,
  TRAMOS_IMPUESTO_UNICO_BASE,
  type EntradaLiquidacion,
  type ParametrosPrevisionales,
} from "./liquidacionChile";

// Parámetros de prueba — valores plausibles, NO autoritativos. El
// cálculo es lo que se testea, no estos números.
const P: ParametrosPrevisionales = {
  periodo: "2026-09",
  uf: 39500,
  utm: 69000,
  ingresoMinimo: 529000,
  topeImponibleUf: 87.8,
  topeAfcUf: 131.9,
  topeGratificacionMensual: Math.round((4.75 * 529000) / 12),
  tasaSis: 0.0188,
  tasaMutualBase: 0.009,
  tramosImpuesto: TRAMOS_IMPUESTO_UNICO_BASE,
  comisionAfp: 0.0058, // AFP Modelo aprox.
};

const BASE: EntradaLiquidacion = {
  diasTrabajados: 30,
  tipoContrato: "indefinido",
  cotizaAfp: true,
  sistemaSalud: "fonasa",
  gratificacionLegal: false,
  sueldoBaseMensual: 529000,
  colacionMensual: 0,
  movilizacionMensual: 0,
  horasExtra: 0,
  otrosImponibles: 0,
  otrosNoImponibles: 0,
  asignacionFamiliarMonto: 0,
  otrosDescuentos: 0,
};

test("sueldo mínimo, Fonasa, indefinido, sin gratificación", () => {
  const r = calcularLiquidacion(BASE, P);
  assert.equal(r.baseImponible, 529000);
  assert.equal(r.cotizacionAfp, 52900); // 10%
  assert.equal(r.comisionAfp, Math.round(529000 * 0.0058));
  assert.equal(r.cotizacionSalud, Math.round(529000 * 0.07));
  assert.equal(r.saludAdicional, 0);
  assert.equal(r.cotizacionAfc, Math.round(529000 * 0.006));
  assert.equal(r.impuestoUnico, 0); // muy por debajo de 13,5 UTM
  assert.equal(r.liquidoPagar, r.totalHaberes - r.totalDescuentos);
  assert.equal(r.totalHaberes, 529000); // sin haberes no imponibles
});

test("gratificación Art. 50 se topea en 4,75 IMM / 12", () => {
  const alto = calcularLiquidacion({ ...BASE, sueldoBaseMensual: 3000000, gratificacionLegal: true }, P);
  assert.equal(alto.gratificacion, P.topeGratificacionMensual); // 25% de 3M supera el tope
  const bajo = calcularLiquidacion({ ...BASE, sueldoBaseMensual: 600000, gratificacionLegal: true }, P);
  assert.equal(bajo.gratificacion, Math.round(600000 * 0.25)); // 150000 < tope
});

test("contrato a plazo fijo: AFC trabajador 0, aporte empleador 3%", () => {
  const indef = calcularLiquidacion({ ...BASE, sueldoBaseMensual: 1200000 }, P);
  const plazo = calcularLiquidacion({ ...BASE, sueldoBaseMensual: 1200000, tipoContrato: "plazo_fijo" }, P);
  assert.ok(indef.cotizacionAfc > 0);
  assert.equal(plazo.cotizacionAfc, 0);
  assert.equal(indef.aporteAfcEmpleador, Math.round(1200000 * 0.024));
  assert.equal(plazo.aporteAfcEmpleador, Math.round(1200000 * 0.03));
});

test("Isapre: adicional por sobre el 7% legal; el 7% sigue rebajando impuesto", () => {
  const sueldo = 1500000;
  const fonasa = calcularLiquidacion({ ...BASE, sueldoBaseMensual: sueldo }, P);
  const isapre = calcularLiquidacion(
    { ...BASE, sueldoBaseMensual: sueldo, sistemaSalud: "isapre", planIsapreUf: 5 },
    P
  );
  const salud7 = Math.round(1500000 * 0.07);
  assert.equal(isapre.cotizacionSalud, salud7);
  assert.equal(isapre.saludAdicional, Math.max(0, Math.round(5 * P.uf) - salud7));
  // La base tributable no cambia entre Fonasa e Isapre (solo cuenta el 7%).
  assert.equal(isapre.baseTributable, fonasa.baseTributable);
  // Pero el líquido de Isapre es menor por el adicional.
  assert.ok(isapre.liquidoPagar < fonasa.liquidoPagar);
  assert.equal(isapre.liquidoPagar, fonasa.liquidoPagar - isapre.saludAdicional);
});

test("renta sobre el tope imponible: la base se topea", () => {
  const r = calcularLiquidacion({ ...BASE, sueldoBaseMensual: 5000000 }, P);
  assert.equal(r.baseImponible, Math.round(87.8 * P.uf));
  assert.equal(r.cotizacionAfp, Math.round(87.8 * P.uf * 0.1));
});

test("días parciales prorratean los haberes fijos", () => {
  const r = calcularLiquidacion({ ...BASE, sueldoBaseMensual: 900000, colacionMensual: 60000, diasTrabajados: 15 }, P);
  assert.equal(r.sueldoBase, 450000);
  assert.equal(r.colacion, 30000);
});

test("colación y movilización: no imponibles, no tributables, suman al líquido", () => {
  const sin = calcularLiquidacion({ ...BASE, sueldoBaseMensual: 800000 }, P);
  const con = calcularLiquidacion({ ...BASE, sueldoBaseMensual: 800000, colacionMensual: 50000, movilizacionMensual: 40000 }, P);
  assert.equal(con.baseImponible, sin.baseImponible); // no cambian la base
  assert.equal(con.impuestoUnico, sin.impuestoUnico);
  assert.equal(con.liquidoPagar, sin.liquidoPagar + 90000);
});

test("calcularImpuestoUnico: tramo exento y tramo con factor", () => {
  assert.equal(calcularImpuestoUnico(0, P.utm, P.tramosImpuesto), 0);
  assert.equal(calcularImpuestoUnico(10 * P.utm, P.utm, P.tramosImpuesto), 0); // < 13,5 UTM
  // 20 UTM cae en el tramo 13,5–30 (factor 0,04, rebaja 0,54):
  const esperado = Math.max(0, Math.round((20 * 0.04 - 0.54) * P.utm));
  assert.equal(calcularImpuestoUnico(20 * P.utm, P.utm, P.tramosImpuesto), esperado);
});

test("identidad contable: líquido = haberes − descuentos, siempre", () => {
  for (const sueldo of [400000, 750000, 1300000, 2800000, 6000000]) {
    for (const salud of ["fonasa", "isapre"] as const) {
      const r = calcularLiquidacion(
        { ...BASE, sueldoBaseMensual: sueldo, gratificacionLegal: true, sistemaSalud: salud, planIsapreUf: salud === "isapre" ? 4 : null },
        P
      );
      assert.equal(r.liquidoPagar, r.totalHaberes - r.totalDescuentos);
      assert.equal(
        r.totalDescuentos,
        r.cotizacionAfp + r.comisionAfp + r.cotizacionSalud + r.saludAdicional + r.cotizacionAfc + r.impuestoUnico + r.otrosDescuentos
      );
    }
  }
});
