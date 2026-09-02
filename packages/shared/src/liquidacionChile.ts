// ============================================================
// BITÁCORA — Cálculo de liquidación de sueldo (legislación chilena).
//
// Función PURA: mismos insumos => mismo resultado. Todos los insumos
// que cambian con el tiempo (UF, UTM, ingreso mínimo, topes, comisión
// AFP, tabla de impuesto) llegan por `ParametrosPrevisionales` — nada
// hardcodeado. Cada liquidación guarda un snapshot de estos parámetros.
//
// Alcance v1 — caso mensual típico:
//  - Gratificación Art. 50 (25% con tope 4,75 IMM anual / 12), configurable.
//  - Salud: Fonasa (7%) o Isapre (plan en UF o pesos, con adicional).
//  - AFC: 0,6% trabajador solo en contrato indefinido.
//  - Impuesto Único de 2ª Categoría (tabla progresiva en UTM).
//  - Asignación familiar: monto ya resuelto afuera (0 si no aplica).
// NO cubre: finiquitos, licencias médicas/subsidios, semana corrida,
// retroactivos. Eso queda para el contador / otra iteración.
// ============================================================

export type TipoContrato = "indefinido" | "plazo_fijo" | "por_obra";
export type SistemaSalud = "fonasa" | "isapre";

// Tramo de la tabla del Impuesto Único de 2ª Categoría (montos en UTM).
export type TramoImpuesto = {
  desde: number; // exclusivo, en UTM
  hasta: number | null; // inclusivo; null = último tramo
  factor: number; // 0 .. 0.40
  rebaja: number; // en UTM
};

export type ParametrosPrevisionales = {
  periodo: string; // 'YYYY-MM'
  uf: number;
  utm: number;
  ingresoMinimo: number;
  topeImponibleUf: number; // AFP + salud
  topeAfcUf: number; // seguro de cesantía
  topeGratificacionMensual: number; // pesos (4,75 * IMM / 12)
  tasaSis: number; // aporte empleador (SIS)
  tasaMutualBase: number; // cotización básica mutual (empleador)
  tramosImpuesto: TramoImpuesto[];
  comisionAfp: number; // comisión del AFP del trabajador (ej. 0.0058)
};

export type EntradaLiquidacion = {
  diasTrabajados: number; // 1..30
  tipoContrato: TipoContrato;
  cotizaAfp: boolean;
  sistemaSalud: SistemaSalud;
  planIsapreUf?: number | null;
  planIsaprePesos?: number | null;
  gratificacionLegal: boolean;

  // Haberes fijos MENSUALES (base 30 días — se prorratean por días trabajados)
  sueldoBaseMensual: number;
  colacionMensual: number;
  movilizacionMensual: number;

  // Haberes VARIABLES del mes (monto real del mes — NO se prorratean)
  horasExtra: number;
  otrosImponibles: number; // bonos, comisiones
  otrosNoImponibles: number; // asignaciones no imponibles varias
  asignacionFamiliarMonto: number; // ya = cargas * monto_tramo (0 si no aplica)

  otrosDescuentos: number; // APV, cuota sindical, préstamos, anticipos
  tasaMutualEmpresa?: number | null; // override de la mutual (adicional por actividad)
};

export type ResultadoLiquidacion = {
  diasTrabajados: number;
  // Haberes
  sueldoBase: number;
  gratificacion: number;
  horasExtra: number;
  otrosImponibles: number;
  colacion: number;
  movilizacion: number;
  otrosNoImponibles: number;
  asignacionFamiliar: number;
  totalHaberes: number;
  // Bases
  totalImponible: number; // antes de topes
  baseImponible: number; // con tope AFP/salud
  baseAfc: number; // con tope AFC
  baseTributable: number;
  // Descuentos
  cotizacionAfp: number;
  comisionAfp: number;
  cotizacionSalud: number; // 7% legal
  saludAdicional: number; // plan isapre por sobre el 7%
  cotizacionAfc: number;
  impuestoUnico: number;
  otrosDescuentos: number;
  totalDescuentos: number;
  // Resultado
  liquidoPagar: number;
  // Costo empresa (informativo)
  aporteAfcEmpleador: number;
  aporteSis: number;
  aporteMutual: number;
};

const r = Math.round;
const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));

export function calcularImpuestoUnico(baseTributablePesos: number, utm: number, tramos: TramoImpuesto[]): number {
  if (baseTributablePesos <= 0 || utm <= 0) return 0;
  const enUtm = baseTributablePesos / utm;
  const tramo = tramos.find((t) => enUtm > t.desde && (t.hasta === null || enUtm <= t.hasta));
  if (!tramo || tramo.factor === 0) return 0;
  return Math.max(0, r((enUtm * tramo.factor - tramo.rebaja) * utm));
}

