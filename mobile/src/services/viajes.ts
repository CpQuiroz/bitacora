import type { Cliente, Equipo, Viaje } from "@bitacora/shared";
import { apiFetch, apiJson } from "./api";
import { encolar } from "./sync/queue";
import { guardarCache, leerCache } from "./sync/cache";

export type ViajeConDatos = Viaje & {
  cliente_info?: Pick<Cliente, "id" | "nombre"> | null;
  chofer?: { id: string; nombre: string } | null;
};

export type ViajeDetalle = ViajeConDatos & {
  equipo_info?: { nombre: string; patente: string | null } | null;
  foto_guia_url_firmada: string | null;
};

export async function obtenerViaje(id: string): Promise<{ viaje: ViajeDetalle; desdeCache: boolean; guardadoEn?: number }> {
  const clave = `viaje:${id}`;
  const res = await apiJson<ViajeDetalle>(`/api/mis-viajes/${id}`);
  if (res.ok) {
    await guardarCache(clave, res.data);
    return { viaje: res.data, desdeCache: false };
  }
  const cache = await leerCache<ViajeDetalle>(clave);
  if (cache) return { viaje: cache.datos, desdeCache: true, guardadoEn: cache.guardadoEn };
  throw new Error(res.error);
}

export async function listarViajesPropios(): Promise<{ viajes: ViajeConDatos[]; desdeCache: boolean; guardadoEn?: number }> {
  const res = await apiJson<ViajeConDatos[]>("/api/mis-viajes");
  if (res.ok) {
    await guardarCache("viajes:mios", res.data);
    return { viajes: res.data, desdeCache: false };
  }
  const cache = await leerCache<ViajeConDatos[]>("viajes:mios");
  if (cache) return { viajes: cache.datos, desdeCache: true, guardadoEn: cache.guardadoEn };
  throw new Error(res.error);
}

/** Todos los viajes de la empresa (solo roles de gestión). */
export async function listarViajesEquipo(): Promise<{ viajes: ViajeConDatos[]; desdeCache: boolean; guardadoEn?: number }> {
  const res = await apiJson<ViajeConDatos[]>("/api/mis-viajes?equipo=true");
  if (res.ok) {
    await guardarCache("viajes:equipo", res.data);
    return { viajes: res.data, desdeCache: false };
  }
  const cache = await leerCache<ViajeConDatos[]>("viajes:equipo");
  if (cache) return { viajes: cache.datos, desdeCache: true, guardadoEn: cache.guardadoEn };
  throw new Error(res.error);
}

/** Aprueba un viaje en borrador (gestión). */
export async function aprobarViaje(id: string): Promise<{ ok: boolean; error?: string }> {
  const res = await apiJson<Viaje>(`/api/mis-viajes/${id}`, { method: "PATCH", body: JSON.stringify({ estado: "confirmado" }) });
  return res.ok ? { ok: true } : { ok: false, error: res.error };
}

/** Rechaza (elimina) un viaje (gestión). */
export async function rechazarViaje(id: string): Promise<{ ok: boolean; error?: string }> {
  const res = await apiFetch(`/api/mis-viajes/${id}`, { method: "DELETE" });
  if (res.status === 204 || res.ok) return { ok: true };
  const body = await res.json().catch(() => ({}));
  return { ok: false, error: (body as { error?: string }).error ?? `Error ${res.status}` };
}

export type EdicionViaje = Partial<
  Pick<BorradorViaje, "numero_guia" | "origen" | "destino" | "cliente_id" | "km_inicial" | "km_final" | "subtotal" | "aplica_iva">
> & { comentarios?: string };

/** Edita un viaje del equipo (gestión). */
export async function editarViaje(id: string, c: EdicionViaje): Promise<{ ok: true; viaje: ViajeConDatos } | { ok: false; error: string }> {
  const body: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(c)) if (v !== undefined) body[k] = v === "" ? null : v;
  const res = await apiJson<ViajeConDatos>(`/api/mis-viajes/${id}`, { method: "PATCH", body: JSON.stringify(body) });
  return res.ok ? { ok: true, viaje: res.data } : { ok: false, error: res.error };
}

