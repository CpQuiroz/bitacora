// ============================================================
// Autogestión de plan (Trial/Básico/Pro) desde Configuración > Plan.
// Básico = línea base (MODULOS menos los opt-in). Pro = Básico + todos
// los módulos opt-in (MODULOS_OPCIONALES) — ver planes.ts.
// ============================================================
import { Router } from "express";
import { MODULOS, MODULOS_OPCIONALES } from "@bitacora/shared";
import { supabase } from "../supabase";
import { env } from "../env";
import type { RequestConEmpresa } from "../empresa";
import { ah } from "../asyncHandler";
import { requiereRol } from "../permisos";
import { cambiarPlanEmpresa } from "../planes";
import { suscribirAPlan, cancelarSuscripcionFlow } from "../flow";

export const planRouter = Router();

const MODULOS_BASICO = MODULOS.filter((m) => !MODULOS_OPCIONALES.includes(m));

function resolverFlowPlanId(plan: "basico" | "pro"): string | null {
  return plan === "basico" ? env.FLOW_PLAN_ID_BASICO : env.FLOW_PLAN_ID_PRO;
}

planRouter.get(
  "/",
  ah<RequestConEmpresa>(async (req, res) => {
    const { data: empresa } = await supabase.from("empresas").select("plan").eq("id", req.empresaId!).maybeSingle();
    const { data: historial } = await supabase
      .from("empresa_plan_historial")
      .select("*")
      .eq("empresa_id", req.empresaId!)
      .order("creado_en", { ascending: false })
      .limit(20);

    res.json({
      planActual: empresa?.plan ?? "trial",
      proDisponible: Boolean(env.FLOW_PLAN_ID_PRO),
      modulosBasico: MODULOS_BASICO,
      modulosExtraPro: MODULOS_OPCIONALES,
      historial: historial ?? [],
    });
  })
);

planRouter.post(
  "/cambiar",
  requiereRol("admin"),
  ah<RequestConEmpresa>(async (req, res) => {
    const { plan } = req.body ?? {};
    if (plan !== "basico" && plan !== "pro") {
      res.status(400).json({ error: "plan debe ser 'basico' o 'pro'" });
      return;
    }
    if (!resolverFlowPlanId(plan)) {
      res.status(400).json({ error: `El plan "${plan}" todavía no está disponible para contratar` });
      return;
    }

    const { data: suscripcion } = await supabase.from("suscripciones").select("*").eq("empresa_id", req.empresaId!).maybeSingle();

    // Sin tarjeta todavía: el frontend debe pasar por el flujo de registro
    // de tarjeta (POST /api/suscripcion/tarjeta con { plan }) — el resto lo
    // resuelve el lazy-check de suscripcion.ts al confirmarse la tarjeta.
    if (!suscripcion?.tarjeta_ultimos4 || !suscripcion.flow_customer_id) {
      res.json({ requiereTarjeta: true });
      return;
    }

    // Ya hay tarjeta en Flow (Oneclick) — cambiar de tier entre planes
    // pagos es cancelar la suscripción actual y crear una nueva en el
    // Plan correspondiente, sin volver a pedir la tarjeta.
    try {
      if (suscripcion.flow_subscription_id) {
        await cancelarSuscripcionFlow(suscripcion.flow_subscription_id);
      }
      const nuevaSuscripcion = await suscribirAPlan(suscripcion.flow_customer_id, resolverFlowPlanId(plan)!);
      await supabase
        .from("suscripciones")
        .update({ flow_subscription_id: nuevaSuscripcion.subscriptionId, estado: "trial", actualizado_en: new Date().toISOString() })
        .eq("empresa_id", req.empresaId!);
    } catch (err) {
      console.error("Error cambiando de plan en Flow:", err);
      res.status(502).json({ error: "No pudimos conectar con la pasarela de pago — intenta de nuevo en un momento" });
      return;
    }

    const resultado = await cambiarPlanEmpresa(req.empresaId!, plan, { tipo: "empresa", usuarioId: req.userId! });
    res.json({ requiereTarjeta: false, ...resultado });
  })
);
