// ============================================================
// Planes de Bitácora (tarea 124, rediseño aprobado por la usuaria el
// 24-sep-2026). El plan NO decide qué módulos tiene una empresa: fija
// CUÁNTOS puede tener activos (tope en LIMITES_POR_PLAN.modulosMax), y
// cuáles los elige el Super-Admin (o el Admin de la empresa, dentro del
// tope). Cambiar de plan no prende ni apaga módulos.
//
//  - Prueba (`trial`): 7 días, todo activo.
//  - Esencial (clave `basico`, se mantuvo para no migrar datos): hasta 6.
//  - Operación: hasta 10.
//  - Pro: todos, con IA completa.
//  - Empresa: todos. Programado pero apagado (PLAN_EMPRESA_DISPONIBLE).
// ============================================================
import type { Modulo } from "./permisos";
import { MODULOS, moduloActivadoPorDefecto } from "./permisos";
import type { Plan, PlanPago } from "./types";

export const PLANES_PAGO: readonly PlanPago[] = ["basico", "operacion", "pro", "empresa"];

// El plan Empresa queda programado para un cliente grande futuro, pero
// hoy la empresa no lo ve ni lo contrata (sí lo puede asignar el
// Super-Admin). Para prenderlo, cambiar a true.
export const PLAN_EMPRESA_DISPONIBLE = false;

// Planes que la propia empresa ve y contrata en Configuración > Plan.
export const PLANES_CONTRATABLES: readonly PlanPago[] = PLANES_PAGO.filter((p) => p !== "empresa" || PLAN_EMPRESA_DISPONIBLE);

export const ETIQUETA_PLAN: Record<Plan, string> = {
  trial: "Prueba gratis",
  basico: "Esencial",
  operacion: "Operación",
  pro: "Pro",
  empresa: "Empresa",
};

// Precio mensual en UF, sin IVA. Empresa es el precio "desde".
export const PRECIO_PLAN_UF: Record<PlanPago, number> = {
  basico: 1.5,
  operacion: 3.5,
  pro: 6,
  empresa: 12,
};

// Duración de la prueba gratis de una empresa nueva.
export const DIAS_PRUEBA = 7;

// Secciones que cuentan para el tope de módulos del plan: todas las que
// se prenden y apagan, menos las de base (configuracion, gestion_control)
// y las de IA (que dependen del plan y del rol, no del tope).
const MODULOS_QUE_NO_CUENTAN: readonly Modulo[] = ["configuracion", "gestion_control", "informe_ia", "asistente"];
export const MODULOS_CONTABLES: readonly Modulo[] = MODULOS.filter((m) => !MODULOS_QUE_NO_CUENTAN.includes(m));

export function cuentaParaTope(modulo: Modulo): boolean {
  return MODULOS_CONTABLES.includes(modulo);
}

export function esPlanPago(valor: unknown): valor is PlanPago {
  return typeof valor === "string" && (PLANES_PAGO as readonly string[]).includes(valor);
}

// Módulos activos que cuentan para el tope, a partir de las filas de
// empresa_modulos de UNA empresa. Sin fila rige el default del código
// (moduloActivadoPorDefecto), igual que el resto del backend.
export function modulosContablesActivos(filas: readonly { modulo: string; activado: boolean }[]): Modulo[] {
  const estado = new Map(filas.map((f) => [f.modulo, f.activado]));
  return MODULOS_CONTABLES.filter((m) => (estado.has(m) ? estado.get(m)! : moduloActivadoPorDefecto(m)));
}