export function calcularLiquidacion(e: EntradaLiquidacion, p: ParametrosPrevisionales): ResultadoLiquidacion {
  const prop = clamp(e.diasTrabajados, 0, 30) / 30;

  // 1. Haberes fijos prorrateados por días trabajados
  const sueldoBase = r(e.sueldoBaseMensual * prop);
  const colacion = r(e.colacionMensual * prop);
  const movilizacion = r(e.movilizacionMensual * prop);
  const horasExtra = r(e.horasExtra);
  const otrosImponibles = r(e.otrosImponibles);
  const otrosNoImponibles = r(e.otrosNoImponibles);
  const asignacionFamiliar = r(e.asignacionFamiliarMonto);

  // 2. Imponible antes de gratificación
  const imponibleSinGrat = sueldoBase + horasExtra + otrosImponibles;

  // 3. Gratificación Art. 50: 25% del imponible, tope 4,75 IMM/12 (prorrateado)
  const gratificacion = e.gratificacionLegal
    ? Math.min(r(imponibleSinGrat * 0.25), r(p.topeGratificacionMensual * prop))
    : 0;

  const totalImponible = imponibleSinGrat + gratificacion;

  // 4. Topes imponibles
  const topeImp = r(p.topeImponibleUf * p.uf);
  const topeAfc = r(p.topeAfcUf * p.uf);
  const baseImponible = Math.min(totalImponible, topeImp);
  const baseAfc = Math.min(totalImponible, topeAfc);

  // 5. AFP (10% obligatorio + comisión de la administradora)
  const cotizacionAfp = e.cotizaAfp ? r(baseImponible * 0.1) : 0;
  const comisionAfp = e.cotizaAfp ? r(baseImponible * p.comisionAfp) : 0;

  // 6. Salud
  const salud7 = r(baseImponible * 0.07);
  let cotizacionSalud = salud7;
  let saludAdicional = 0;
  if (e.sistemaSalud === "isapre") {
    const plan = e.planIsapreUf != null ? r(e.planIsapreUf * p.uf) : r(e.planIsaprePesos ?? 0);
    saludAdicional = Math.max(0, plan - salud7);
    cotizacionSalud = salud7;
  }

  // 7. AFC trabajador: 0,6% solo en contrato indefinido
  const cotizacionAfc = e.tipoContrato === "indefinido" ? r(baseAfc * 0.006) : 0;

  // 8. Base tributable = base imponible − cotizaciones previsionales
  //    obligatorias (AFP 10% + comisión + salud 7% legal + AFC trabajador).
  //    El adicional de isapre NO rebaja impuesto.
  const baseTributable = Math.max(0, baseImponible - cotizacionAfp - comisionAfp - salud7 - cotizacionAfc);

  // 9. Impuesto Único de 2ª Categoría
  const impuestoUnico = calcularImpuestoUnico(baseTributable, p.utm, p.tramosImpuesto);

  // 10. Totales
  const totalHaberes = totalImponible + colacion + movilizacion + otrosNoImponibles + asignacionFamiliar;
  const otrosDescuentos = r(e.otrosDescuentos);
  const totalDescuentos =
    cotizacionAfp + comisionAfp + cotizacionSalud + saludAdicional + cotizacionAfc + impuestoUnico + otrosDescuentos;
  const liquidoPagar = totalHaberes - totalDescuentos;

  // 11. Costo empresa (informativo — no sale de la liquidación)
  const tasaAfcEmpleador = e.tipoContrato === "indefinido" ? 0.024 : 0.03;
  const aporteAfcEmpleador = r(baseAfc * tasaAfcEmpleador);
  const aporteSis = r(baseImponible * p.tasaSis);
  const aporteMutual = r(baseImponible * (e.tasaMutualEmpresa ?? p.tasaMutualBase));

  return {
    diasTrabajados: clamp(e.diasTrabajados, 0, 30),
    sueldoBase,
    gratificacion,
    horasExtra,
    otrosImponibles,
    colacion,
    movilizacion,
    otrosNoImponibles,
    asignacionFamiliar,
    totalHaberes,
    totalImponible,
    baseImponible,
    baseAfc,
    baseTributable,
    cotizacionAfp,
    comisionAfp,
    cotizacionSalud,
    saludAdicional,
    cotizacionAfc,
    impuestoUnico,
    otrosDescuentos,
    totalDescuentos,
    liquidoPagar,
    aporteAfcEmpleador,
    aporteSis,
    aporteMutual,
  };
}

// Tabla del Impuesto Único de 2ª Categoría — los FACTORES y las REBAJAS
// (en UTM) están fijados por ley; solo el valor de la UTM cambia mes a
// mes. Esto es la base para sembrar `parametros_previsionales.tramos_impuesto`.
export const TRAMOS_IMPUESTO_UNICO_BASE: TramoImpuesto[] = [
  { desde: 0, hasta: 13.5, factor: 0, rebaja: 0 },
  { desde: 13.5, hasta: 30, factor: 0.04, rebaja: 0.54 },
  { desde: 30, hasta: 50, factor: 0.08, rebaja: 1.74 },
  { desde: 50, hasta: 70, factor: 0.135, rebaja: 4.49 },
  { desde: 70, hasta: 90, factor: 0.23, rebaja: 11.14 },
  { desde: 90, hasta: 120, factor: 0.304, rebaja: 17.8 },
  { desde: 120, hasta: 310, factor: 0.35, rebaja: 23.32 },
  { desde: 310, hasta: null, factor: 0.4, rebaja: 38.82 },
];

export const AFP_CHILE: { afp: string; nombre: string; codigoPrevired: string }[] = [
  { afp: "capital", nombre: "AFP Capital", codigoPrevired: "33" },
  { afp: "cuprum", nombre: "AFP Cuprum", codigoPrevired: "03" },
  { afp: "habitat", nombre: "AFP Habitat", codigoPrevired: "05" },
  { afp: "modelo", nombre: "AFP Modelo", codigoPrevired: "34" },
  { afp: "planvital", nombre: "AFP PlanVital", codigoPrevired: "29" },
  { afp: "provida", nombre: "AFP ProVida", codigoPrevired: "08" },
  { afp: "uno", nombre: "AFP Uno", codigoPrevired: "35" },
];
