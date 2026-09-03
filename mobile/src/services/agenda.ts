import type { Cliente, EstadoTarea, Prioridad, Tarea, Usuario } from "@bitacora/shared";
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

/** Clientes + equipo de la empresa, para los selectores de "Nueva cita". */
export async function catalogoParaCita(): Promise<{ clientes: Cliente[]; equipo: Usuario[] }> {
  const [c, e] = await Promise.all([apiJson<Cliente[]>("/api/clientes"), apiJson<Usuario[]>("/api/usuarios")]);
  if (c.ok) await guardarCache("agenda:clientes", c.data);
  if (e.ok) await guardarCache("agenda:equipo", e.data);
  const clientes = c.ok ? c.data : (await leerCache<Cliente[]>("agenda:clientes"))?.datos ?? [];
  const equipo = e.ok ? e.data : (await leerCache<Usuario[]>("agenda:equipo"))?.datos ?? [];
  return { clientes, equipo };
}

export type BorradorCita = {
  titulo: string;
  fecha: string;
  hora: string;
  cliente_id: string;
  responsable_id: string;
  descripcion: string;
  prioridad: Prioridad;
};

/** Crea una cita/tarea. Va directo (no por la cola): necesitamos el id que asigna el servidor. */
export async function crearCita(b: BorradorCita): Promise<{ ok: true; tarea: Tarea } | { ok: false; error: string }> {
  const res = await apiJson<Tarea>("/api/tareas", {
    method: "POST",
    body: JSON.stringify({
      titulo: b.titulo.trim(),
      fecha: b.fecha,
      hora: b.hora || null,
      cliente_id: b.cliente_id || null,
      responsable_id: b.responsable_id || null,
      descripcion: b.descripcion.trim() || null,
      prioridad: b.prioridad,
    }),
  });
  return res.ok ? { ok: true, tarea: res.data } : { ok: false, error: res.error };
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
