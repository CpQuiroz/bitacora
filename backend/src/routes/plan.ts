// ============================================================
// Autogestión de plan desde Configuración > Plan (tarea 124): Esencial
// (`basico`), Operación (con pack de rubro), Pro y Empresa. Qué trae
// cada uno vive en packages/shared/src/planes.ts; el cambio real de
// módulos lo hace cambiarPlanEmpresa (planes.ts).
// ============================================================
import { Router } from "express";
import type { PlanPago } from "@bitacora/shared";
import { ETIQUETA_PLAN, PLANES_PAGO, esPackRubro, esPlanPago, packSugeridoDeRubro } from "@bitacora/shared";
import { supabase } from "../supabase";
import type { RequestConEmpresa } from "../empresa";
import { ah } from "../asyncHandler";
import { requiereAccion } from "../permisos";
import { cambiarPlanEmpresa } from "../planes";
import { suscribirAPlan, cancelarSuscripcionFlow, flowPlanIdDe } from "../flow";
import { enviarConReintento } from "../email";
import { env } from "../env";
import { limitarCotizacionPlan } from "../rateLimiters";

export const planRouter = Router();

planRouter.get(
  "/",
  ah<RequestConEmpresa>(async (req, res) => {
    const { data: empresa } = await supabase
      .from("empresas")
      .select("plan, pack_rubro, rubro, prueba_termina_en")
      .eq("id", req.empresaId!)
      .maybeSingle();
    const { data: historial } = await supabase
      .from("empresa_plan_historial")
      .select("*")
      .eq("empresa_id", req.empresaId!)
      .order("creado_en", { ascending: false })
      .limit(20);

    const HOY = new Date().toISOString().slice(0, 10);
    const trialVencido =
      empresa?.plan === "trial" && empresa.prueba_termina_en != null && empresa.prueba_termina_en < HOY;

    // Planes que se pueden contratar con tarjeta hoy (tienen Plan de Flow).
    const contratables = Object.fromEntries(PLANES_PAGO.map((p) => [p, Boolean(flowPlanIdDe(p))])) as Record<PlanPago, boolean>;

    res.json({
      planActual: empresa?.plan ?? "trial",
      packRubro: empresa?.pack_rubro ?? null,
      packSugerido: packSugeridoDeRubro(empresa?.rubro),
      // Fecha de término del trial — la pantalla "Mi plan" de mobile
      // (23-sep-2026) muestra los días que quedan.
      pruebaTerminaEn: empresa?.prueba_termina_en ?? null,
      trialVencido,
      contratables,
      historial: historial ?? [],
    });
  })
);

planRouter.post(
  "/cambiar",
  requiereAccion("gestionar_plan"),
  ah<RequestConEmpresa>(async (req, res) => {
    const { plan, pack } = req.body ?? {};
    if (!esPlanPago(plan)) {
      res.status(400).json({ error: "plan debe ser 'basico', 'operacion', 'pro' o 'empresa'" });
      return;
    }
    if (plan === "operacion" && !esPackRubro(pack)) {
      res.status(400).json({ error: "Elige el pack de rubro del plan Operación" });
      return;
    }
    const packElegido = plan === "operacion" ? pack : undefined;

    const { data: empresa } = await supabase.from("empresas").select("plan").eq("id", req.empresaId!).maybeSingle();

    // Mismo plan Operación con otro pack: no hay nada que cambiar en Flow
    // (mismo Plan, mismo precio) — solo los módulos.
    if (empresa?.plan === plan) {
      if (plan !== "operacion") {
        res.status(409).json({ error: "Ya estás en ese plan" });
        return;
      }
      const resultado = await cambiarPlanEmpresa(req.empresaId!, plan, { tipo: "empresa", usuarioId: req.userId! }, true, packElegido);
      res.json({ requiereTarjeta: false, ...resultado });
      return;
    }

    const flowPlanId = flowPlanIdDe(plan);
    if (!flowPlanId) {
      res.status(400).json({ error: `El plan ${ETIQUETA_PLAN[plan]} todavía no está disponible para contratar` });
      return;
    }

    const { data: suscripcion } = await supabase.from("suscripciones").select("*").eq("empresa_id", req.empresaId!).maybeSingle();

    // Sin tarjeta todavía: el frontend debe pasar por el flujo de registro
    // de tarjeta (POST /api/suscripcion/tarjeta con { plan, pack }) — el
    // resto lo resuelve el lazy-check de suscripcion.ts al confirmarse.
    if (!suscripcion?.tarjeta_ultimos4 || !suscripcion.flow_customer_id) {
      res.json({ requiereTarjeta: true });
      return;
    }

    // Ya hay tarjeta en Flow (Oneclick) — cambiar de plan pago es cancelar
    // la suscripción actual y crear una nueva en el Plan de Flow que
    // corresponde, sin volver a pedir la tarjeta.
    try {
      if (suscripcion.flow_subscription_id) {
        await cancelarSuscripcionFlow(suscripcion.flow_subscription_id);
      }
      const nuevaSuscripcion = await suscribirAPlan(suscripcion.flow_customer_id, flowPlanId);
      await supabase
        .from("suscripciones")
        .update({ flow_subscription_id: nuevaSuscripcion.subscriptionId, estado: "trial", actualizado_en: new Date().toISOString() })
        .eq("empresa_id", req.empresaId!);
    } catch (err) {
      console.error("Error cambiando de plan en Flow:", err);
      res.status(502).json({ error: "No pudimos conectar con la pasarela de pago — intenta de nuevo en un momento" });
      return;
    }

    const resultado = await cambiarPlanEmpresa(req.empresaId!, plan, { tipo: "empresa", usuarioId: req.userId! }, true, packElegido);
    res.json({ requiereTarjeta: false, ...resultado });
  })
);

