// ============================================================
// BITÁCORA — Reserva online pública (Agenda Pro). Sin
// requiereAuth/requiereEmpresa a propósito, mismo criterio que
// encuestaPublicaRouter: la abre un cliente anónimo desde un link
// público (compartido por WhatsApp/redes/etc.), no tiene cuenta de
// Bitácora. Cada consulta valida explícitamente que la empresa tenga
// el módulo agenda_pro activo — si no, 404 (no revela que la empresa
// existe con reserva pública si no está habilitada).
// ============================================================
import { Router } from "express";
import { supabase } from "../supabase";
import { empresaTieneModulo } from "../permisos";
import { avisarCitaAgendada } from "../agendaProAvisos";
import { ah } from "../asyncHandler";

export const reservaPublicaRouter = Router();

const HORA_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;
const FECHA_REGEX = /^\d{4}-\d{2}-\d{2}$/;

async function empresaHabilitada(empresaId: string) {
  const { data: empresa } = await supabase.from("empresas").select("id, nombre, logo_url, color_primario, estado").eq("id", empresaId).maybeSingle();
  if (!empresa || empresa.estado !== "activa") return null;
  if (!(await empresaTieneModulo(empresaId, "agenda_pro"))) return null;
  return empresa;
}

async function obtenerConfig(empresaId: string) {
  const { data } = await supabase.from("agenda_pro_config").select("*").eq("empresa_id", empresaId).maybeSingle();
  return (
    data ?? {
      empresa_id: empresaId,
      duracion_slot_min: 30,
      anticipacion_min_horas: 2,
      dias_max_adelante: 30,
    }
  );
}

reservaPublicaRouter.get(
  "/:empresaId/info",
  ah(async (req, res) => {
    const empresa = await empresaHabilitada(req.params.empresaId);
    if (!empresa) {
      res.status(404).json({ error: "Este link de reserva no está disponible" });
      return;
    }
    const config = await obtenerConfig(empresa.id);
    res.json({
      nombre: empresa.nombre,
      logo_url: empresa.logo_url,
      color_primario: empresa.color_primario,
      duracion_slot_min: config.duracion_slot_min,
      dias_max_adelante: config.dias_max_adelante,
    });
  })
);

// Genera los horarios de un día (array "HH:MM") a partir del horario
// configurado para ese día de semana, con paso duracion_slot_min.
function slotsDelDia(horaInicio: string, horaFin: string, duracionMin: number): string[] {
  const slots: string[] = [];
  let [h, m] = horaInicio.slice(0, 5).split(":").map(Number);
  const [hFin, mFin] = horaFin.slice(0, 5).split(":").map(Number);
  while (h < hFin || (h === hFin && m < mFin)) {
    slots.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
    m += duracionMin;
    while (m >= 60) {
      m -= 60;
      h += 1;
    }
  }
  return slots;
}

