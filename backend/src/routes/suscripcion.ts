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
import { requiereRol } from "../permisos";
import { crearClienteFlow, linkRegistroTarjeta, consultarRegistroTarjeta, suscribirAPlan, cancelarSuscripcionFlow } from "../flow";

export const suscripcionRouter = Router();

async function obtenerOCrearSuscripcion(empresaId: string) {
  const { data: existente } = await supabase.from("suscripciones").select("*").eq("empresa_id", empresaId).maybeSingle();
  if (existente) return existente;
  const { data: creada, error } = await supabase.from("suscripciones").insert({ empresa_id: empresaId }).select().single();
  if (error) throw new Error(error.message);
  return creada;
}

suscripcionRouter.get(
  "/",
  ah<RequestConEmpresa>(async (req, res) => {
    const suscripcion = await obtenerOCrearSuscripcion(req.empresaId!);
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
  requiereRol("admin"),
  ah<RequestConEmpresa>(async (req, res) => {
    const suscripcion = await obtenerOCrearSuscripcion(req.empresaId!);
    const { data: empresa } = await supabase.from("empresas").select("nombre").eq("id", req.empresaId!).single();

    let customerId = suscripcion.flow_customer_id as string | null;
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
  })
);

// La página de Configuración > Plan llama esto al volver de Flow con
// ?token=... en la URL.
suscripcionRouter.post(
  "/tarjeta/confirmar",
  requiereRol("admin"),
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
      actualizado_en: new Date().toISOString(),
    };

    // Primera vez que se registra tarjeta para esta empresa: suscribe al
    // Plan mensual (Flow aplica el período de prueba configurado en el
    // Plan si corresponde — no se pasa por acá).
    if (!suscripcion.flow_subscription_id) {
      if (!env.FLOW_PLAN_ID) {
        res.status(500).json({ error: "FLOW_PLAN_ID no está configurado" });
        return;
      }
      const suscripcionFlow = await suscribirAPlan(suscripcion.flow_customer_id, env.FLOW_PLAN_ID);
      cambios.flow_subscription_id = suscripcionFlow.subscriptionId;
      cambios.estado = "trial";
    }

    const { data, error } = await supabase.from("suscripciones").update(cambios).eq("empresa_id", req.empresaId!).select().single();
    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    res.json(data);
  })
);

suscripcionRouter.post(
  "/cancelar",
  requiereRol("admin"),
  ah<RequestConEmpresa>(async (req, res) => {
    const suscripcion = await obtenerOCrearSuscripcion(req.empresaId!);
    if (!suscripcion.flow_subscription_id) {
      res.status(400).json({ error: "No tienes una suscripción activa para cancelar" });
      return;
    }
    await cancelarSuscripcionFlow(suscripcion.flow_subscription_id);
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
