import { Router } from "express";
import type { EstadoTarea, Prioridad, Tarea } from "@bitacora/shared";
import { supabase } from "../supabase";
import { notificar } from "../notificar";
import { avisarCitaAgendada, avisarCitaCancelada } from "../agendaProAvisos";
import { calcularEstadoCancelacion, obtenerOCrearAgendaProConfig } from "../agendaPro";
import type { RequestConEmpresa } from "../empresa";
import { ah } from "../asyncHandler";
import { requiereModulo } from "../permisos";

export const tareasRouter = Router();

const PRIORIDADES: Prioridad[] = ["alta", "media", "baja"];
const ESTADOS: EstadoTarea[] = ["pendiente", "confirmada", "completada", "cancelada", "no_asistio", "cancelada_anticipada"];
const HORA_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;

async function clienteExiste(empresaId: string, clienteId: string) {
  const { data } = await supabase.from("clientes").select("id").eq("empresa_id", empresaId).eq("id", clienteId).maybeSingle();
  return Boolean(data);
}

async function usuarioExiste(empresaId: string, usuarioId: string) {
  const { data } = await supabase.from("usuarios").select("id").eq("empresa_id", empresaId).eq("id", usuarioId).maybeSingle();
  return Boolean(data);
}

async function paqueteExiste(empresaId: string, paqueteId: string) {
  const { data } = await supabase.from("paquetes_sesiones").select("id").eq("empresa_id", empresaId).eq("id", paqueteId).maybeSingle();
  return Boolean(data);
}

async function trabajoExiste(empresaId: string, trabajoId: string) {
  const { data } = await supabase.from("trabajos").select("id").eq("empresa_id", empresaId).eq("id", trabajoId).maybeSingle();
  return Boolean(data);
}

tareasRouter.get(
  "/",
  ah<RequestConEmpresa>(async (req, res) => {
    const { desde, hasta, responsable_id, cliente_id, estado } = req.query;

    let query = supabase
      .from("tareas")
      .select("*, cliente:clientes(nombre), responsable:usuarios(nombre)")
      .eq("empresa_id", req.empresaId!)
      .order("fecha", { ascending: true });

    // Un colaborador SIEMPRE ve solo sus propias tareas — igual regla
    // que ordenes-servicio, ignora cualquier responsable_id del cliente.
    if (req.rol === "colaborador") {
      query = query.eq("responsable_id", req.userId!);
    } else if (typeof responsable_id === "string" && responsable_id) {
      query = query.eq("responsable_id", responsable_id);
    }
    if (typeof cliente_id === "string" && cliente_id) query = query.eq("cliente_id", cliente_id);
    if (typeof desde === "string" && desde) query = query.gte("fecha", desde);
    if (typeof hasta === "string" && hasta) query = query.lte("fecha", hasta);
    if (typeof estado === "string" && ESTADOS.includes(estado as EstadoTarea)) {
      query = query.eq("estado", estado as EstadoTarea);
    }

    const { data, error } = await query;
    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    res.json(data);
  })
);

// Una tarea puntual (para el detalle en la app). Un colaborador solo
// puede ver las suyas — igual regla que la lista.
tareasRouter.get(
  "/:id",
  ah<RequestConEmpresa>(async (req, res) => {
    let query = supabase
      .from("tareas")
      .select("*, cliente:clientes(id, nombre, telefono, direccion, lat, lng), responsable:usuarios(nombre)")
      .eq("empresa_id", req.empresaId!)
      .eq("id", req.params.id);
    if (req.rol === "colaborador") query = query.eq("responsable_id", req.userId!);

    const { data, error } = await query.maybeSingle();
    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    if (!data) {
      res.status(404).json({ error: "Tarea no encontrada" });
      return;
    }
    res.json(data);
  })
);

