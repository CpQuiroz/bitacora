// ============================================================
// Webhook de Flow (confirmationUrl) — sin requiereAuth/requiereEmpresa a
// propósito, mismo criterio que reservaPublica.ts/encuestaPublica.ts.
// Flow solo manda un "token" — nunca confiamos en el body del POST, lo
// verificamos llamando de vuelta a la API de Flow con nuestra propia
// FLOW_SECRET_KEY (ver flow.ts, consultarEstadoPago). Responder 200
// rápido: Flow reintenta agresivo si no recibe 200 en <15s.
//
// NOTA para quien retome esto: la forma EXACTA en que Flow reporta un
// cobro fallido tras agotar los reintentos configurados en el Plan (¿un
// status puntual en payment/getStatus? ¿un evento de suscripción
// distinto?) no se pudo verificar contra un cobro real todavía — falta
// crear el Plan en el panel de Flow y completar un ciclo de cobro real
// en sandbox para confirmarlo con certeza. El código de abajo asume el
// status numérico documentado en la comunidad (1=pendiente, 2=pagado,
// 3=rechazado, 4=anulado) — CONFIRMAR contra una respuesta real antes de
// confiar en esto para producción.
// ============================================================
import { Router } from "express";
import { supabase } from "../supabase";
import { consultarEstadoPago } from "../flow";
import { enviarConReintento } from "../email";
import { env } from "../env";
import { ah } from "../asyncHandler";

export const flowWebhookRouter = Router();

const MAX_INTENTOS_ANTES_DE_SUSPENDER = 3;

async function empresaDeCustomerId(flowCustomerId: string) {
  const { data } = await supabase.from("suscripciones").select("*, empresa:empresas(id, nombre, correo_empresa)").eq("flow_customer_id", flowCustomerId).maybeSingle();
  return data;
}

async function avisarPagoFallido(empresaCorreo: string | null, empresaNombre: string, intento: number): Promise<void> {
  if (!empresaCorreo) return;
  try {
    await enviarConReintento(
      {
        from: env.RESEND_FROM_EMAIL,
        to: empresaCorreo,
        subject: "No pudimos procesar el cobro de tu suscripción",
        html: `<div style="font-family:sans-serif;"><p>Hola ${empresaNombre},</p><p>El cobro mensual de tu suscripción a Bitácora no se pudo procesar (intento ${intento}). Vamos a reintentar automáticamente — si tu tarjeta cambió, actualízala desde Configuración &gt; Plan.</p></div>`,
      },
      "aviso de cobro fallido"
    );
  } catch (err) {
    console.error("Error avisando cobro fallido:", err);
  }
}

async function avisarSuperAdmins(empresaNombre: string): Promise<void> {
  const { data: admins } = await supabase.from("super_admins").select("correo").eq("activo", true);
  for (const admin of admins ?? []) {
    try {
      await enviarConReintento(
        {
          from: env.RESEND_FROM_EMAIL,
          to: admin.correo,
          subject: `Empresa suspendida por falta de pago: ${empresaNombre}`,
          html: `<div style="font-family:sans-serif;"><p>${empresaNombre} quedó suspendida — su suscripción agotó los reintentos de cobro.</p></div>`,
        },
        "aviso a super-admin de suspensión por pago"
      );
    } catch (err) {
      console.error("Error avisando a super-admin:", err);
    }
  }
}

flowWebhookRouter.post(
  "/confirmacion",
  ah(async (req, res) => {
    // Responder rápido primero — el procesamiento sigue después, igual
    // que el webhook de WhatsApp.
    res.sendStatus(200);

    const token = req.body?.token;
    if (typeof token !== "string" || !token) {
      console.error("Webhook de Flow sin token");
      return;
    }

    try {
      const pago = await consultarEstadoPago(token);
      const customerId = (pago as { customerId?: string; payer?: string }).customerId ?? null;
      const status = String((pago as { status?: string | number }).status ?? "");
      const monto = Number((pago as { amount?: number }).amount ?? 0);
      const flowPaymentId = String((pago as { flowOrder?: string | number }).flowOrder ?? token);

      if (!customerId) {
        console.error("Webhook de Flow: no se pudo determinar el customerId del pago", pago);
        return;
      }
      const suscripcion = await empresaDeCustomerId(customerId);
      if (!suscripcion) {
        console.error("Webhook de Flow: no encontré una empresa para el customerId", customerId);
        return;
      }
      const empresa = (suscripcion as unknown as { empresa: { id: string; nombre: string; correo_empresa: string | null } }).empresa;

      if (status === "2") {
        // Pagado.
        await supabase.from("suscripcion_cobros").insert({
          empresa_id: empresa.id,
          flow_payment_id: flowPaymentId,
          monto,
          estado: "exitoso",
          intento_numero: 1,
        });
        await supabase
          .from("suscripciones")
          .update({ estado: "activa", actualizado_en: new Date().toISOString() })
          .eq("empresa_id", empresa.id);
      } else if (status === "3" || status === "4") {
        // Rechazado o anulado — registrar el intento fallido y avisar.
        const { count } = await supabase
          .from("suscripcion_cobros")
          .select("id", { count: "exact", head: true })
          .eq("empresa_id", empresa.id)
          .eq("estado", "fallido")
          .gte("creado_en", new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString());
        const intentoNumero = (count ?? 0) + 1;

        await supabase.from("suscripcion_cobros").insert({
          empresa_id: empresa.id,
          flow_payment_id: flowPaymentId,
          monto,
          estado: "fallido",
          intento_numero: intentoNumero,
          error: `Flow status ${status}`,
        });

        if (intentoNumero >= MAX_INTENTOS_ANTES_DE_SUSPENDER) {
          await supabase
            .from("suscripciones")
            .update({ estado: "suspendida_por_pago", actualizado_en: new Date().toISOString() })
            .eq("empresa_id", empresa.id);
          await supabase.from("empresas").update({ estado: "suspendida" }).eq("id", empresa.id);
          await avisarSuperAdmins(empresa.nombre);
        } else {
          await supabase
            .from("suscripciones")
            .update({ estado: "pago_pendiente", actualizado_en: new Date().toISOString() })
            .eq("empresa_id", empresa.id);
        }
        await avisarPagoFallido(empresa.correo_empresa, empresa.nombre, intentoNumero);
      }
    } catch (err) {
      console.error("Error procesando webhook de Flow:", err);
    }
  })
);
