// ============================================================
// Cambio de plan — única función que lo hace, para que el Panel de
// Super-Admin y la autogestión de la propia empresa (Configuración >
// Plan) terminen siempre en el mismo lugar.
//
// Desde el rediseño de la tarea 124 (24-sep-2026) el plan NO prende ni
// apaga módulos: solo fija topes (usuarios, módulos activos, informes
// con IA). Los módulos los elige el Super-Admin (o el Admin de la
// empresa dentro del tope). Quien llama valida ANTES que los módulos
// activos quepan en el plan nuevo (verificarModulosCabenEnPlan).
// ============================================================
import type { Plan } from "@bitacora/shared";
import { MODULOS } from "@bitacora/shared";
import { supabase } from "./supabase";

export type OrigenCambioPlan = { tipo: "empresa"; usuarioId: string } | { tipo: "super_admin"; superAdminId: string };

// Empresa nueva: la prueba gratis trae todo activo.
export async function activarModulosDePrueba(empresaId: string): Promise<void> {
  const ahora = new Date().toISOString();
  const { error } = await supabase.from("empresa_modulos").upsert(
    MODULOS.map((modulo) => ({ empresa_id: empresaId, modulo, activado: true, actualizado_en: ahora })),
    { onConflict: "empresa_id,modulo" }
  );
  if (error) throw new Error(`No se pudieron activar los módulos de la prueba: ${error.message}`);
}

export async function cambiarPlanEmpresa(
  empresaId: string,
  planNuevo: Plan,
  origen: OrigenCambioPlan,
  cobroConectado = true
): Promise<{ planAnterior: Plan; planNuevo: Plan }> {
  // Si algo de esto falla se corta acá: seguir dejaría el plan y el
  // historial desincronizados.
  const { data: actual, error: errorLectura } = await supabase.from("empresas").select("plan").eq("id", empresaId).maybeSingle();
  if (errorLectura || !actual) throw new Error(`No se pudo leer el plan de la empresa: ${errorLectura?.message ?? "no existe"}`);
  const planAnterior: Plan = actual.plan;
  if (planAnterior === planNuevo) return { planAnterior, planNuevo };

  const { error: errorPlan } = await supabase.from("empresas").update({ plan: planNuevo }).eq("id", empresaId);
  if (errorPlan) throw new Error(`No se pudo guardar el plan: ${errorPlan.message}`);

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

  return { planAnterior, planNuevo };
}
