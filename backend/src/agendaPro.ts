// ============================================================
// BITÁCORA — Helpers de Agenda Pro compartidos entre routers
// (agendaProConfig.ts, tareas.ts, portal.ts, reservaPublica.ts). Antes
// vivía duplicado dentro de agendaProConfig.ts; se movió acá para que
// tareas.ts y portal.ts puedan reutilizar la misma lógica de ventana
// de cancelación sin repetirla.
// ============================================================
import type { AgendaProConfig } from "@bitacora/shared";
import { supabase } from "./supabase";

export async function obtenerOCrearAgendaProConfig(empresaId: string): Promise<AgendaProConfig> {
  const { data: existente, error: errorBuscar } = await supabase
    .from("agenda_pro_config")
    .select("*")
    .eq("empresa_id", empresaId)
    .maybeSingle();
  if (errorBuscar) throw new Error(errorBuscar.message);
  if (existente) return existente;

  const { data: creada, error: errorCrear } = await supabase.from("agenda_pro_config").insert({ empresa_id: empresaId }).select().single();
  if (errorCrear) throw new Error(errorCrear.message);
  return creada;
}

// Decide si cancelar AHORA una cita con paquete descuenta la sesión o
// no: compara la hora programada de la sesión contra el momento actual
// y la ventana de aviso configurada por la empresa (default 24h).
//
// TODO: decisión pendiente — si la tarea no tiene hora (solo fecha),
// se usa 23:59 de ese día como hora de la sesión, dando el beneficio
// de la duda al cliente (favorece "cancelada con anticipación"). El
// spec no define cómo tratar citas sin hora específica.
export function calcularEstadoCancelacion(
  tarea: { fecha: string; hora: string | null },
  ventanaHoras: number,
  ahora: Date = new Date()
): "no_asistio" | "cancelada_anticipada" {
  const horaSesion = tarea.hora ?? "23:59";
  const momentoSesion = new Date(`${tarea.fecha}T${horaSesion}:00`);
  const diffHoras = (momentoSesion.getTime() - ahora.getTime()) / (1000 * 60 * 60);
  return diffHoras >= ventanaHoras ? "cancelada_anticipada" : "no_asistio";
}
