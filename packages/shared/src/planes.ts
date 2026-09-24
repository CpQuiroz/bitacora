// ============================================================
// Planes de Bitácora (tarea 124, decisión de la usuaria 24-sep-2026).
// Único lugar que define qué módulos trae cada plan, sus nombres
// visibles y su precio en UF. Lo usan el backend (para activar
// módulos al cambiar de plan) y la web/mobile (para mostrar planes).
//
//  - Esencial (clave `basico`): el núcleo de terreno.
//  - Operación: Esencial + UN pack de rubro + Informe con IA (tope
//    mensual en LIMITES_POR_PLAN).
//  - Pro y Empresa: todo, con IA completa.
//  - Prueba (`trial`): todo, como Pro, con menos usuarios.
// Remuneraciones NO depende del plan: es un adicional (tarea 125) y
// cambiar de plan no lo toca.
// ============================================================
import type { Modulo } from "./permisos";
import type { PackRubro, Plan, PlanPago, Rubro } from "./types";

export const PLANES_PAGO: readonly PlanPago[] = ["basico", "operacion", "pro", "empresa"];

export const ETIQUETA_PLAN: Record<Plan, string> = {
  trial: "Prueba gratis",
  basico: "Esencial",
  operacion: "Operación",
  pro: "Pro",
  empresa: "Empresa",
};

// Precio mensual en UF, sin IVA. Empresa es el precio "desde": el plan
// se puede contratar a este valor o cotizar uno mayor.
export const PRECIO_PLAN_UF: Record<PlanPago, number> = {
  basico: 1.5,
  operacion: 3.5,
  pro: 6,
  empresa: 12,
};

export const MODULOS_ESENCIAL: readonly Modulo[] = [
  "agenda",
  "ordenes_servicio",
  "cotizaciones",
  "cobros",
  "financiero",
  "informes",
  "configuracion",
  "gestion_control",
];

export const PACKS_RUBRO: Record<PackRubro, readonly Modulo[]> = {
  transporte: ["viajes", "registros", "rutas", "flota"],
  mantencion: ["levantamientos"],
  agenda: ["agenda_pro"],
};

export const ETIQUETA_PACK: Record<PackRubro, string> = {
  transporte: "Transporte",
  mantencion: "Mantención",
  agenda: "Servicios con agenda",
};

export const PACKS: readonly PackRubro[] = ["transporte", "mantencion", "agenda"];

// Pack sugerido según el rubro con que se registró la empresa.
export function packSugeridoDeRubro(rubro: Rubro | null | undefined): PackRubro {
  if (rubro === "servicio_tecnico") return "mantencion";
  if (rubro === "cosmetologia") return "agenda";
  return "transporte";
}

const MODULOS_TODOS_LOS_PACKS: readonly Modulo[] = PACKS.flatMap((p) => PACKS_RUBRO[p]);

// Módulos que prende o apaga un cambio de plan. Remuneraciones queda
// afuera a propósito (adicional, no depende del plan).
export const MODULOS_GESTIONADOS_POR_PLAN: readonly Modulo[] = [
  ...MODULOS_ESENCIAL,
  ...MODULOS_TODOS_LOS_PACKS,
  "informe_ia",
  "asistente",
];

export function modulosDelPlan(plan: Plan, pack: PackRubro | null | undefined): Modulo[] {
  if (plan === "basico") return [...MODULOS_ESENCIAL];
  if (plan === "operacion") return [...MODULOS_ESENCIAL, ...PACKS_RUBRO[pack ?? "transporte"], "informe_ia"];
  return [...MODULOS_GESTIONADOS_POR_PLAN];
}

export function esPlanPago(valor: unknown): valor is PlanPago {
  return typeof valor === "string" && (PLANES_PAGO as readonly string[]).includes(valor);
}

export function esPackRubro(valor: unknown): valor is PackRubro {
  return typeof valor === "string" && (PACKS as readonly string[]).includes(valor);
}
