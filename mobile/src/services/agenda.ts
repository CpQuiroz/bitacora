import type { Cliente, EstadoTarea, Prioridad, Tarea, Usuario } from "@bitacora/shared";
import { apiFetch, apiJson } from "./api";
import { encolar } from "./sync/queue";
import { guardarCache, leerCache } from "./sync/cache";

export type ClienteContactoTarea = Pick<Cliente, "id" | "nombre" | "telefono" | "direccion" | "lat" | "lng">;
export type TareaConDatos = Tarea & {
  cliente: ClienteContactoTarea | null;
  responsable: { nombre: string } | null;
};

export type ListaTareas = { tareas: TareaConDatos[]; desdeCache: boolean; guardadoEn?: number };

/**
 * Citas en un rango de fechas (para la vista de calendario). El backend
 * devuelve TODAS las de la empresa si el rol es de gestión, o solo las
 * del colaborador si no. Se cachea por semana para poder verla offline.
 */
export async function listarTareasRango(desde: string, hasta: string): Promise<ListaTareas> {
  const clave = `agenda:rango:${desde}`;
  const res = await apiJson<TareaConDatos[]>(`/api/tareas?desde=${desde}&hasta=${hasta}`);
  if (res.ok) {
    await guardarCache(clave, res.data);
    return { tareas: res.data, desdeCache: false };
  }
  const cache = await leerCache<TareaConDatos[]>(clave);
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
  // Agenda Pro: si la cita descuenta de un pack de sesiones del cliente.
  paquete_id: string;
  sesiones_consumidas: number;
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
      paquete_id: b.paquete_id || null,
      sesiones_consumidas: b.paquete_id ? b.sesiones_consumidas || 1 : undefined,
    }),
  });
  return res.ok ? { ok: true, tarea: res.data } : { ok: false, error: res.error };
}

export type EdicionCita = Partial<
  Pick<
    BorradorCita,
    "titulo" | "fecha" | "hora" | "cliente_id" | "responsable_id" | "descripcion" | "prioridad" | "paquete_id" | "sesiones_consumidas"
  >
>;

/** Edita/reprograma una cita (roles de gestión). Va directo: es acción de oficina y necesita respuesta. */
export async function editarCita(id: string, c: EdicionCita): Promise<{ ok: true; tarea: Tarea } | { ok: false; error: string }> {
  const body: Record<string, unknown> = {};
  if (c.titulo !== undefined) body.titulo = c.titulo.trim();
  if (c.fecha !== undefined) body.fecha = c.fecha;
  if (c.hora !== undefined) body.hora = c.hora || null;
  if (c.cliente_id !== undefined) body.cliente_id = c.cliente_id || null;
  if (c.responsable_id !== undefined) body.responsable_id = c.responsable_id || null;
  if (c.descripcion !== undefined) body.descripcion = c.descripcion.trim() || null;
  if (c.prioridad !== undefined) body.prioridad = c.prioridad;
  if (c.paquete_id !== undefined) body.paquete_id = c.paquete_id || null;
  if (c.sesiones_consumidas !== undefined && c.paquete_id) body.sesiones_consumidas = c.sesiones_consumidas || 1;
  const res = await apiJson<Tarea>(`/api/tareas/${id}`, { method: "PATCH", body: JSON.stringify(body) });
  return res.ok ? { ok: true, tarea: res.data } : { ok: false, error: res.error };
}

/** Elimina una cita (roles de gestión). */
export async function eliminarCita(id: string): Promise<{ ok: boolean; error?: string }> {
  const res = await apiFetch(`/api/tareas/${id}`, { method: "DELETE" });
  if (res.status === 204 || res.ok) return { ok: true };
  const body = await res.json().catch(() => ({}));
  return { ok: false, error: (body as { error?: string }).error ?? `Error ${res.status}` };
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
