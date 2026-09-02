// ============================================================
// Suscripción B2B (Bitácora cobrándole a sus empresas clientes) — lado
// autenticado, para la propia empresa. Ver backend/src/flow.ts para el
// cliente HTTP y backend/src/routes/flowWebhook.ts para los eventos.
// ============================================================
import { Router } from "express";
import type { Suscripcion } from "@bitacora/shared";
import { supabase } from "../supabase";
import { env } from "../env";
import type { RequestConEmpresa } from "../empresa";
import { ah } from "../asyncHandler";
import { requiereAccion } from "../permisos";
import { crearClienteFlow, linkRegistroTarjeta, consultarRegistroTarjeta, consultarCliente, suscribirAPlan, cancelarSuscripcionFlow } from "../flow";
import { cambiarPlanEmpresa } from "../planes";

export const suscripcionRouter = Router();

// El Plan de Flow (monto/ciclo/trial) se crea a mano en su panel — cada
// tier de Bitácora (Básico/Pro) apunta a un Plan de Flow distinto porque
// cobran montos distintos. Si un tier todavía no tiene Plan configurado
// (ej. Pro, mientras no se defina su precio), no hay forma de cobrarlo.
function resolverFlowPlanId(plan: "basico" | "pro"): string | null {
  return plan === "basico" ? env.FLOW_PLAN_ID_BASICO : env.FLOW_PLAN_ID_PRO;
}

async function obtenerOCrearSuscripcion(empresaId: string) {
  const { data: existente } = await supabase.from("suscripciones").select("*").eq("empresa_id", empresaId).maybeSingle();
  if (existente) return existente;
  const { data: creada, error } = await supabase.from("suscripciones").insert({ empresa_id: empresaId }).select().single();
  if (error) throw new Error(error.message);
  return creada;
}

// Flow, al volver de registrar la tarjeta, NO agrega ?token= a nuestro
// url_return (confirmado contra el sandbox real — /tarjeta/confirmar de
// abajo asumía que sí, y en la práctica nunca se llama). Por eso acá,
// cada vez que se consulta la suscripción, si hay un customer sin tarjeta
// todavía registrada, preguntamos directo a Flow (customer/get) — mismo
// patrón de "lazy check en una ruta frecuente" que revisarCotizacionesPorVencer.
async function revisarRegistroTarjetaPendiente(suscripcion: Suscripcion, usuarioId: string) {
  if (!suscripcion.flow_customer_id || suscripcion.tarjeta_ultimos4) return suscripcion;
  try {
    const cliente = await consultarCliente(suscripcion.flow_customer_id);
    if (!cliente.last4CardDigits) return suscripcion;

    const cambios: Partial<Suscripcion> = {
      tarjeta_ultimos4: cliente.last4CardDigits,
      tarjeta_marca: cliente.creditCardType ?? null,
      plan_pendiente: null,
      actualizado_en: new Date().toISOString(),
    };
    const planPendiente = suscripcion.plan_pendiente;
    if (!suscripcion.flow_subscription_id && planPendiente) {
      const flowPlanId = resolverFlowPlanId(planPendiente);
      if (flowPlanId) {
        const suscripcionFlow = await suscribirAPlan(suscripcion.flow_customer_id, flowPlanId);
        cambios.flow_subscription_id = suscripcionFlow.subscriptionId;
        cambios.estado = "trial";
      } else {
        console.error(`No se pudo suscribir: FLOW_PLAN_ID para "${planPendiente}" no está configurado`);
      }
    }
    const { data } = await supabase.from("suscripciones").update(cambios).eq("empresa_id", suscripcion.empresa_id).select().single();

    if (planPendiente && cambios.flow_subscription_id) {
      await cambiarPlanEmpresa(suscripcion.empresa_id, planPendiente, { tipo: "empresa", usuarioId });
    }

    return data ?? suscripcion;
  } catch (err) {
    console.error("Error revisando registro de tarjeta pendiente en Flow:", err);
    return suscripcion;
  }
}

suscripcionRouter.get(
  "/",
  ah<RequestConEmpresa>(async (req, res) => {
    let suscripcion = await obtenerOCrearSuscripcion(req.empresaId!);
    suscripcion = await revisarRegistroTarjetaPendiente(suscripcion, req.userId!);
    const { data: cobros } = await supabase
      .from("suscripcion_cobros")
      .select("*")
      .eq("empresa_id", req.empresaId!)
      .order("creado_en", { ascending: false })
      .limit(24);
    res.json({ suscripcion, cobros: cobros ?? [] });
  })
);

