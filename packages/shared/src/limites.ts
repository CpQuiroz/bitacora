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
  // Módulos activos a la vez (ver MODULOS_CONTABLES en planes.ts).
  // null = todos.
  modulosMax: number | null;
  // Informes con IA (solo Admin). Por mes, o en toda la prueba gratis.
  // null = sin tope propio (solo cuenta iaTokensPorMes).
  informesIA: { tope: number; periodo: "mes" | "prueba" } | null;
};

// Tarea 124 (rediseño 24-sep-2026). Ver packages/shared/src/planes.ts.
export const LIMITES_POR_PLAN: Record<Plan, LimitesPlan> = {
  trial: { usuarios: 3, osPorMes: 30, storageGB: 2, iaTokensPorMes: 500_000, modulosMax: null, informesIA: { tope: 10, periodo: "prueba" } },
  basico: { usuarios: 5, osPorMes: 100, storageGB: 10, iaTokensPorMes: 500_000, modulosMax: 6, informesIA: { tope: 5, periodo: "mes" } },
  operacion: { usuarios: 15, osPorMes: null, storageGB: 25, iaTokensPorMes: 1_500_000, modulosMax: 10, informesIA: { tope: 20, periodo: "mes" } },
  pro: { usuarios: 30, osPorMes: null, storageGB: 50, iaTokensPorMes: 5_000_000, modulosMax: null, informesIA: null },
  empresa: { usuarios: 100, osPorMes: null, storageGB: 200, iaTokensPorMes: 15_000_000, modulosMax: null, informesIA: null },
};

// IA completa (Asistente y análisis de fotos): prueba, Pro y Empresa.
// El informe con IA es de todos los planes (solo Admin, con tope).
export const PLANES_CON_IA_COMPLETA: readonly Plan[] = ["trial", "pro", "empresa"];

export function planPermiteIACompleta(plan: Plan | null | undefined): boolean {
  return plan != null && PLANES_CON_IA_COMPLETA.includes(plan);
}

// Nombre histórico (tarea 122), lo usa la web para el botón de fotos.
export const planPermiteAnalisisFotosIA = planPermiteIACompleta;