function escaparHtml(texto: string): string {
  return texto.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

// Plan Empresa a cotizar (tarea 124): avisa por correo a los
// Super-Admin activos. Ellos responden y, si se acuerda, activan el
// plan desde el panel (se cobra por transferencia contra factura).
planRouter.post(
  "/cotizar-empresa",
  limitarCotizacionPlan,
  requiereAccion("gestionar_plan"),
  ah<RequestConEmpresa>(async (req, res) => {
    const mensaje = typeof req.body?.mensaje === "string" ? req.body.mensaje.trim().slice(0, 2000) : "";
    const usuariosEstimados = Number.isInteger(req.body?.usuarios) ? Math.max(0, Math.min(10_000, req.body.usuarios as number)) : null;

    const [{ data: empresa }, { count: usuariosActivos }, { data: admins }, { data: authUser }] = await Promise.all([
      supabase.from("empresas").select("nombre, rut, plan").eq("id", req.empresaId!).maybeSingle(),
      supabase.from("usuarios").select("id", { count: "exact", head: true }).eq("empresa_id", req.empresaId!).eq("activo", true),
      supabase.from("super_admins").select("correo").eq("activo", true),
      supabase.auth.admin.getUserById(req.userId!),
    ]);
    const destinatarios = (admins ?? []).map((a) => a.correo).filter(Boolean);
    if (destinatarios.length === 0) {
      res.status(503).json({ error: "No pudimos enviar tu solicitud en este momento. Intenta de nuevo más tarde." });
      return;
    }
    const correoSolicitante = authUser?.user?.email ?? "(sin correo)";
    const nombreEmpresa = empresa?.nombre ?? "Empresa";

    const html = `
      <div style="font-family:sans-serif;max-width:560px;">
        <h2>Solicitud de cotización del plan Empresa</h2>
        <p><b>Empresa:</b> ${escaparHtml(nombreEmpresa)}${empresa?.rut ? ` (${escaparHtml(empresa.rut)})` : ""}</p>
        <p><b>Plan actual:</b> ${escaparHtml(ETIQUETA_PLAN[(empresa?.plan ?? "trial") as keyof typeof ETIQUETA_PLAN] ?? String(empresa?.plan))}</p>
        <p><b>Usuarios activos hoy:</b> ${usuariosActivos ?? 0}${usuariosEstimados != null ? ` · <b>usuarios que necesita:</b> ${usuariosEstimados}` : ""}</p>
        <p><b>Contacto:</b> ${escaparHtml(correoSolicitante)}</p>
        ${mensaje ? `<p><b>Mensaje:</b><br>${escaparHtml(mensaje).replace(/\n/g, "<br>")}</p>` : ""}
      </div>`;

    try {
      await enviarConReintento(
        { from: env.RESEND_FROM_EMAIL, to: destinatarios, reply_to: authUser?.user?.email ?? undefined, subject: `Cotización plan Empresa — ${nombreEmpresa}`, html },
        "la solicitud de cotización"
      );
    } catch (err) {
      console.error("cotizar-empresa:", err);
      res.status(502).json({ error: "No pudimos enviar tu solicitud. Intenta de nuevo en unos minutos." });
      return;
    }
    res.status(201).json({ ok: true });
  })
);