tareasRouter.post(
  "/",
  requiereModulo("agenda"),
  ah<RequestConEmpresa>(async (req, res) => {
    const { titulo, descripcion, fecha, hora, responsable_id, cliente_id, prioridad, paquete_id, sesiones_consumidas, trabajo_id, duracion_min } =
      req.body ?? {};

    if (typeof titulo !== "string" || !titulo.trim()) {
      res.status(400).json({ error: "Falta título" });
      return;
    }
    if (typeof fecha !== "string" || !fecha) {
      res.status(400).json({ error: "Falta fecha (YYYY-MM-DD)" });
      return;
    }
    if (hora !== undefined && hora !== null && hora !== "" && !HORA_REGEX.test(hora)) {
      res.status(400).json({ error: "hora inválida (usa HH:MM)" });
      return;
    }
    if (duracion_min !== undefined && duracion_min !== null && (!Number.isInteger(duracion_min) || duracion_min <= 0)) {
      res.status(400).json({ error: "duracion_min debe ser un entero mayor a 0" });
      return;
    }
    // Un colaborador (típicamente desde la app) solo agenda para sí
    // mismo — no asigna citas a otra gente del equipo.
    const responsableFinal = req.rol === "colaborador" ? req.userId! : responsable_id;
    if (responsableFinal && !(await usuarioExiste(req.empresaId!, responsableFinal))) {
      res.status(400).json({ error: "responsable_id inválido" });
      return;
    }
    if (cliente_id && !(await clienteExiste(req.empresaId!, cliente_id))) {
      res.status(400).json({ error: "cliente_id inválido" });
      return;
    }
    if (paquete_id && !(await paqueteExiste(req.empresaId!, paquete_id))) {
      res.status(400).json({ error: "paquete_id inválido" });
      return;
    }
    if (trabajo_id && !(await trabajoExiste(req.empresaId!, trabajo_id))) {
      res.status(400).json({ error: "trabajo_id inválido" });
      return;
    }
    if (sesiones_consumidas !== undefined && sesiones_consumidas !== null && (!Number.isInteger(sesiones_consumidas) || sesiones_consumidas <= 0)) {
      res.status(400).json({ error: "sesiones_consumidas debe ser un entero mayor a 0" });
      return;
    }
    const prioridadFinal: Prioridad = PRIORIDADES.includes(prioridad) ? prioridad : "media";

    const { data, error } = await supabase
      .from("tareas")
      .insert({
        empresa_id: req.empresaId!,
        titulo: titulo.trim(),
        descripcion: descripcion?.trim() || null,
        fecha,
        hora: hora || null,
        duracion_min: duracion_min || null,
        responsable_id: responsableFinal || null,
        cliente_id: cliente_id || null,
        prioridad: prioridadFinal,
        paquete_id: paquete_id || null,
        sesiones_consumidas: paquete_id ? sesiones_consumidas || 1 : 1,
        // Solo se incluye si viene — así el endpoint sigue funcionando
        // aunque la migración 62 (columna trabajo_id) todavía no esté.
        ...(trabajo_id ? { trabajo_id } : {}),
      })
      .select()
      .single();

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    if (data.responsable_id && data.responsable_id !== req.userId) {
      await notificar(req.empresaId!, data.responsable_id, "tarea_asignada", {
        cuerpo: `${data.titulo} — ${data.fecha}`,
        entidadTipo: "tarea",
        entidadId: data.id,
      });
    }

    // Aviso de cita al cliente (correo y/o WhatsApp según lo que tenga
    // y lo que esté activado) — solo si la empresa tiene Agenda Pro. No
    // bloquea la respuesta si falla (mismo criterio que "técnico en
    // camino" en trabajos.ts).
    if (data.cliente_id) {
      void avisarCitaAgendada(req.empresaId!, data.id, data.fecha, data.hora, data.cliente_id);
    }

    res.status(201).json(data);
  })
);

// Cancelación "automática" de una cita — a diferencia del PATCH
// genérico (que permite fijar cualquier estado a mano, incluido
// no_asistio/cancelada_anticipada como corrección manual), este
// endpoint decide él mismo cuál de los dos aplica cuando la cita tiene
// paquete_id, comparando la hora programada contra la ventana de
// aviso configurada (ver agendaPro.ts). Citas sin paquete se cancelan
// igual que siempre (estado "cancelada", sin cálculo).
tareasRouter.post(
  "/:id/cancelar",
  requiereModulo("agenda"),
  ah<RequestConEmpresa>(async (req, res) => {
    const { data: tarea, error: errorBuscar } = await supabase
      .from("tareas")
      .select("*")
      .eq("empresa_id", req.empresaId!)
      .eq("id", req.params.id)
      .maybeSingle();
    if (errorBuscar) {
      res.status(500).json({ error: errorBuscar.message });
      return;
    }
    if (!tarea) {
      res.status(404).json({ error: "Tarea no encontrada" });
      return;
    }
    if (req.rol === "colaborador" && tarea.responsable_id !== req.userId) {
      res.status(403).json({ error: "Solo puedes cancelar tus propias citas" });
      return;
    }
    if (tarea.estado !== "pendiente" && tarea.estado !== "confirmada") {
      res.status(400).json({ error: "Esta cita ya no se puede cancelar" });
      return;
    }

    let nuevoEstado: EstadoTarea = "cancelada";
    if (tarea.paquete_id) {
      const config = await obtenerOCrearAgendaProConfig(req.empresaId!);
      nuevoEstado = calcularEstadoCancelacion(tarea, config.ventana_cancelacion_horas);
    }

    const { data, error } = await supabase
      .from("tareas")
      .update({ estado: nuevoEstado, actualizado_en: new Date().toISOString() })
      .eq("empresa_id", req.empresaId!)
      .eq("id", req.params.id)
      .select()
      .single();
    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    // Aviso de cancelación al cliente — mismo criterio que el de "cita
    // agendada" en la creación: no bloquea la respuesta si falla, y solo
    // aplica si la empresa tiene Agenda Pro (lo valida avisarCitaCancelada).
    if (data.cliente_id) {
      void avisarCitaCancelada(req.empresaId!, data.id, data.fecha, data.hora, data.cliente_id);
    }

    res.json({ ...data, descuenta: nuevoEstado === "no_asistio" });
  })
);

