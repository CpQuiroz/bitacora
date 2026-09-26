import type { EmpresaPlanHistorial, Modulo, Plan, Suscripcion, SuscripcionCobro } from "@bitacora/shared";
import { apiJson } from "./api";

// "Mi plan" en mobile (23-sep-2026) — SOLO LECTURA a propósito: pensando
// en Google Play, la contratación/cambio de plan y el pago se hacen en la
// web (Play exige su propio sistema de cobro para compras dentro de la
// app y no permite botones que lleven a pagar por fuera). Mismos
// endpoints que Configuración > Plan de la web.
// Tarea 151: además, módulos activos respecto del tope, consumo del plan y
// precio en UF con su equivalente en CLP (UF del día, cache en el backend).
// Los campos nuevos son opcionales: un backend anterior no los manda.
export type ConsumoPlan = {
  usuarios: { usados: number; tope: number };
  osMes: { usados: number; tope: number | null };
  almacenamiento: { usadoGB: number; topeGB: number };
  informesIA: { usados: number; tope: number | null; periodo: "mes" | "prueba" | null };
};
export type PrecioPlan = { uf: number; clp: number | null; valorUf: number | null; fechaUf: string | null; ufDelDia: boolean };

export type InfoMiPlan = {
  planActual: Plan;
  pruebaTerminaEn: string | null;
  trialVencido: boolean;
  historial: EmpresaPlanHistorial[];
  suscripcion: Suscripcion | null;
  cobros: SuscripcionCobro[];
  modulosActivos: Modulo[];
  modulosMax: number | null;
  consumo: ConsumoPlan | null;
  precio: PrecioPlan | null;
};

type RespuestaPlan = {
  planActual: Plan;
  pruebaTerminaEn?: string | null;
  trialVencido: boolean;
  historial: EmpresaPlanHistorial[];
  modulosActivosLista?: Modulo[];
  modulosMax?: number | null;
  consumo?: ConsumoPlan;
  precio?: PrecioPlan | null;
};

export async function obtenerMiPlan(): Promise<InfoMiPlan> {
  const [plan, sus] = await Promise.all([
    apiJson<RespuestaPlan>("/api/plan"),
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
    modulosActivos: plan.data.modulosActivosLista ?? [],
    modulosMax: plan.data.modulosMax ?? null,
    consumo: plan.data.consumo ?? null,
    precio: plan.data.precio ?? null,
  };
}
