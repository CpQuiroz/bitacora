// ============================================================
// BITÁCORA — Portal de Cliente. Sin requiereAuth/requiereEmpresa a
// propósito (identidad externa, sin cuenta de Bitácora) — la
// autenticación acá es requierePortal (portalAuth.ts), y cada consulta
// de datos filtra por cliente_id, nunca por empresa_id a secas.
// ============================================================
import crypto from "node:crypto";
import { Router } from "express";
import type { EntidadPortal } from "@bitacora/shared";
import { formatearRut, validarRut } from "@bitacora/shared";
import { supabase } from "../supabase";
import { env } from "../env";
import { enviarConReintento } from "../email";
import { notificarGerencia } from "../notificar";
import { crearTokenPortal, requierePortal, type RequestConPortal } from "../portalAuth";
import { armarDatosPdf } from "./trabajos";
import { generarPdfOS } from "../generarPdfOS";
import { armarDatosPdfCotizacion } from "./cotizaciones";
import { generarPdfCotizacion } from "../generarPdfCotizacion";
import { ah } from "../asyncHandler";

export const portalRouter = Router();

function hashCodigo(codigo: string): string {
  return crypto.createHash("sha256").update(codigo).digest("hex");
}

async function buscarClientesPorRut(rut: string, empresaId?: string) {
  let query = supabase
    .from("clientes")
    .select("id, empresa_id, nombre, correo, empresa:empresas(nombre)")
    .eq("rut", rut)
    .eq("activo", true)
    .not("correo", "is", null);
  if (empresaId) query = query.eq("empresa_id", empresaId);
  const { data } = await query;
  return data ?? [];
}

// ---------- Acceso ----------

portalRouter.get(
  "/:id",
  ah(async (req, res) => {
    const { data: acceso } = await supabase.from("portal_accesos").select("*").eq("id", req.params.id).maybeSingle();
    if (!acceso || new Date(acceso.expira_en) < new Date()) {
      res.status(404).json({ error: "Este link ya no es válido — pídenos uno nuevo" });
      return;
    }
    const token = crearTokenPortal(acceso.cliente_id, acceso.empresa_id);
    res.json({ token, entidad_tipo: acceso.entidad_tipo, entidad_id: acceso.entidad_id });
  })
);

portalRouter.post(
  "/solicitar-codigo",
  ah(async (req, res) => {
    const { rut, empresa_id } = req.body ?? {};
    if (typeof rut !== "string" || !validarRut(rut)) {
      res.status(400).json({ error: "RUT inválido" });
      return;
    }
    const clientes = await buscarClientesPorRut(formatearRut(rut), typeof empresa_id === "string" ? empresa_id : undefined);

    if (clientes.length === 0) {
      // Respuesta genérica a propósito — no revela si el RUT existe.
      res.json({ ok: true });
      return;
    }
    if (clientes.length > 1) {
      res.json({
        ok: true,
        empresas: clientes.map((c) => ({ id: c.empresa_id, nombre: (c as unknown as { empresa: { nombre: string } | null }).empresa?.nombre ?? "" })),
      });
      return;
    }

    const cliente = clientes[0];
    const codigo = String(crypto.randomInt(100000, 999999));
    await supabase.from("portal_codigos").insert({
      empresa_id: cliente.empresa_id,
      cliente_id: cliente.id,
      codigo_hash: hashCodigo(codigo),
      expira_en: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    });

    try {
      await enviarConReintento(
        {
          from: env.RESEND_FROM_EMAIL,
          to: cliente.correo!,
          subject: "Tu código de acceso",
          html: `<div style="font-family:sans-serif;"><p>Tu código para entrar al portal: <strong style="font-size:20px;">${codigo}</strong></p><p>Vence en 10 minutos.</p></div>`,
        },
        "el código de acceso al portal"
      );
    } catch (err) {
      console.error("Error mandando código de portal:", err);
    }
    res.json({ ok: true });
  })
);

portalRouter.post(
  "/verificar-codigo",
  ah(async (req, res) => {
    const { rut, codigo, empresa_id } = req.body ?? {};
    if (typeof rut !== "string" || !validarRut(rut) || typeof codigo !== "string") {
      res.status(400).json({ error: "Datos inválidos" });
      return;
    }
    const clientes = await buscarClientesPorRut(formatearRut(rut), typeof empresa_id === "string" ? empresa_id : undefined);
    if (clientes.length !== 1) {
      res.status(400).json({ error: clientes.length > 1 ? "Especifica con qué empresa quieres entrar" : "Código inválido" });
      return;
    }
    const cliente = clientes[0];

    const { data: fila } = await supabase
      .from("portal_codigos")
      .select("*")
      .eq("cliente_id", cliente.id)
      .eq("codigo_hash", hashCodigo(codigo))
      .is("usado_en", null)
      .gte("expira_en", new Date().toISOString())
      .order("creado_en", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!fila) {
      res.status(400).json({ error: "Código inválido o vencido" });
      return;
    }

    await supabase.from("portal_codigos").update({ usado_en: new Date().toISOString() }).eq("id", fila.id);
    const token = crearTokenPortal(cliente.id, cliente.empresa_id);
    res.json({ token });
  })
);