// Genera el link de Flow donde el admin ingresa su tarjeta — nunca pasa
// por nuestro backend. Si la empresa todavía no tiene customer en Flow,
// lo crea primero.
suscripcionRouter.post(
  "/tarjeta",
  requiereAccion("gestionar_plan"),
  ah<RequestConEmpresa>(async (req, res) => {
    const { plan } = req.body ?? {};
    const planPendiente: "basico" | "pro" | null = plan === "basico" || plan === "pro" ? plan : null;
    if (plan !== undefined && !planPendiente) {
      res.status(400).json({ error: "plan debe ser 'basico' o 'pro'" });
      return;
    }
    if (planPendiente && !resolverFlowPlanId(planPendiente)) {
      res.status(400).json({ error: `El plan "${planPendiente}" todavía no está disponible para contratar` });
      return;
    }

    const suscripcion = await obtenerOCrearSuscripcion(req.empresaId!);
    const { data: empresa } = await supabase.from("empresas").select("nombre").eq("id", req.empresaId!).single();
    await supabase.from("suscripciones").update({ plan_pendiente: planPendiente }).eq("empresa_id", req.empresaId!);

    let customerId = suscripcion.flow_customer_id as string | null;
    try {
      if (!customerId) {
        const { data: authUser } = await supabase.auth.admin.getUserById(req.userId!);
        const correo = authUser?.user?.email;
        if (!correo) {
          res.status(400).json({ error: "No pudimos determinar tu correo de acceso" });
          return;
        }
        const cliente = await crearClienteFlow(correo, empresa?.nombre ?? "Empresa", req.empresaId!);
        customerId = cliente.customerId;
        await supabase.from("suscripciones").update({ flow_customer_id: customerId }).eq("empresa_id", req.empresaId!);
      }

      // Flow/Transbank agregan ?token=... al volver — la página del
      // dashboard lo detecta y llama a POST /tarjeta/confirmar (autenticado
      // normal, no hace falta pasar nada por la URL más que el token).
      const urlRetorno = `${env.WEB_URL}/dashboard/configuracion/plan`;
      const registro = await linkRegistroTarjeta(customerId, urlRetorno);
      res.json({ url: registro.url + (registro.url.includes("?") ? "&" : "?") + `token=${registro.token}` });
    } catch (err) {
      console.error("Error iniciando registro de tarjeta en Flow:", err);
      res.status(502).json({ error: "No pudimos conectar con la pasarela de pago — intenta de nuevo en un momento" });
    }
  })
);

// La página de Configuración > Plan llama esto al volver de Flow con
// ?token=... en la URL.
suscripcionRouter.post(
  "/tarjeta/confirmar",
  requiereAccion("gestionar_plan"),
  ah<RequestConEmpresa>(async (req, res) => {
    const { token } = req.body ?? {};
    if (typeof token !== "string" || !token) {
      res.status(400).json({ error: "Falta token" });
      return;
    }
    const suscripcion = await obtenerOCrearSuscripcion(req.empresaId!);

    let estado: Awaited<ReturnType<typeof consultarRegistroTarjeta>>;
    try {
      estado = await consultarRegistroTarjeta(token);
    } catch (err) {
      res.status(400).json({ error: "No pudimos verificar ese token con Flow" });
      return;
    }

    // El token confirma la tarjeta de UN customerId puntual — verificamos
    // que sea el de esta misma empresa antes de guardar nada (si no
    // coincidiera, alguien está intentando confirmar con el token de otra
    // empresa — no debería poder pasar, pero se valida igual).
    if (!suscripcion.flow_customer_id || estado.customerId !== suscripcion.flow_customer_id) {
      res.status(403).json({ error: "Este token no corresponde a tu empresa" });
      return;
    }
    // NOTA: status "1" = registro exitoso es la lectura más plausible de
    // customer/getRegisterStatus (un registro pendiente da status "0",
    // confirmado en vivo) — falta confirmar el valor exacto de éxito
    // completando un registro real hasta el final.
    if (estado.status !== "1") {
      res.status(400).json({ error: "El registro de la tarjeta no se completó" });
      return;
    }

    const cambios: Partial<Suscripcion> = {
      tarjeta_ultimos4: estado.last4CardDigits ?? null,
      tarjeta_marca: estado.creditCardType ?? null,
      plan_pendiente: null,
      actualizado_en: new Date().toISOString(),
    };
    const planPendiente = suscripcion.plan_pendiente;

    // Primera vez que se registra tarjeta para esta empresa: suscribe al
    // Plan del tier elegido (Flow aplica el período de prueba configurado
    // en ese Plan si corresponde — no se pasa por acá).
    if (!suscripcion.flow_subscription_id) {
      const flowPlanId = planPendiente ? resolverFlowPlanId(planPendiente) : null;
      if (!flowPlanId) {
        res.status(500).json({ error: "No hay un plan pendiente válido para suscribir" });
        return;
      }
      const suscripcionFlow = await suscribirAPlan(suscripcion.flow_customer_id, flowPlanId);
      cambios.flow_subscription_id = suscripcionFlow.subscriptionId;
      cambios.estado = "trial";
    }

    const { data, error } = await supabase.from("suscripciones").update(cambios).eq("empresa_id", req.empresaId!).select().single();
    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    if (planPendiente && cambios.flow_subscription_id) {
      await cambiarPlanEmpresa(req.empresaId!, planPendiente, { tipo: "empresa", usuarioId: req.userId! });
    }
    res.json(data);
  })
);

suscripcionRouter.post(
  "/cancelar",
  requiereAccion("gestionar_plan"),
  ah<RequestConEmpresa>(async (req, res) => {
    const suscripcion = await obtenerOCrearSuscripcion(req.empresaId!);
    if (!suscripcion.flow_subscription_id) {
      res.status(400).json({ error: "No tienes una suscripción activa para cancelar" });
      return;
    }
    try {
      await cancelarSuscripcionFlow(suscripcion.flow_subscription_id);
    } catch (err) {
      console.error("Error cancelando suscripción en Flow:", err);
      res.status(502).json({ error: "No pudimos conectar con la pasarela de pago — intenta de nuevo en un momento" });
      return;
    }
    const { data, error } = await supabase
      .from("suscripciones")
      .update({ estado: "cancelada", cancelada_en: new Date().toISOString() })
      .eq("empresa_id", req.empresaId!)
      .select()
      .single();
    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    res.json(data);
  })
);
