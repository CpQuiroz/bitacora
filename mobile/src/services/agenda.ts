import type { Cliente, EstadoTarea, Tarea } from "@bitacora/shared";
import { apiJson } from "./api";
import { encolar } from "./sync/queue";
import { guardarCache, leerCache } from "./sync/cache";

export type ClienteContactoTarea = Pick<Cliente, "id" | "nombre" | "telefono" | "direccion" | "lat" | "lng">;
export type TareaConDatos = Tarea & {
  cliente: ClienteContactoTarea | null;
  responsable: { nombre: string } | null;
};

export type ListaTareas = { tareas: TareaConDatos[]; desdeCache: boolean; guardadoEn?: number };

/** Mis tareas/citas de agenda. El backend ya acota al colaborador a las suyas. */
export async function listarMisTareas(): Promise<ListaTareas> {
  const res = await apiJson<TareaConDatos[]>("/api/tareas");
  if (res.ok) {
    await guardarCache("agenda:mias", res.data);
    return { tareas: res.data, desdeCache: false };
  }
  const cache = await leerCache<TareaConDatos[]>("agenda:mias");
  if (cache) return { tareas: cache.datos, desdeCache: true, guardadoEn: cache.guardadoEn };
  throw new Error(res.error);
}

export type DetalleTarea = { tarea: TareaConDatos; desdeCache: boolean; guardadoEn?: number };

export async function obtenerTarea(tareaId: string): Promise<DetalleTarea> {
  const clave = `tarea:${tareaId}`;
  const res = await apiJson<TareaConDatos>(`/api/tareas/${tareaId}`);
  if (res.ok) {
    await guardarCache(clave, res.data);
    return { tarea: res.data, desdeCache: false };
  }
  const cache = await leerCache<TareaConDatos>(clave);
  if (cache) return { tarea: cache.datos, desdeCache: true, guardadoEn: cache.guardadoEn };
  throw new Error(res.error);
}

// --- Mutaciones (por la cola: se intentan al toque, se reintentan al reconectar) ---

const ETIQUETA_ESTADO: Partial<Record<EstadoTarea, string>> = {
  confirmada: "Confirmar cita",
  completada: "Marcar completada",
};

/** Cambia el estado de una tarea propia (confirmada / completada). */
export function encolarEstadoTarea(tareaId: string, estado: EstadoTarea) {
  return encolar({
    etiqueta: ETIQUETA_ESTADO[estado] ?? "Actualizar cita",
    recurso: `tarea:${tareaId}`,
    path: `/api/tareas/${tareaId}`,
    method: "PATCH",
    body: { estado },
  });
}

/**
 * Cancela una cita. El backend decide si cuenta como "no asistió" o
 * "cancelada a tiempo" cuando la cita tiene paquete de sesiones.
 */
export function encolarCancelarTarea(tareaId: string) {
  return encolar({
    etiqueta: "Cancelar cita",
    recurso: `tarea:${tareaId}`,
    path: `/api/tareas/${tareaId}/cancelar`,
    method: "POST",
  });
}
