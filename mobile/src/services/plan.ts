import type { EmpresaPlanHistorial, Plan, Suscripcion, SuscripcionCobro } from "@bitacora/shared";
import { apiJson } from "./api";

// "Mi plan" en mobile (23-sep-2026) — SOLO LECTURA a propósito: pensando
// en Google Play, la contratación/cambio de plan y el pago se hacen en la
// web (Play exige su propio sistema de cobro para compras dentro de la
// app y no permite botones que lleven a pagar por fuera). Mismos
// endpoints que Configuración > Plan de la web.
export type InfoMiPlan = {
  planActual: Plan;
  pruebaTerminaEn: string | null;
  trialVencido: boolean;
  historial: EmpresaPlanHistorial[];
  suscripcion: Suscripcion | null;
  cobros: SuscripcionCobro[];
};

export async function obtenerMiPlan(): Promise<InfoMiPlan> {
  const [plan, sus] = await Promise.all([
    apiJson<{ planActual: Plan; pruebaTerminaEn?: string | null; trialVencido: boolean; historial: EmpresaPlanHistorial[] }>("/api/plan"),
    apiJson<{ suscripcion: Suscripcion; cobros: SuscripcionCobro[] }>("/api/suscripcion"),
  ]);
  if (!plan.ok) throw new Error(plan.error);
  return {
    planActual: plan.data.planActual,
    pruebaTerminaEn: plan.data.pruebaTerminaEn ?? null,
    trialVencido: plan.data.trialVencido,
    historial: plan.data.historial,
    suscripcion: sus.ok ? sus.data.suscripcion : null,
    cobros: sus.ok ? sus.data.cobros : [],
  };
}
