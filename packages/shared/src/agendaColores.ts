// ============================================================
// Fase 6 (23-sep-2026, pedido explícito) — Agenda: una sola fuente
// para "qué color/ícono le corresponde a cada evento", usada por web Y
// mobile. Antes cada plataforma tenía su propio mapa suelto:
//   - web (dashboard/agenda/page.tsx): ESTADOS_AGENDA/ESTADO_TAREA_A_AGENDA,
//     solo para cita/OS — nunca mostró levantamientos.
//   - mobile (AgendaScreen.tsx): colorEstado() para citas (por estado,
//     bien) pero el levantamiento en BarrasDia usaba SIEMPRE el mismo
//     color fijo (accent2), sin importar su estado real — "tipo"
//     estaba pisando a "estado" en ese único punto (el bug que 6.3
//     pedía encontrar).
//
// Regla del diseño (6.3): una dimensión por atributo.
//   COLOR      = estado (4 tonos, los mismos 4 de siempre: agendado/
//                en_progreso/completado/cancelado — MAPA_ESTADO_TONO
//                de packages/ui ya usa esos nombres para "cerrado" en
//                vez de "agendado"; se listan ambos alias abajo).
//   ÍCONO+ETIQUETA = tipo (cita/os/levantamiento).
//
// Los tonos se tipan como el propio literal-union de TonoEstado
// (packages/ui/src/tipos.ts) SIN importar ese paquete — packages/ui
// depende de packages/shared, no al revés; duplicar el literal acá es
// más simple que invertir esa dependencia.
// ============================================================
import type { EstadoLevantamiento, EstadoOS, EstadoTarea, EstadoTrabajo } from "./types";

export type TonoAgenda = "en_progreso" | "completado" | "cerrado" | "cancelado";
export type EstadoAgendaUnificado = "agendado" | "en_progreso" | "completado" | "cancelado";
export type TipoEventoAgenda = "cita" | "os" | "levantamiento";

export const TONO_ESTADO_AGENDA: Record<EstadoAgendaUnificado, TonoAgenda> = {
  agendado: "cerrado",
  en_progreso: "en_progreso",
  completado: "completado",
  cancelado: "cancelado",
};

export const ETIQUETA_ESTADO_AGENDA: Record<EstadoAgendaUnificado, string> = {
  agendado: "Agendado",
  en_progreso: "En progreso",
  completado: "Completado",
  cancelado: "Cancelado",
};

export const ETIQUETA_TIPO_AGENDA: Record<TipoEventoAgenda, string> = {
  cita: "Cita",
  os: "OS",
  levantamiento: "Levantamiento",
};

// Nombre de ícono lucide (idéntico en lucide-react y lucide-react-native)
// por tipo — cada plataforma resuelve su propio import con este nombre;
// este módulo solo fija la DECISIÓN de cuál usar, una sola vez.
export const ICONO_TIPO_AGENDA: Record<TipoEventoAgenda, string> = {
  cita: "Calendar",
  os: "ClipboardCheck",
  levantamiento: "Search",
};

// --- Derivación por tipo (mismo criterio que ya usaba cada plataforma,
// centralizado acá) ---

export function estadoAgendaDeTarea(estado: EstadoTarea): EstadoAgendaUnificado {
  if (estado === "completada") return "completado";
  if (estado === "cancelada" || estado === "no_asistio" || estado === "cancelada_anticipada") return "cancelado";
  return "agendado"; // pendiente, confirmada
}

// Misma lógica que ya tenía estadoAgendaDe() en web/dashboard/agenda/
// page.tsx — trasladada acá sin cambios de comportamiento.
export function estadoAgendaDeOS(estadoTrabajo: EstadoTrabajo, estadoOS: EstadoOS | null): EstadoAgendaUnificado {
  if (estadoTrabajo === "cancelado") return "cancelado";
  if (estadoOS === "en_proceso") return "en_progreso";
  if (estadoTrabajo === "completado" || estadoOS === "completada" || estadoOS === "firmada") return "completado";
  return "agendado";
}

// El técnico completa su parte en completado_tecnico — desde ahí en
// adelante el evento se ve "completado" en el calendario aunque la
// oficina siga su propio flujo (cotizar/aprobar/rechazar) por fuera.
export function estadoAgendaDeLevantamiento(estado: EstadoLevantamiento): EstadoAgendaUnificado {
  if (estado === "rechazado") return "cancelado";
  if (estado === "en_terreno") return "en_progreso";
  if (estado === "creado" || estado === "asignado") return "agendado";
  return "completado"; // completado_tecnico, cotizado_externo, aprobado
}
