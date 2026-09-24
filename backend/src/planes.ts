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
// Con `anterior`, solo toca los módulos que CAMBIAN entre el plan (y
// pack) anterior y el nuevo: lo que ambos traen queda como esté, así un
// módulo apagado a mano (Super-Admin) no se vuelve a prender solo por
// cambiar de plan. Sin `anterior` (alta de empresa) aplica todo.
export async function aplicarModulosDelPlan(
  empresaId: string,
  plan: Plan,
  pack: PackRubro | null,
  anterior?: { plan: Plan; pack: PackRubro | null }
): Promise<void> {
  const incluidos = new Set(modulosDelPlan(plan, pack));
  const antes = anterior ? new Set(modulosDelPlan(anterior.plan, anterior.pack)) : null;
  const aTocar = MODULOS_GESTIONADOS_POR_PLAN.filter((m) => !antes || antes.has(m) !== incluidos.has(m));
  if (aTocar.length === 0) return;
  const ahora = new Date().toISOString();
  const { error } = await supabase.from("empresa_modulos").upsert(
    aTocar.map((modulo) => ({ empresa_id: empresaId, modulo, activado: incluidos.has(modulo), actualizado_en: ahora })),
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
  // Si algo de esto falla se corta acá: seguir dejaría el plan, los
  // módulos y el historial desincronizados, que es lo que esta función
  // existe para evitar.
  const { data: actual, error: errorLectura } = await supabase.from("empresas").select("plan, pack_rubro").eq("id", empresaId).maybeSingle();
  if (errorLectura || !actual) throw new Error(`No se pudo leer el plan de la empresa: ${errorLectura?.message ?? "no existe"}`);
  const planAnterior: Plan = actual.plan;
  const packAnterior: PackRubro | null = actual.pack_rubro ?? null;
  // Sin pack explícito se conserva el que ya tenía la empresa.
  const pack: PackRubro | null = packNuevo !== undefined ? packNuevo : packAnterior;

  const { error: errorPlan } = await supabase.from("empresas").update({ plan: planNuevo, pack_rubro: pack }).eq("id", empresaId);
  if (errorPlan) throw new Error(`No se pudo guardar el plan: ${errorPlan.message}`);
  await aplicarModulosDelPlan(empresaId, planNuevo, pack, { plan: planAnterior, pack: packAnterior });

  if (planAnterior !== planNuevo) {
    const { error: errorHistorial } = await supabase.from("empresa_plan_historial").insert({
      empresa_id: empresaId,
      plan_anterior: planAnterior,
      plan_nuevo: planNuevo,
      origen: origen.tipo,
      usuario_id: origen.tipo === "empresa" ? origen.usuarioId : null,
      super_admin_id: origen.tipo === "super_admin" ? origen.superAdminId : null,
      cobro_conectado: cobroConectado,
    });
    // El plan ya cambió: no se revierte por el historial, solo se avisa.
    if (errorHistorial) console.error("No se pudo registrar el cambio de plan en el historial:", errorHistorial.message);
  }

  return { planAnterior, planNuevo };
}
