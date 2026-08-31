// ============================================================
// Agenda Pro — configuración del horario de reserva online pública
// (dashboard, autenticado). El consumo público vive aparte, en
// reservaPublica.ts (sin auth) — ahí se lee esta misma config para
// calcular disponibilidad.
// ============================================================
import { Router } from "express";
import type { AgendaProConfig } from "@bitacora/shared";
import { supabase } from "../supabase";
import { obtenerOCrearAgendaProConfig } from "../agendaPro";
import type { RequestConEmpresa } from "../empresa";
import { ah } from "../asyncHandler";
import { requiereModulo, requiereRol } from "../permisos";

export const agendaProConfigRouter = Router();

agendaProConfigRouter.use(requiereModulo("agenda_pro"));

const DIA_REGEX = /^[0-6]$/;
const HORA_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;

agendaProConfigRouter.get(
  "/",
  ah<RequestConEmpresa>(async (req, res) => {
    const config = await obtenerOCrearAgendaProConfig(req.empresaId!);
    const { data: horarios } = await supabase
      .from("agenda_pro_horarios")
      .select("*")
      .eq("empresa_id", req.empresaId!)
      .order("dia_semana", { ascending: true });
    res.json({ config, horarios: horarios ?? [] });
  })
);

agendaProConfigRouter.patch(
  "/",
  requiereRol("admin", "supervisor"),
  ah<RequestConEmpresa>(async (req, res) => {
    const actual = await obtenerOCrearAgendaProConfig(req.empresaId!);
    const { duracion_slot_min, anticipacion_min_horas, dias_max_adelante, ventana_cancelacion_horas } = req.body ?? {};
    const cambios: Partial<AgendaProConfig> = { actualizado_en: new Date().toISOString() };

    if (duracion_slot_min !== undefined) {
      if (!Number.isInteger(duracion_slot_min) || duracion_slot_min <= 0) {
        res.status(400).json({ error: "duracion_slot_min debe ser un entero mayor a 0" });
        return;
      }
      cambios.duracion_slot_min = duracion_slot_min;
    }
    if (anticipacion_min_horas !== undefined) {
      if (!Number.isInteger(anticipacion_min_horas) || anticipacion_min_horas < 0) {
        res.status(400).json({ error: "anticipacion_min_horas debe ser un entero mayor o igual a 0" });
        return;
      }
      cambios.anticipacion_min_horas = anticipacion_min_horas;
    }
    if (dias_max_adelante !== undefined) {
      if (!Number.isInteger(dias_max_adelante) || dias_max_adelante <= 0) {
        res.status(400).json({ error: "dias_max_adelante debe ser un entero mayor a 0" });
        return;
      }
      cambios.dias_max_adelante = dias_max_adelante;
    }
    if (ventana_cancelacion_horas !== undefined) {
      if (!Number.isInteger(ventana_cancelacion_horas) || ventana_cancelacion_horas < 0) {
        res.status(400).json({ error: "ventana_cancelacion_horas debe ser un entero mayor o igual a 0" });
        return;
      }
      cambios.ventana_cancelacion_horas = ventana_cancelacion_horas;
    }

    // tenant-ok: obtenerOCrearAgendaProConfig() arriba ya scopeó por empresa_id.
    const { data, error } = await supabase.from("agenda_pro_config").update(cambios).eq("empresa_id", actual.empresa_id).select().single();
    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    res.json(data);
  })
);

agendaProConfigRouter.put(
  "/horarios",
  requiereRol("admin", "supervisor"),
  ah<RequestConEmpresa>(async (req, res) => {
    const horarios = req.body?.horarios;
    if (!Array.isArray(horarios)) {
      res.status(400).json({ error: "Falta horarios (array)" });
      return;
    }
    for (const h of horarios) {
      if (!DIA_REGEX.test(String(h?.dia_semana)) || !HORA_REGEX.test(h?.hora_inicio) || !HORA_REGEX.test(h?.hora_fin)) {
        res.status(400).json({ error: "Cada horario necesita dia_semana (0-6), hora_inicio y hora_fin (HH:MM) válidos" });
        return;
      }
      if (h.hora_fin <= h.hora_inicio) {
        res.status(400).json({ error: "hora_fin debe ser posterior a hora_inicio" });
        return;
      }
    }

    const { error: errorDelete } = await supabase.from("agenda_pro_horarios").delete().eq("empresa_id", req.empresaId!);
    if (errorDelete) {
      res.status(500).json({ error: errorDelete.message });
      return;
    }
    if (horarios.length > 0) {
      const { error: errorInsert } = await supabase.from("agenda_pro_horarios").insert(
        horarios.map((h) => ({
          empresa_id: req.empresaId!,
          dia_semana: h.dia_semana,
          hora_inicio: h.hora_inicio,
          hora_fin: h.hora_fin,
        }))
      );
      if (errorInsert) {
        res.status(500).json({ error: errorInsert.message });
        return;
      }
    }

    const { data: actualizados } = await supabase
      .from("agenda_pro_horarios")
      .select("*")
      .eq("empresa_id", req.empresaId!)
      .order("dia_semana", { ascending: true });
    res.json(actualizados ?? []);
  })
);
