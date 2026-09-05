// ============================================================
// Estados de una cita (Tarea de Agenda), en 3+2 — rediseño Agenda Pro.
// Fuente única de etiquetas/agrupación para web y móvil: ninguno de los
// dos debe tener su propio mapa de etiquetas por separado.
//
// "Camino": 3 estados que se recorren en orden (Reservado → Confirmado
// → Asistió), mostrados como un riel de progreso.
// "Salida": 2 estados a los que se puede saltar desde cualquier punto
// del camino (No asistió, Cancelado) — no forman parte del riel, van
// aparte como cierres.
//
// cancelada y cancelada_anticipada son el MISMO estado visible
// ("Cancelado") — la diferencia es solo si se descontó o no la sesión
// del pack (ver calcularEstadoCancelacion en el backend), invisible
// para quien mira la agenda.
// ============================================================
import type { EstadoTarea } from "./types";

export type GrupoEstadoTarea = "camino" | "salida";

export const CAMINO_ESTADOS_TAREA: readonly EstadoTarea[] = ["pendiente", "confirmada", "completada"];
export const SALIDA_ESTADOS_TAREA: readonly EstadoTarea[] = ["no_asistio", "cancelada", "cancelada_anticipada"];

export const ETIQUETA_ESTADO_TAREA: Record<EstadoTarea, string> = {
  pendiente: "Reservado",
  confirmada: "Confirmado",
  completada: "Asistió",
  no_asistio: "No asistió",
  cancelada: "Cancelado",
  cancelada_anticipada: "Cancelado",
};

export function grupoDeEstadoTarea(estado: EstadoTarea): GrupoEstadoTarea {
  return (CAMINO_ESTADOS_TAREA as EstadoTarea[]).includes(estado) ? "camino" : "salida";
}

/** Posición en el riel de 3 pasos — null si el estado es una salida. */
export function pasoDelRielTarea(estado: EstadoTarea): 0 | 1 | 2 | null {
  const idx = (CAMINO_ESTADOS_TAREA as EstadoTarea[]).indexOf(estado);
  return idx === -1 ? null : (idx as 0 | 1 | 2);
}

/**
 * Regla de negocio (Punto 2 del rediseño): Asistió y No asistió
 * descuentan 1 sesión del pack; Reservado, Confirmado y Cancelado (en
 * cualquiera de sus dos variantes) no. Espejo del cálculo real, que
 * vive en backend/src/agendaPro.ts:calcularConsumoPorPaquete — este
 * helper es solo para mostrar el texto correcto en la UI antes de
 * guardar, nunca la fuente de verdad del saldo.
 */
export function descuentaPackTarea(estado: EstadoTarea): boolean {
  return estado === "completada" || estado === "no_asistio";
}
