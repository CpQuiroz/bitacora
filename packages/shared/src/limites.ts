// ============================================================
// Límites de uso por plan — único punto que define los números,
// usado tanto por el backend (para bloquear de verdad) como por el
// frontend (para mostrar "X de Y" antes de llegar al límite).
// osPorMes: null = ilimitado. El costo real de IA/storage es
// insignificante frente al precio del plan (ver análisis de costos) —
// estos topes son un freno anti-abuso, no un control de costo.
// ============================================================
import type { Plan } from "./types";

export type LimitesPlan = {
  usuarios: number;
  osPorMes: number | null;
  storageGB: number;
  iaTokensPorMes: number;
  // Informes con IA (informe de OS, informe libre y variantes) por mes.
  // null = sin tope propio (solo cuenta iaTokensPorMes).
  informesIAPorMes: number | null;
};

// Tarea 124 (24-sep-2026): 4 planes pagos + prueba. La prueba trae todo
// como Pro, pero con 3 usuarios.
export const LIMITES_POR_PLAN: Record<Plan, LimitesPlan> = {
  trial: { usuarios: 3, osPorMes: 30, storageGB: 2, iaTokensPorMes: 500_000, informesIAPorMes: null },
  basico: { usuarios: 5, osPorMes: 100, storageGB: 10, iaTokensPorMes: 500_000, informesIAPorMes: null },
  operacion: { usuarios: 15, osPorMes: null, storageGB: 25, iaTokensPorMes: 1_500_000, informesIAPorMes: 20 },
  pro: { usuarios: 30, osPorMes: null, storageGB: 50, iaTokensPorMes: 5_000_000, informesIAPorMes: null },
  empresa: { usuarios: 100, osPorMes: null, storageGB: 200, iaTokensPorMes: 15_000_000, informesIAPorMes: null },
};

// Análisis con IA de fotos de OS (tarea 122, 24-sep-2026): deja de ser
// automático al subir — solo a pedido del Admin y solo en estos planes
// (la prueba incluida: trae todo como Pro).
export const PLANES_CON_ANALISIS_FOTOS_IA: readonly Plan[] = ["trial", "pro", "empresa"];

export function planPermiteAnalisisFotosIA(plan: Plan | null | undefined): boolean {
  return plan != null && PLANES_CON_ANALISIS_FOTOS_IA.includes(plan);
}