function fmtFecha(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

reservaPublicaRouter.get(
  "/:empresaId/disponibilidad",
  ah(async (req, res) => {
    const empresa = await empresaHabilitada(req.params.empresaId);
    if (!empresa) {
      res.status(404).json({ error: "Este link de reserva no está disponible" });
      return;
    }
    const config = await obtenerConfig(empresa.id);
    const { data: horarios } = await supabase.from("agenda_pro_horarios").select("*").eq("empresa_id", empresa.id);
    const horariosPorDia = new Map((horarios ?? []).map((h) => [h.dia_semana, h]));

    const hoy = new Date();
    const desde = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
    const fechaLimite = new Date(desde);
    fechaLimite.setDate(fechaLimite.getDate() + config.dias_max_adelante);

    const { data: ocupadas } = await supabase
      .from("tareas")
      .select("fecha, hora")
      .eq("empresa_id", empresa.id)
      .neq("estado", "cancelada")
      .neq("estado", "cancelada_anticipada")
      .not("hora", "is", null)
      .gte("fecha", fmtFecha(desde))
      .lte("fecha", fmtFecha(fechaLimite));
    const ocupadasPorFecha = new Map<string, Set<string>>();
    for (const o of ocupadas ?? []) {
      if (!ocupadasPorFecha.has(o.fecha)) ocupadasPorFecha.set(o.fecha, new Set());
      ocupadasPorFecha.get(o.fecha)!.add(o.hora!.slice(0, 5));
    }

    const limiteAnticipacion = new Date(Date.now() + config.anticipacion_min_horas * 60 * 60 * 1000);

    const disponibilidad: Record<string, string[]> = {};
    for (let d = new Date(desde); d <= fechaLimite; d.setDate(d.getDate() + 1)) {
      const horario = horariosPorDia.get(d.getDay());
      if (!horario) continue;
      const fecha = fmtFecha(d);
      const ocupadasDia = ocupadasPorFecha.get(fecha) ?? new Set();
      const libres = slotsDelDia(horario.hora_inicio, horario.hora_fin, config.duracion_slot_min).filter((hora) => {
        if (ocupadasDia.has(hora)) return false;
        const [h, m] = hora.split(":").map(Number);
        const inicioSlot = new Date(d.getFullYear(), d.getMonth(), d.getDate(), h, m);
        return inicioSlot >= limiteAnticipacion;
      });
      if (libres.length > 0) disponibilidad[fecha] = libres;
    }

    res.json(disponibilidad);
  })
);

reservaPublicaRouter.post(
  "/:empresaId/reservar",
  ah(async (req, res) => {
    const empresa = await empresaHabilitada(req.params.empresaId);
    if (!empresa) {
      res.status(404).json({ error: "Este link de reserva no está disponible" });
      return;
    }

    const { nombre, telefono, correo, fecha, hora, notas } = req.body ?? {};
    if (typeof nombre !== "string" || !nombre.trim()) {
      res.status(400).json({ error: "Falta tu nombre" });
      return;
    }
    if ((typeof telefono !== "string" || !telefono.trim()) && (typeof correo !== "string" || !correo.trim())) {
      res.status(400).json({ error: "Déjanos tu teléfono o tu correo para poder avisarte" });
      return;
    }
    if (typeof fecha !== "string" || !FECHA_REGEX.test(fecha)) {
      res.status(400).json({ error: "Fecha inválida" });
      return;
    }
    if (typeof hora !== "string" || !HORA_REGEX.test(hora)) {
      res.status(400).json({ error: "Hora inválida" });
      return;
    }

    // Revalida que el slot siga libre — no hay lock explícito (mismo
    // criterio que el resto del proyecto), ventana de carrera mínima y
    // aceptada para este alcance.
    const { data: choque } = await supabase
      .from("tareas")
      .select("id")
      .eq("empresa_id", empresa.id)
      .eq("fecha", fecha)
      .eq("hora", hora)
      .neq("estado", "cancelada")
      .neq("estado", "cancelada_anticipada")
      .maybeSingle();
    if (choque) {
      res.status(409).json({ error: "Ese horario ya no está disponible — elige otro" });
      return;
    }

    let clienteId: string | null = null;
    if (typeof telefono === "string" && telefono.trim()) {
      const { data } = await supabase.from("clientes").select("id").eq("empresa_id", empresa.id).eq("telefono", telefono.trim()).maybeSingle();
      clienteId = data?.id ?? null;
    }
    if (!clienteId && typeof correo === "string" && correo.trim()) {
      const { data } = await supabase.from("clientes").select("id").eq("empresa_id", empresa.id).eq("correo", correo.trim()).maybeSingle();
      clienteId = data?.id ?? null;
    }
    if (!clienteId) {
      const { data: nuevoCliente, error: errorCliente } = await supabase
        .from("clientes")
        .insert({
          empresa_id: empresa.id,
          nombre: nombre.trim(),
          telefono: telefono?.trim() || null,
          correo: correo?.trim() || null,
          direccion: "Reserva online — sin dirección",
        })
        .select("id")
        .single();
      if (errorCliente || !nuevoCliente) {
        res.status(500).json({ error: "No se pudo registrar tus datos" });
        return;
      }
      clienteId = nuevoCliente.id;
    }

    const { data: tarea, error: errorTarea } = await supabase
      .from("tareas")
      .insert({
        empresa_id: empresa.id,
        titulo: `Cita agendada online — ${nombre.trim()}`,
        descripcion: notas?.trim() || null,
        fecha,
        hora,
        cliente_id: clienteId,
        estado: "pendiente",
        origen: "reserva_publica",
      })
      .select()
      .single();
    if (errorTarea || !tarea) {
      res.status(500).json({ error: "No se pudo crear la cita" });
      return;
    }

    void avisarCitaAgendada(empresa.id, tarea.id, tarea.fecha, tarea.hora, clienteId);

    res.status(201).json({ ok: true, fecha, hora });
  })
);
