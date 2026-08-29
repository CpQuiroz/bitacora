import { Router } from "express";
import type { EstadoTarea, Prioridad, Tarea } from "@bitacora/shared";
import { supabase } from "../supabase";
import { notificar } from "../notificar";
import type { RequestConEmpresa } from "../empresa";
import { ah } from "../asyncHandler";
import { requiereModulo } from "../permisos";

export const tareasRouter = Router();

const PRIORIDADES: Prioridad[] = ["alta", "media", "baja"];
const ESTADOS: EstadoTarea[] = ["pendiente", "completada", "cancelada"];
const HORA_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;

async function clienteExiste(empresaId: string, clienteId: string) {
  const { data } = await supabase.from("clientes").select("id").eq("empresa_id", empresaId).eq("id", clienteId).maybeSingle();
  return Boolean(data);
}

async function usuarioExiste(empresaId: string, usuarioId: string) {
  const { data } = await supabase.from("usuarios").select("id").eq("empresa_id", empresaId).eq("id", usuarioId).maybeSingle();
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

tareasRouter.post(
  "/",
  requiereModulo("agenda"),
  ah<RequestConEmpresa>(async (req, res) => {
    const { titulo, descripcion, fecha, hora, responsable_id, cliente_id, prioridad } = req.body ?? {};

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
    if (responsable_id && !(await usuarioExiste(req.empresaId!, responsable_id))) {
      res.status(400).json({ error: "responsable_id inválido" });
      return;
    }
    if (cliente_id && !(await clienteExiste(req.empresaId!, cliente_id))) {
      res.status(400).json({ error: "cliente_id inválido" });
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
        responsable_id: responsable_id || null,
        cliente_id: cliente_id || null,
        prioridad: prioridadFinal,
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

    res.status(201).json(data);
  })
);

tareasRouter.patch(
  "/:id",
  requiereModulo("agenda"),
  ah<RequestConEmpresa>(async (req, res) => {
    const { titulo, descripcion, fecha, hora, responsable_id, cliente_id, prioridad, estado } = req.body ?? {};
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
    const { error } = await supabase.from("tareas").delete().eq("empresa_id", req.empresaId!).eq("id", req.params.id);
    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    res.status(204).end();
  })
);
