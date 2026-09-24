// ============================================================
// Cambio de plan — única función que lo hace, para que el Panel de
// Super-Admin y la autogestión de la propia empresa (Configuración >
// Plan) terminen siempre en el mismo lugar y no puedan desincronizar
// empresas.plan de empresa_modulos.
//
// Qué módulos trae cada plan lo define packages/shared/src/planes.ts
// (tarea 124): Esencial = núcleo, Operación = núcleo + un pack de rubro
// + Informe IA, Pro/Empresa/prueba = todo. Remuneraciones no depende
// del plan (adicional) y un cambio de plan no la toca.
// ============================================================
import type { PackRubro, Plan } from "@bitacora/shared";
import { MODULOS_GESTIONADOS_POR_PLAN, modulosDelPlan } from "@bitacora/shared";
import { supabase } from "./supabase";

export type OrigenCambioPlan = { tipo: "empresa"; usuarioId: string } | { tipo: "super_admin"; superAdminId: string };

// Prende/apaga los módulos gestionados por plan según el plan y pack.
// También la usa el alta de empresas nuevas (arrancan en prueba).
export async function aplicarModulosDelPlan(empresaId: string, plan: Plan, pack: PackRubro | null): Promise<void> {
  const incluidos = new Set(modulosDelPlan(plan, pack));
  const ahora = new Date().toISOString();
  const { error } = await supabase.from("empresa_modulos").upsert(
    MODULOS_GESTIONADOS_POR_PLAN.map((modulo) => ({ empresa_id: empresaId, modulo, activado: incluidos.has(modulo), actualizado_en: ahora })),
    { onConflict: "empresa_id,modulo" }
  );
  if (error) throw new Error(`No se pudieron actualizar los módulos del plan: ${error.message}`);
}

export async function cambiarPlanEmpresa(
  empresaId: string,
  planNuevo: Plan,
  origen: OrigenCambioPlan,
  cobroConectado = true,
  packNuevo?: PackRubro | null
): Promise<{ planAnterior: Plan; planNuevo: Plan }> {
  const { data: actual } = await supabase.from("empresas").select("plan, pack_rubro").eq("id", empresaId).maybeSingle();
  const planAnterior: Plan = actual?.plan ?? "trial";
  // Sin pack explícito se conserva el que ya tenía la empresa.
  const pack: PackRubro | null = packNuevo !== undefined ? packNuevo : (actual?.pack_rubro ?? null);

  await supabase.from("empresas").update({ plan: planNuevo, pack_rubro: pack }).eq("id", empresaId);
  await aplicarModulosDelPlan(empresaId, planNuevo, pack);

  if (planAnterior !== planNuevo) {
    await supabase.from("empresa_plan_historial").insert({
      empresa_id: empresaId,
      plan_anterior: planAnterior,
      plan_nuevo: planNuevo,
      origen: origen.tipo,
      usuario_id: origen.tipo === "empresa" ? origen.usuarioId : null,
      super_admin_id: origen.tipo === "super_admin" ? origen.superAdminId : null,
      cobro_conectado: cobroConectado,
    });
  }

  return { planAnterior, planNuevo };
}