/** Clientes + equipos de la empresa, para los selectores del formulario. */
export async function catalogoParaViaje(): Promise<{ clientes: Cliente[]; equipos: Equipo[] }> {
  const [c, e] = await Promise.all([apiJson<Cliente[]>("/api/clientes"), apiJson<Equipo[]>("/api/equipos")]);
  if (c.ok) await guardarCache("viajes:clientes", c.data);
  if (e.ok) await guardarCache("viajes:equipos", e.data);
  const clientes = c.ok ? c.data : (await leerCache<Cliente[]>("viajes:clientes"))?.datos ?? [];
  const equipos = e.ok ? e.data : (await leerCache<Equipo[]>("viajes:equipos"))?.datos ?? [];
  return { clientes, equipos };
}

export type BorradorViaje = {
  cliente_id: string;
  numero_guia: string;
  origen: string;
  destino: string;
  equipo_id?: string | null;
  km_inicial?: string;
  km_final?: string;
  subtotal: string;
  aplica_iva: boolean;
};

function cuerpoViaje(b: BorradorViaje) {
  return {
    cliente_id: b.cliente_id,
    numero_guia: b.numero_guia,
    origen: b.origen,
    destino: b.destino,
    equipo_id: b.equipo_id || null,
    km_inicial: b.km_inicial || null,
    km_final: b.km_final || null,
    subtotal: b.subtotal,
    aplica_iva: b.aplica_iva,
  };
}

export type ResultadoCrearViaje =
  | { ok: true; viaje: ViajeConDatos }
  | { ok: false; error: string; reintentable: boolean };

/**
 * Crea el viaje directo contra el servidor (no por la cola): así el
 * chofer sabe al toque si llegó a la oficina o si hubo un error real.
 * Si falla por señal/servidor, `reintentable: true` y la pantalla lo
 * manda a la cola como respaldo.
 */
export async function crearViaje(
  b: BorradorViaje,
  foto?: { uri: string; name: string; type: string }
): Promise<ResultadoCrearViaje> {
  const fd = new FormData();
  const c = cuerpoViaje(b);
  fd.append("cliente_id", c.cliente_id);
  fd.append("numero_guia", c.numero_guia);
  fd.append("origen", c.origen);
  fd.append("destino", c.destino);
  if (c.equipo_id) fd.append("equipo_id", c.equipo_id);
  if (c.km_inicial) fd.append("km_inicial", c.km_inicial);
  if (c.km_final) fd.append("km_final", c.km_final);
  fd.append("subtotal", c.subtotal);
  fd.append("aplica_iva", String(c.aplica_iva));
  if (foto) fd.append("foto", { uri: foto.uri, name: foto.name, type: foto.type } as unknown as Blob);

  try {
    const res = await apiFetch("/api/mis-viajes", { method: "POST", body: fd }, 45000);
    const data = (await res.json().catch(() => ({}))) as ViajeConDatos & { error?: string };
    if (res.ok) return { ok: true, viaje: data };
    if (res.status >= 500) {
      return { ok: false, error: data.error ?? "El servidor no respondió bien", reintentable: true };
    }
    return { ok: false, error: data.error ?? `Error ${res.status}`, reintentable: false };
  } catch {
    return { ok: false, error: "sin-conexion", reintentable: true };
  }
}

export function encolarViaje(borrador: BorradorViaje, foto?: { uri: string; name: string; type: string }) {
  return encolar({
    etiqueta: "Registrar viaje",
    recurso: "viajes",
    path: "/api/mis-viajes",
    method: "POST",
    body: cuerpoViaje(borrador),
    archivo: foto ? { ...foto, campo: "foto" } : undefined,
  });
}
