// ============================================================
// Cambio de plan (Trial/Básico/Pro) — única función que lo hace, para
// que el Panel de Super-Admin y la autogestión de la propia empresa
// (Configuración > Plan) terminen siempre en el mismo lugar y no puedan
// desincronizar empresas.plan de empresa_modulos.
//
// Básico = línea base actual (los módulos que ya tiene todo el mundo).
// Pro = Básico + todos los módulos opt-in (MODULOS_OPCIONALES) — decisión
// de producto confirmada: no existe una tabla de "qué incluye cada plan"
// aparte, se deriva directo de lo que ya existe en permisos.ts.
// ============================================================
import type { Plan } from "@bitacora/shared";
import { MODULOS_OPCIONALES } from "@bitacora/shared";
import { supabase } from "./supabase";

export type OrigenCambioPlan = { tipo: "empresa"; usuarioId: string } | { tipo: "super_admin"; superAdminId: string };

export async function cambiarPlanEmpresa(
  empresaId: string,
  planNuevo: Plan,
  origen: OrigenCambioPlan,
  cobroConectado = true
): Promise<{ planAnterior: Plan; planNuevo: Plan }> {
  const { data: actual } = await supabase.from("empresas").select("plan").eq("id", empresaId).maybeSingle();
  const planAnterior: Plan = actual?.plan ?? "trial";

  await supabase.from("empresas").update({ plan: planNuevo }).eq("id", empresaId);

  const activarOptIn = planNuevo === "pro";
  for (const modulo of MODULOS_OPCIONALES) {
    await supabase
      .from("empresa_modulos")
      .upsert(
        { empresa_id: empresaId, modulo, activado: activarOptIn, actualizado_en: new Date().toISOString() },
        { onConflict: "empresa_id,modulo" }
      );
  }

  await supabase.from("empresa_plan_historial").insert({
    empresa_id: empresaId,
    plan_anterior: planAnterior,
    plan_nuevo: planNuevo,
    origen: origen.tipo,
    usuario_id: origen.tipo === "empresa" ? origen.usuarioId : null,
    super_admin_id: origen.tipo === "super_admin" ? origen.superAdminId : null,
    cobro_conectado: cobroConectado,
  });

  return { planAnterior, planNuevo };
}