// ---------- Datos (requierePortal) ----------

portalRouter.get(
  "/datos/visitas",
  requierePortal,
  ah<RequestConPortal>(async (req, res) => {
    const hoy = new Date().toISOString().slice(0, 10);
    const { data, error } = await supabase
      .from("trabajos")
      .select("id, cliente, fecha, hora_programada, descripcion, estado")
      .eq("cliente_id", req.clienteId!)
      .neq("estado", "cancelado")
      .gte("fecha", hoy)
      .order("fecha");
    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    res.json(data);
  })
);

portalRouter.get(
  "/datos/ordenes",
  requierePortal,
  ah<RequestConPortal>(async (req, res) => {
    const { data, error } = await supabase
      .from("trabajos")
      .select("id, cliente, fecha, descripcion, estado, orden:ordenes_servicio(folio, estado_os)")
      .eq("cliente_id", req.clienteId!)
      .order("fecha", { ascending: false });
    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    const normalizado = (data ?? []).map((t) => ({ ...t, orden: Array.isArray(t.orden) ? t.orden[0] ?? null : t.orden }));
    res.json(normalizado);
  })
);

portalRouter.get(
  "/datos/ordenes/:id",
  requierePortal,
  ah<RequestConPortal>(async (req, res) => {
    const { data, error } = await supabase
      .from("trabajos")
      .select("id, cliente, fecha, descripcion, estado, cliente_id, orden:ordenes_servicio(folio, estado_os, observaciones_cierre, finalizada_en)")
      .eq("id", req.params.id)
      .maybeSingle();
    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    if (!data || data.cliente_id !== req.clienteId) {
      res.status(404).json({ error: "No encontrada" });
      return;
    }
    res.json({ ...data, orden: Array.isArray(data.orden) ? data.orden[0] ?? null : data.orden });
  })
);

portalRouter.get(
  "/datos/ordenes/:id/pdf",
  requierePortal,
  ah<RequestConPortal>(async (req, res) => {
    const { data: trabajo } = await supabase.from("trabajos").select("cliente_id").eq("id", req.params.id).maybeSingle();
    if (!trabajo || trabajo.cliente_id !== req.clienteId) {
      res.status(404).json({ error: "No encontrado" });
      return;
    }
    const datos = await armarDatosPdf(req.empresaId!, req.params.id);
    if (!datos) {
      res.status(404).json({ error: "No encontrado" });
      return;
    }
    const pdf = await generarPdfOS(datos);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="${datos.folioTexto}.pdf"`);
    res.send(pdf);
  })
);

portalRouter.get(
  "/datos/cotizaciones/:id",
  requierePortal,
  ah<RequestConPortal>(async (req, res) => {
    const { data, error } = await supabase
      .from("presupuestos")
      .select("*, items:presupuesto_items(*)")
      .eq("id", req.params.id)
      .maybeSingle();
    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    if (!data || data.cliente_id !== req.clienteId) {
      res.status(404).json({ error: "No encontrada" });
      return;
    }
    res.json(data);
  })
);

portalRouter.get(
  "/datos/cotizaciones",
  requierePortal,
  ah<RequestConPortal>(async (req, res) => {
    const { data, error } = await supabase
      .from("presupuestos")
      .select("id, numero, descripcion, monto, fecha, fecha_vencimiento, estado")
      .eq("cliente_id", req.clienteId!)
      .order("numero", { ascending: false });
    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    res.json(data);
  })
);

portalRouter.get(
  "/datos/cotizaciones/:id/pdf",
  requierePortal,
  ah<RequestConPortal>(async (req, res) => {
    const { data: cotizacion } = await supabase.from("presupuestos").select("cliente_id").eq("id", req.params.id).maybeSingle();
    if (!cotizacion || cotizacion.cliente_id !== req.clienteId) {
      res.status(404).json({ error: "No encontrada" });
      return;
    }
    const datos = await armarDatosPdfCotizacion(req.empresaId!, req.params.id);
    if (!datos) {
      res.status(404).json({ error: "No encontrada" });
      return;
    }
    const pdf = await generarPdfCotizacion(datos);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="${datos.numeroTexto}.pdf"`);
    res.send(pdf);
  })
);

async function resolverCotizacionDelCliente(clienteId: string, cotizacionId: string) {
  const { data } = await supabase.from("presupuestos").select("*").eq("id", cotizacionId).maybeSingle();
  if (!data || data.cliente_id !== clienteId) return null;
  return data;
}

