// ============================================================
// BITÁCORA — Eventos semanales de flota (migración 128, 23-sep-2026).
//
// Hechos sueltos sobre un vehículo (cambio de luz, pinchazo...), varios
// por semana. La "semana" es solo un filtro de fechas (?desde&hasta,
// lunes–domingo) — no hay registro semanal que cerrar.
//
// Montado en /api/equipos (igual que registrosMantencion.ts), sin
// requiereModulo a nivel de router: la autorización es por handler.
//   · Ver y registrar: quien gestiona flota, o el chofer que tiene ese
//     vehículo asignado hoy (mismo criterio que la mantención diaria).
//   · Eliminar: solo quien gestiona flota.
// ============================================================
import { Router } from "express";
import type { TipoEventoFlota } from "@bitacora/shared";
import { TIPOS_EVENTO_FLOTA } from "@bitacora/shared";
import { supabase } from "../supabase";
import type { RequestConEmpresa } from "../empresa";
import { ah } from "../asyncHandler";
import { rolPuedeVerModulo } from "../roles";
import { equipoAsignadoAColaborador } from "./equipos";

export const eventosFlotaRouter = Router();

const FECHA_ISO = /^\d{4}-\d{2}-\d{2}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function puedeGestionarFlota(req: RequestConEmpresa): Promise<boolean> {
  return rolPuedeVerModulo(req.rol ?? "colaborador", "flota", req.empresaId);
}

async function puedeSobreEquipo(req: RequestConEmpresa, equipoId: string): Promise<boolean> {
  if (await puedeGestionarFlota(req)) return true;
  const asignado = await equipoAsignadoAColaborador(req.empresaId!, req.userId!);
  return asignado?.id === equipoId;
}

async function equipoExiste(empresaId: string, equipoId: string): Promise<boolean> {
  const { data } = await supabase.from("equipos").select("id").eq("empresa_id", empresaId).eq("id", equipoId).maybeSingle();
  return Boolean(data);
}

function hoyLocal(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// GET /:equipoId/eventos?desde&hasta — más recientes primero.
eventosFlotaRouter.get(
  "/:equipoId/eventos",
  ah<RequestConEmpresa>(async (req, res) => {
    const { equipoId } = req.params;
    if (!(await puedeSobreEquipo(req, equipoId))) {
      res.status(403).json({ error: "No tienes permiso para ver los eventos de este vehículo" });
      return;
    }
    if (!(await equipoExiste(req.empresaId!, equipoId))) {
      res.status(404).json({ error: "Vehículo no encontrado" });
      return;
    }
    let query = supabase
      .from("eventos_flota")
      .select("*, autor:usuarios(nombre)")
      .eq("empresa_id", req.empresaId!)
      .eq("equipo_id", equipoId)
      .order("fecha", { ascending: false })
      .order("creado_en", { ascending: false });
    const { desde, hasta } = req.query;
    if (typeof desde === "string" && FECHA_ISO.test(desde)) query = query.gte("fecha", desde);
    if (typeof hasta === "string" && FECHA_ISO.test(hasta)) query = query.lte("fecha", hasta);
    const { data, error } = await query;
    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    res.json(data ?? []);
  })
);

// POST /:equipoId/eventos — { id?, tipo, fecha?, descripcion?, kilometraje? }
// `id` opcional generado en el celular: si un reintento de la cola
// offline (timeout) vuelve a mandar el mismo evento, se devuelve el que
// ya existe en vez de duplicarlo (mismo criterio que foto_id en fotos).
eventosFlotaRouter.post(
  "/:equipoId/eventos",
  ah<RequestConEmpresa>(async (req, res) => {
    const { equipoId } = req.params;
    if (!(await puedeSobreEquipo(req, equipoId))) {
      res.status(403).json({ error: "No tienes permiso para registrar eventos en este vehículo" });
      return;
    }
    if (!(await equipoExiste(req.empresaId!, equipoId))) {
      res.status(404).json({ error: "Vehículo no encontrado" });
      return;
    }
    const { id, tipo, fecha, descripcion, kilometraje } = req.body ?? {};
    const idCliente = typeof id === "string" && UUID.test(id) ? id : null;
    if (idCliente) {
      const { data: existente } = await supabase
        .from("eventos_flota")
        .select("*, autor:usuarios(nombre)")
        .eq("empresa_id", req.empresaId!)
        .eq("id", idCliente)
        .maybeSingle();
      if (existente) {
        res.status(200).json(existente);
        return;
      }
    }
    if (typeof tipo !== "string" || !TIPOS_EVENTO_FLOTA.includes(tipo as TipoEventoFlota)) {
      res.status(400).json({ error: `tipo debe ser uno de: ${TIPOS_EVENTO_FLOTA.join(", ")}` });
      return;
    }
    const fechaFinal = fecha === undefined || fecha === null || fecha === "" ? hoyLocal() : fecha;
    if (typeof fechaFinal !== "string" || !FECHA_ISO.test(fechaFinal)) {
      res.status(400).json({ error: "fecha inválida (YYYY-MM-DD)" });
      return;
    }
    // Margen de 1 día por diferencias de zona horaria entre el celular y
    // el servidor (mismo criterio "no futura" que la mantención).
    const manana = new Date();
    manana.setDate(manana.getDate() + 1);
    if (fechaFinal > manana.toISOString().slice(0, 10)) {
      res.status(400).json({ error: "La fecha no puede ser futura" });
      return;
    }
    const texto = typeof descripcion === "string" ? descripcion.trim() : "";
    if (tipo === "otro" && !texto) {
      res.status(400).json({ error: "Describe el evento cuando el tipo es \"Otro\"" });
      return;
    }
    let km: number | null = null;
    if (kilometraje !== undefined && kilometraje !== null && kilometraje !== "") {
      km = Number(kilometraje);
      if (!Number.isFinite(km) || km < 0) {
        res.status(400).json({ error: "kilometraje inválido" });
        return;
      }
    }
    const { data, error } = await supabase
      .from("eventos_flota")
      .insert({
        ...(idCliente ? { id: idCliente } : {}),
        empresa_id: req.empresaId!,
        equipo_id: equipoId,
        tipo: tipo as TipoEventoFlota,
        fecha: fechaFinal,
        descripcion: texto || null,
        kilometraje: km,
        reportado_por: req.userId ?? null,
      })
      .select("*, autor:usuarios(nombre)")
      .single();
    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    res.status(201).json(data);
  })
);

// DELETE /:equipoId/eventos/:id — solo gestión de flota.
eventosFlotaRouter.delete(
  "/:equipoId/eventos/:id",
  ah<RequestConEmpresa>(async (req, res) => {
    if (!(await puedeGestionarFlota(req))) {
      res.status(403).json({ error: "No tienes permiso para eliminar eventos" });
      return;
    }
    const { error, count } = await supabase
      .from("eventos_flota")
      .delete({ count: "exact" })
      .eq("empresa_id", req.empresaId!)
      .eq("equipo_id", req.params.equipoId)
      .eq("id", req.params.id);
    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    if (!count) {
      res.status(404).json({ error: "Evento no encontrado" });
      return;
    }
    res.status(204).end();
  })
);
