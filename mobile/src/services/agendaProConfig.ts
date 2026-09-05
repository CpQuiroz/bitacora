import type { AgendaProConfig, AgendaProHorario } from "@bitacora/shared";
import { apiJson } from "./api";

export type AgendaProConfigCompleta = { config: AgendaProConfig; horarios: AgendaProHorario[] };

/** Horario de atención del negocio (Configuración → Agenda Pro) — usado para el rango del selector de hora. */
export async function obtenerAgendaProConfig(): Promise<AgendaProConfigCompleta | null> {
  const res = await apiJson<AgendaProConfigCompleta>("/api/agenda-pro/config");
  return res.ok ? res.data : null;
}
