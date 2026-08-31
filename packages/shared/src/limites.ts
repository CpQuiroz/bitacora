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
};

export const LIMITES_POR_PLAN: Record<Plan, LimitesPlan> = {
  trial: { usuarios: 3, osPorMes: 30, storageGB: 2, iaTokensPorMes: 500_000 },
  basico: { usuarios: 5, osPorMes: 100, storageGB: 10, iaTokensPorMes: 1_500_000 },
  pro: { usuarios: 15, osPorMes: null, storageGB: 50, iaTokensPorMes: 5_000_000 },
};
