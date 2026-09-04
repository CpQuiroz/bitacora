import * as Crypto from "expo-crypto";
import type { AnalisisFoto, Cliente, EstadoTrabajo, OrdenServicio, TipoTrabajo, Trabajo, Usuario } from "@bitacora/shared";
import { apiJson } from "./api";
import { encolar } from "./sync/queue";
import { guardarCache, leerCache } from "./sync/cache";
import type { Ubicacion } from "../lib/geo";

export type ClienteContacto = Pick<Cliente, "id" | "nombre" | "telefono" | "direccion" | "lat" | "lng">;
export type TrabajoConTipo = Trabajo & { tipo_trabajo: TipoTrabajo | null; cliente_info: ClienteContacto | null };
export type FotoConUrl = AnalisisFoto & { url: string };
export type OrdenConFirma = OrdenServicio & { firma_url_firmada: string | null };

export type ListaTrabajos = { trabajos: Trabajo[]; desdeCache: boolean; guardadoEn?: number };

/** Lista de trabajos. `equipo=true` (solo supervisor/admin) trae los de todo el equipo. */
export async function listarTrabajos(equipo: boolean): Promise<ListaTrabajos> {
  const path = equipo ? "/api/trabajos" : "/api/trabajos?propio=true";
  const clave = equipo ? "trabajos:equipo" : "trabajos:propios";
  const res = await apiJson<Trabajo[]>(path);
  if (res.ok) {
    await guardarCache(clave, res.data);
    return { trabajos: res.data, desdeCache: false };
  }
  const cache = await leerCache<Trabajo[]>(clave);
  if (cache) return { trabajos: cache.datos, desdeCache: true, guardadoEn: cache.guardadoEn };
  throw new Error(res.error);
}

export type DetalleTrabajo = {
  trabajo: TrabajoConTipo;
  orden: OrdenConFirma | null;
  fotos: FotoConUrl[];
  desdeCache: boolean;
  guardadoEn?: number;
};

export async function obtenerDetalle(trabajoId: string): Promise<DetalleTrabajo> {
  const clave = `trabajo:${trabajoId}`;
  const [t, o, f] = await Promise.all([
    apiJson<TrabajoConTipo>(`/api/trabajos/${trabajoId}`),
    apiJson<OrdenConFirma>(`/api/trabajos/${trabajoId}/orden`),
    apiJson<FotoConUrl[]>(`/api/trabajos/${trabajoId}/fotos`),
  ]);
  if (t.ok) {
    const detalle = { trabajo: t.data, orden: o.ok ? o.data : null, fotos: f.ok ? f.data : [] };
    await guardarCache(clave, detalle);
    return { ...detalle, desdeCache: false };
  }
  const cache = await leerCache<Omit<DetalleTrabajo, "desdeCache" | "guardadoEn">>(clave);
  if (cache) return { ...cache.datos, desdeCache: true, guardadoEn: cache.guardadoEn };
  throw new Error(t.error);
}

// --- Crear / editar el trabajo (solo roles de gestión) ---
// Van directo contra el servidor (no por la cola): es una acción de
// oficina y necesitamos el id / el error real al toque.

/** Clientes + equipo de la empresa, para los selectores del formulario. */
export async function catalogoParaTrabajo(): Promise<{ clientes: Cliente[]; equipo: Usuario[] }> {
  const [c, e] = await Promise.all([apiJson<Cliente[]>("/api/clientes"), apiJson<Usuario[]>("/api/usuarios")]);
  if (c.ok) await guardarCache("trabajos:clientes", c.data);
  if (e.ok) await guardarCache("trabajos:equipo", e.data);
  const clientes = c.ok ? c.data : (await leerCache<Cliente[]>("trabajos:clientes"))?.datos ?? [];
  const equipo = e.ok ? e.data : (await leerCache<Usuario[]>("trabajos:equipo"))?.datos ?? [];
  return { clientes, equipo };
}

export type BorradorTrabajo = {
  cliente_id: string; // cliente guardado (opcional)
  cliente: string; // nombre a mostrar / facturar (requerido)
  responsable_id: string;
  fecha: string;
  monto: string;
  ubicacion: string;
  codigo: string;
  estado: EstadoTrabajo;
};

function cuerpoTrabajo(b: BorradorTrabajo) {
  return {
    cliente: b.cliente.trim(),
    cliente_id: b.cliente_id || null,
    responsable_id: b.responsable_id || null,
    fecha: b.fecha,
    monto: Number(String(b.monto).replace(/\D/g, "") || 0),
    ubicacion: b.ubicacion.trim() || null,
    codigo: b.codigo.trim() || null,
    estado: b.estado,
  };
}

export async function crearTrabajo(
  b: BorradorTrabajo
): Promise<{ ok: true; trabajo: Trabajo } | { ok: false; error: string }> {
  const res = await apiJson<Trabajo>("/api/trabajos", { method: "POST", body: JSON.stringify(cuerpoTrabajo(b)) });
  return res.ok ? { ok: true, trabajo: res.data } : { ok: false, error: res.error };
}

export async function editarTrabajo(
  id: string,
  b: BorradorTrabajo
): Promise<{ ok: true; trabajo: Trabajo } | { ok: false; error: string }> {
  const res = await apiJson<Trabajo>(`/api/trabajos/${id}`, { method: "PATCH", body: JSON.stringify(cuerpoTrabajo(b)) });
  return res.ok ? { ok: true, trabajo: res.data } : { ok: false, error: res.error };
}

// --- Mutaciones: todas van por la cola (se intentan al toque y se
// reintentan al reconectar). ---

export function encolarCheckin(trabajoId: string, item: "Check-in" | "Check-out", ubic: Ubicacion | null) {
  return encolar({
    etiqueta: item,
    recurso: `trabajo:${trabajoId}`,
    path: `/api/trabajos/${trabajoId}/checklist`,
    method: "POST",
    body: { item, lat: ubic?.lat ?? null, lng: ubic?.lng ?? null, precision_m: ubic?.precision_m ?? null },
  });
}

export function encolarDatos(trabajoId: string, datos: Record<string, string>) {
  return encolar({
    etiqueta: "Formulario",
    recurso: `trabajo:${trabajoId}`,
    path: `/api/trabajos/${trabajoId}`,
    method: "PATCH",
    body: { datos },
  });
}

export function encolarFoto(trabajoId: string, archivo: { uri: string; name: string; type: string }) {
  return encolar({
    etiqueta: "Foto",
    recurso: `trabajo:${trabajoId}`,
    path: `/api/trabajos/${trabajoId}/fotos`,
    method: "POST",
    // foto_id estable: si un reintento tras timeout vuelve a subir la
    // misma foto, el backend devuelve la que ya existe (nunca duplica).
    body: { foto_id: Crypto.randomUUID() },
    archivo: { ...archivo, campo: "foto" },
  });
}

export function encolarFirma(
  trabajoId: string,
  payload: { firma_base64: string; firmante_nombre: string; firmante_documento: string; observaciones_cierre: string }
) {
  return encolar({
    etiqueta: "Firma del cliente",
    recurso: `trabajo:${trabajoId}`,
    path: `/api/trabajos/${trabajoId}/firma`,
    method: "POST",
    body: payload,
  });
}

export function encolarFinalizar(trabajoId: string) {
  return encolar({
    etiqueta: "Finalizar OS",
    recurso: `trabajo:${trabajoId}`,
    path: `/api/trabajos/${trabajoId}/finalizar`,
    method: "POST",
  });
}