portalRouter.post(
  "/datos/cotizaciones/:id/aprobar",
  requierePortal,
  ah<RequestConPortal>(async (req, res) => {
    const cotizacion = await resolverCotizacionDelCliente(req.clienteId!, req.params.id);
    if (!cotizacion) {
      res.status(404).json({ error: "No encontrada" });
      return;
    }
    if (cotizacion.estado !== "enviado") {
      res.status(400).json({ error: "Esta cotización ya no está pendiente de aprobación" });
      return;
    }
    await supabase.from("presupuestos").update({ estado: "aprobado" }).eq("id", req.params.id);
    await notificarGerencia(req.empresaId!, "cotizacion_aprobada", {
      cuerpo: `Cotización N° ${cotizacion.numero} aprobada por el cliente — lista para convertir a OS.`,
      entidadTipo: "cotizacion",
      entidadId: req.params.id,
    }).catch(() => {});
    res.json({ ok: true });
  })
);

portalRouter.post(
  "/datos/cotizaciones/:id/rechazar",
  requierePortal,
  ah<RequestConPortal>(async (req, res) => {
    const cotizacion = await resolverCotizacionDelCliente(req.clienteId!, req.params.id);
    if (!cotizacion) {
      res.status(404).json({ error: "No encontrada" });
      return;
    }
    if (cotizacion.estado !== "enviado") {
      res.status(400).json({ error: "Esta cotización ya no está pendiente de aprobación" });
      return;
    }
    await supabase.from("presupuestos").update({ estado: "rechazado" }).eq("id", req.params.id);
    res.json({ ok: true });
  })
);

// ---------- Citas (Agenda Pro) ----------

async function resolverTareaDelCliente(clienteId: string, tareaId: string) {
  const { data } = await supabase.from("tareas").select("*").eq("id", tareaId).maybeSingle();
  if (!data || data.cliente_id !== clienteId) return null;
  return data;
}

portalRouter.get(
  "/datos/citas",
  requierePortal,
  ah<RequestConPortal>(async (req, res) => {
    const { data, error } = await supabase
      .from("tareas")
      .select("id, titulo, descripcion, fecha, hora, estado")
      .eq("cliente_id", req.clienteId!)
      .order("fecha", { ascending: false });
    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    res.json(data);
  })
);

portalRouter.get(
  "/datos/citas/:id",
  requierePortal,
  ah<RequestConPortal>(async (req, res) => {
    const tarea = await resolverTareaDelCliente(req.clienteId!, req.params.id);
    if (!tarea) {
      res.status(404).json({ error: "No encontrada" });
      return;
    }
    res.json(tarea);
  })
);

portalRouter.post(
  "/datos/citas/:id/confirmar",
  requierePortal,
  ah<RequestConPortal>(async (req, res) => {
    const tarea = await resolverTareaDelCliente(req.clienteId!, req.params.id);
    if (!tarea) {
      res.status(404).json({ error: "No encontrada" });
      return;
    }
    if (tarea.estado !== "pendiente") {
      res.status(400).json({ error: "Esta cita ya no está pendiente de confirmación" });
      return;
    }
    await supabase.from("tareas").update({ estado: "confirmada", actualizado_en: new Date().toISOString() }).eq("id", req.params.id);
    await notificarGerencia(req.empresaId!, "cita_confirmada", {
      cuerpo: `${tarea.titulo} — ${tarea.fecha} — confirmada por el cliente.`,
      entidadTipo: "tarea",
      entidadId: req.params.id,
    }).catch(() => {});
    res.json({ ok: true });
  })
);

portalRouter.post(
  "/datos/citas/:id/cancelar",
  requierePortal,
  ah<RequestConPortal>(async (req, res) => {
    const tarea = await resolverTareaDelCliente(req.clienteId!, req.params.id);
    if (!tarea) {
      res.status(404).json({ error: "No encontrada" });
      return;
    }
    if (tarea.estado !== "pendiente" && tarea.estado !== "confirmada") {
      res.status(400).json({ error: "Esta cita ya no se puede cancelar" });
      return;
    }
    await supabase.from("tareas").update({ estado: "cancelada", actualizado_en: new Date().toISOString() }).eq("id", req.params.id);
    await notificarGerencia(req.empresaId!, "cita_cancelada", {
      cuerpo: `${tarea.titulo} — ${tarea.fecha} — cancelada por el cliente.`,
      entidadTipo: "tarea",
      entidadId: req.params.id,
    }).catch(() => {});
    res.json({ ok: true });
  })
);

portalRouter.get(
  "/datos/cobros",
  requierePortal,
  ah<RequestConPortal>(async (req, res) => {
    const { data, error } = await supabase
      .from("facturas")
      .select("id, monto, fecha_emision, fecha_vencimiento, fecha_pago, estado")
      .eq("cliente_id", req.clienteId!)
      .order("fecha_emision", { ascending: false });
    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    res.json(data);
  })
);

export type { EntidadPortal };
