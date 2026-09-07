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
import { calcularEstadoCancelacion, obtenerOCrearAgendaProConfig } from "../agendaPro";
import { datosPersonalesDeCliente } from "../exportarDatosPersonales";
import { armarDatosPdf } from "./trabajos";
import { generarPdfOS } from "../generarPdfOS";
import { armarDatosPdfCotizacion } from "./cotizaciones";
import { generarPdfCotizacion } from "../generarPdfCotizacion";
import { ah } from "../asyncHandler";
import { limitarPortalAcceso } from "../rateLimiters";

export const portalRouter = Router();

// ---------- Secciones visibles ----------
// Cada empresa decide qué ve el cliente en el portal (migración 93). El
// default de las columnas es TRUE, así que una empresa que nunca tocó
// esto sigue mostrando todo.
type SeccionPortal = "ordenes" | "citas" | "cotizaciones" | "cobros";
const COLUMNA_SECCION: Record<SeccionPortal, string> = {
  ordenes: "portal_muestra_ordenes",
  citas: "portal_muestra_citas",
  cotizaciones: "portal_muestra_cotizaciones",
  cobros: "portal_muestra_cobros",
};

async function seccionesDeEmpresa(empresaId: string): Promise<Record<SeccionPortal, boolean>> {
  const { data } = await supabase
    .from("empresas")
    .select("portal_muestra_ordenes, portal_muestra_citas, portal_muestra_cotizaciones, portal_muestra_cobros")
    .eq("id", empresaId)
    .maybeSingle();
  return {
    ordenes: data?.portal_muestra_ordenes ?? true,
    citas: data?.portal_muestra_citas ?? true,
    cotizaciones: data?.portal_muestra_cotizaciones ?? true,
    cobros: data?.portal_muestra_cobros ?? true,
  };
}

// Middleware: bloquea la sección si la empresa la tiene apagada.
function requiereSeccion(seccion: SeccionPortal) {
  return ah<RequestConPortal>(async (req, res, next) => {
    const { data } = await supabase
      .from("empresas")
      .select(COLUMNA_SECCION[seccion])
      .eq("id", req.empresaId!)
      .maybeSingle();
    const visible = (data as Record<string, boolean> | null)?.[COLUMNA_SECCION[seccion]] ?? true;
    if (!visible) {
      res.status(403).json({ error: "Esta sección no está disponible en el portal" });
      return;
    }
    next();
  });
}

portalRouter.get(
  "/config",
  requierePortal,
  ah<RequestConPortal>(async (req, res) => {
    res.json(await seccionesDeEmpresa(req.empresaId!));
  })
);

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