tareasRouter.patch(
  "/:id",
  requiereModulo("agenda"),
  ah<RequestConEmpresa>(async (req, res) => {
    // Un colaborador (típicamente desde la app) solo cambia el ESTADO de
    // SUS propias tareas — no reasigna ni reprograma la agenda ajena.
    if (req.rol === "colaborador") {
      const enviados = Object.keys(req.body ?? {});
      if (enviados.length > 0 && enviados.some((k) => k !== "estado")) {
        res.status(403).json({ error: "Solo puedes cambiar el estado de tus tareas" });
        return;
      }
      const { data: propia } = await supabase
        .from("tareas")
        .select("responsable_id")
        .eq("empresa_id", req.empresaId!)
        .eq("id", req.params.id)
        .maybeSingle();
      if (!propia || propia.responsable_id !== req.userId) {
        res.status(403).json({ error: "Solo puedes actualizar tus propias tareas" });
        return;
      }
    }

    const { titulo, descripcion, fecha, hora, responsable_id, cliente_id, prioridad, estado, paquete_id, sesiones_consumidas, trabajo_id, duracion_min } =
      req.body ?? {};
    const cambios: Partial<Tarea> = {};

    if (titulo !== undefined) {
      if (typeof titulo !== "string" || !titulo.trim()) {
        res.status(400).json({ error: "Falta título" });
        return;
      }
      cambios.titulo = titulo.trim();
    }
    if (descripcion !== undefined) cambios.descripcion = descripcion?.trim() || null;
    if (fecha !== undefined) {
      if (typeof fecha !== "string" || !fecha) {
        res.status(400).json({ error: "Falta fecha (YYYY-MM-DD)" });
        return;
      }
      cambios.fecha = fecha;
    }
    if (hora !== undefined) {
      if (hora !== null && hora !== "" && !HORA_REGEX.test(hora)) {
        res.status(400).json({ error: "hora inválida (usa HH:MM)" });
        return;
      }
      cambios.hora = hora || null;
    }
    if (duracion_min !== undefined) {
      if (duracion_min !== null && (!Number.isInteger(duracion_min) || duracion_min <= 0)) {
        res.status(400).json({ error: "duracion_min debe ser un entero mayor a 0" });
        return;
      }
      cambios.duracion_min = duracion_min;
    }
    if (responsable_id !== undefined) {
      if (responsable_id && !(await usuarioExiste(req.empresaId!, responsable_id))) {
        res.status(400).json({ error: "responsable_id inválido" });
        return;
      }
      cambios.responsable_id = responsable_id || null;
    }
    if (cliente_id !== undefined) {
      if (cliente_id && !(await clienteExiste(req.empresaId!, cliente_id))) {
        res.status(400).json({ error: "cliente_id inválido" });
        return;
      }
      cambios.cliente_id = cliente_id || null;
    }
    if (prioridad !== undefined) {
      if (!PRIORIDADES.includes(prioridad)) {
        res.status(400).json({ error: "prioridad inválida" });
        return;
      }
      cambios.prioridad = prioridad;
    }
    if (estado !== undefined) {
      if (!ESTADOS.includes(estado)) {
        res.status(400).json({ error: "estado inválido" });
        return;
      }
      cambios.estado = estado;
    }
    if (trabajo_id !== undefined) {
      if (trabajo_id && !(await trabajoExiste(req.empresaId!, trabajo_id))) {
        res.status(400).json({ error: "trabajo_id inválido" });
        return;
      }
      cambios.trabajo_id = trabajo_id || null;
    }
    if (paquete_id !== undefined) {
      if (paquete_id && !(await paqueteExiste(req.empresaId!, paquete_id))) {
        res.status(400).json({ error: "paquete_id inválido" });
        return;
      }
      cambios.paquete_id = paquete_id || null;
    }
    if (sesiones_consumidas !== undefined) {
      if (!Number.isInteger(sesiones_consumidas) || sesiones_consumidas <= 0) {
        res.status(400).json({ error: "sesiones_consumidas debe ser un entero mayor a 0" });
        return;
      }
      cambios.sesiones_consumidas = sesiones_consumidas;
    }

    if (Object.keys(cambios).length === 0) {
      res.status(400).json({ error: "Nada que actualizar" });
      return;
    }
    cambios.actualizado_en = new Date().toISOString();

    const { data, error } = await supabase
      .from("tareas")
      .update(cambios)
      .eq("empresa_id", req.empresaId!)
      .eq("id", req.params.id)
      .select()
      .maybeSingle();

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    if (!data) {
      res.status(404).json({ error: "Tarea no encontrada" });
      return;
    }
    res.json(data);
  })
);

tareasRouter.delete(
  "/:id",
  requiereModulo("agenda"),
  ah<RequestConEmpresa>(async (req, res) => {
    // Un colaborador no borra citas (suyas ni ajenas) — para eso está
    // "cancelar", que deja el registro. Eliminar es de gestión.
    if (req.rol === "colaborador") {
      res.status(403).json({ error: "No puedes eliminar citas. Si no se va a realizar, cancélala." });
      return;
    }
    const { error } = await supabase.from("tareas").delete().eq("empresa_id", req.empresaId!).eq("id", req.params.id);
    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    res.status(204).end();
  })
);