// El id del link de acceso es un UUID. La restricción de patrón evita
// que esta ruta de un solo segmento se coma a `/mis-datos` (y a
// cualquier GET de un solo segmento que se agregue después), que de
// otro modo entraría acá con id="mis-datos" y devolvería 404.
portalRouter.get(
  "/:id([0-9a-fA-F-]{36})",
  limitarPortalAcceso,
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
  limitarPortalAcceso,
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
  limitarPortalAcceso,
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

// Ley 21.719 — derecho de acceso: el cliente descarga todos sus datos
// personales en un JSON.
portalRouter.get(
  "/mis-datos",
  requierePortal,
  ah<RequestConPortal>(async (req, res) => {
    const datos = await datosPersonalesDeCliente(req.clienteId!);
    res.setHeader("Content-Disposition", `attachment; filename="mis-datos-${new Date().toISOString().slice(0, 10)}.json"`);
    res.json(datos);
  })
);

// Ley 21.719 — el Portal es de solo lectura: el cliente pide una
// corrección de sus datos y le llega al admin como notificación.
portalRouter.post(
  "/solicitar-correccion",
  requierePortal,
  ah<RequestConPortal>(async (req, res) => {
    const mensaje = typeof req.body?.mensaje === "string" ? req.body.mensaje.trim() : "";
    if (mensaje.length < 5) {
      res.status(400).json({ error: "Escribe qué dato hay que corregir." });
      return;
    }
    const { data: cli } = await supabase.from("clientes").select("nombre").eq("id", req.clienteId!).maybeSingle();
    await notificarGerencia(req.empresaId!, "solicitud_correccion_datos", {
      cuerpo: `${cli?.nombre ?? "Un cliente"} pidió corregir sus datos: "${mensaje.slice(0, 500)}"`,
    });
    res.status(201).json({ ok: true });
  })
);

portalRouter.get(
  "/datos/visitas",
  requierePortal,
  requiereSeccion("ordenes"),
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
  requiereSeccion("ordenes"),
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
  requiereSeccion("ordenes"),
  ah<RequestConPortal>(async (req, res) => {
    const { data, error } = await supabase
      .from("trabajos")
      .select("id, cliente, fecha, descripcion, estado, cliente_id, orden:ordenes_servicio(folio, estado_os, observaciones_cierre, finalizada_en)")
      .eq("id", req.params.id)
      .eq("cliente_id", req.clienteId!)
      .maybeSingle();
    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    if (!data) {
      res.status(404).json({ error: "No encontrada" });
      return;
    }
    res.json({ ...data, orden: Array.isArray(data.orden) ? data.orden[0] ?? null : data.orden });
  })
);

portalRouter.get(
  "/datos/ordenes/:id/pdf",
  requierePortal,
  requiereSeccion("ordenes"),
  ah<RequestConPortal>(async (req, res) => {
    const { data: trabajo } = await supabase
      .from("trabajos")
      .select("cliente_id")
      .eq("id", req.params.id)
      .eq("cliente_id", req.clienteId!)
      .maybeSingle();
    if (!trabajo) {
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
  requiereSeccion("cotizaciones"),
  ah<RequestConPortal>(async (req, res) => {
    const { data, error } = await supabase
      .from("presupuestos")
      .select(
        "id, numero, descripcion, monto, subtotal, iva, fecha, fecha_vencimiento, estado, items:presupuesto_items(descripcion, cantidad, precio_unitario)"
      )
      .eq("id", req.params.id)
      .eq("cliente_id", req.clienteId!)
      .maybeSingle();
    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    if (!data) {
      res.status(404).json({ error: "No encontrada" });
      return;
    }
    res.json(data);
  })
);

portalRouter.get(
  "/datos/cotizaciones",
  requierePortal,
  requiereSeccion("cotizaciones"),
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
  requiereSeccion("cotizaciones"),
  ah<RequestConPortal>(async (req, res) => {
    const { data: cotizacion } = await supabase
      .from("presupuestos")
      .select("cliente_id")
      .eq("id", req.params.id)
      .eq("cliente_id", req.clienteId!)
      .maybeSingle();
    if (!cotizacion) {
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
  const { data } = await supabase
    .from("presupuestos")
    .select("*")
    .eq("id", cotizacionId)
    .eq("cliente_id", clienteId)
    .maybeSingle();
  if (!data || data.cliente_id !== clienteId) return null;
  return data;
}

portalRouter.post(
  "/datos/cotizaciones/:id/aprobar",
  requierePortal,
  requiereSeccion("cotizaciones"),
  ah<RequestConPortal>(async (req, res) => {
    const cotizacion = await resolverCotizacionDelCliente(req.clienteId!, req.params.id);
    if (!cotizacion) {
      res.status(404).json({ error: "No encontrada" });
      return;
    }
    if (cotizacion.estado !== "enviado") {
      // 409: conflicto de estado permanente, no error de input.
      res.status(409).json({ error: "Esta cotización ya no está pendiente de aprobación" });
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
  requiereSeccion("cotizaciones"),
  ah<RequestConPortal>(async (req, res) => {
    const cotizacion = await resolverCotizacionDelCliente(req.clienteId!, req.params.id);
    if (!cotizacion) {
      res.status(404).json({ error: "No encontrada" });
      return;
    }
    if (cotizacion.estado !== "enviado") {
      // 409: conflicto de estado permanente, no error de input.
      res.status(409).json({ error: "Esta cotización ya no está pendiente de aprobación" });
      return;
    }
    await supabase.from("presupuestos").update({ estado: "rechazado" }).eq("id", req.params.id);
    res.json({ ok: true });
  })
);

// ---------- Citas (Agenda Pro) ----------

async function resolverTareaDelCliente(clienteId: string, tareaId: string) {
  const { data } = await supabase
    .from("tareas")
    .select("*")
    .eq("id", tareaId)
    .eq("cliente_id", clienteId)
    .maybeSingle();
  if (!data || data.cliente_id !== clienteId) return null;
  return data;
}

portalRouter.get(
  "/datos/citas",
  requierePortal,
  requiereSeccion("citas"),
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
  requiereSeccion("citas"),
  ah<RequestConPortal>(async (req, res) => {
    const tarea = await resolverTareaDelCliente(req.clienteId!, req.params.id);
    if (!tarea) {
      res.status(404).json({ error: "No encontrada" });
      return;
    }
    // Si la cita tiene paquete y todavía se puede cancelar, le
    // avisamos al cliente de antemano si cancelar AHORA le
    // descontaría la sesión igual — así el frontend puede mostrar la
    // advertencia antes de que confirme, no después.
    let advertenciaCancelacion: { ventana_horas: number; descuenta_si_cancela_ahora: boolean } | null = null;
    if (tarea.paquete_id && (tarea.estado === "pendiente" || tarea.estado === "confirmada")) {
      const config = await obtenerOCrearAgendaProConfig(req.empresaId!);
      advertenciaCancelacion = {
        ventana_horas: config.ventana_cancelacion_horas,
        descuenta_si_cancela_ahora: calcularEstadoCancelacion(tarea, config.ventana_cancelacion_horas) === "no_asistio",
      };
    }
    // Whitelist explícita: `resolverTareaDelCliente` trae la fila
    // completa porque `calcularEstadoCancelacion` la necesita, pero al
    // cliente solo le devolvemos lo suyo. Nunca `descripcion` (nota
    // interna), `precio`, `adicionales`, `responsable_id`, `paquete_id`,
    // `sesiones_consumidas`, `origen`, `trabajo_id`, `servicio_id`.
    res.json({
      id: tarea.id,
      titulo: tarea.titulo,
      fecha: tarea.fecha,
      hora: tarea.hora,
      estado: tarea.estado,
      duracion_min: tarea.duracion_min,
      nota_cliente: tarea.nota_cliente,
      advertencia_cancelacion: advertenciaCancelacion,
    });
  })
);

portalRouter.post(
  "/datos/citas/:id/confirmar",
  requierePortal,
  requiereSeccion("citas"),
  ah<RequestConPortal>(async (req, res) => {
    const tarea = await resolverTareaDelCliente(req.clienteId!, req.params.id);
    if (!tarea) {
      res.status(404).json({ error: "No encontrada" });
      return;
    }
    if (tarea.estado !== "pendiente") {
      // 409: conflicto de estado permanente, no error de input.
      res.status(409).json({ error: "Esta cita ya no está pendiente de confirmación" });
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
  requiereSeccion("citas"),
  ah<RequestConPortal>(async (req, res) => {
    const tarea = await resolverTareaDelCliente(req.clienteId!, req.params.id);
    if (!tarea) {
      res.status(404).json({ error: "No encontrada" });
      return;
    }
    if (tarea.estado !== "pendiente" && tarea.estado !== "confirmada") {
      // 409: conflicto de estado permanente, no error de input.
      res.status(409).json({ error: "Esta cita ya no se puede cancelar" });
      return;
    }

    let nuevoEstado: "cancelada" | "no_asistio" | "cancelada_anticipada" = "cancelada";
    if (tarea.paquete_id) {
      const config = await obtenerOCrearAgendaProConfig(req.empresaId!);
      nuevoEstado = calcularEstadoCancelacion(tarea, config.ventana_cancelacion_horas);
    }

    await supabase.from("tareas").update({ estado: nuevoEstado, actualizado_en: new Date().toISOString() }).eq("id", req.params.id);
    const notaSaldo =
      nuevoEstado === "no_asistio"
        ? " (dentro de la ventana de aviso — se descontó del paquete)"
        : nuevoEstado === "cancelada_anticipada"
          ? " (con anticipación — no se descontó del paquete)"
          : "";
    await notificarGerencia(req.empresaId!, "cita_cancelada", {
      cuerpo: `${tarea.titulo} — ${tarea.fecha} — cancelada por el cliente${notaSaldo}.`,
      entidadTipo: "tarea",
      entidadId: req.params.id,
    }).catch(() => {});
    res.json({ ok: true });
  })
);

portalRouter.get(
  "/datos/cobros",
  requierePortal,
  requiereSeccion("cobros"),
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
