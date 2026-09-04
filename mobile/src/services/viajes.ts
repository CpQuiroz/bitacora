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

export type Foto = { uri: string; name: string; type: string };

export type ResultadoCrearViaje =
  | { ok: true; viaje: ViajeConDatos; fotoPendiente: boolean }
  | { ok: false; error: string; reintentable: boolean };

/**
 * Crea el viaje contra el servidor y devuelve al toque si llegó o si
 * hubo un error real.
 *
 * Clave: los datos del viaje van como **JSON** (rápido, con reintentos,
 * aguanta el arranque en frío de Render). La foto de la guía se sube
 * **aparte**, contra el viaje ya creado — así el viaje nunca se pierde
 * aunque la foto falle o no haya señal. Si la subida de la foto falla,
 * queda en la cola (`fotoPendiente: true`) y se reintenta sola.
 *
 * Si la creación misma falla por señal/servidor → `reintentable: true` y
 * la pantalla manda TODO (viaje + foto) a la cola como respaldo.
 */
export async function crearViaje(b: BorradorViaje, foto?: Foto): Promise<ResultadoCrearViaje> {
  const res = await apiJson<ViajeConDatos>("/api/mis-viajes", {
    method: "POST",
    body: JSON.stringify(cuerpoViaje(b)),
  });

  if (!res.ok) {
    if (res.status === 401) {
      return { ok: false, error: "Tu sesión venció. Sal y vuelve a entrar para registrar el viaje.", reintentable: false };
    }
    // 4xx (validación) = error real, no se reintenta. 0 (red/timeout) o
    // 5xx = transitorio, la pantalla lo encola.
    const reintentable = res.status === 0 || res.status >= 500;
    return { ok: false, error: res.error, reintentable };
  }

  let fotoPendiente = false;
  if (foto) {
    const okFoto = await subirFotoGuia(res.data.id, foto);
    if (!okFoto) {
      await encolarFotoGuia(res.data.id, foto);
      fotoPendiente = true;
    }
  }
  return { ok: true, viaje: res.data, fotoPendiente };
}

/** Sube la foto de la guía a un viaje existente. `true` si quedó guardada. */
export async function subirFotoGuia(viajeId: string, foto: Foto): Promise<boolean> {
  const fd = new FormData();
  fd.append("foto", { uri: foto.uri, name: foto.name, type: foto.type } as unknown as Blob);
  try {
    const res = await apiFetch(`/api/mis-viajes/${viajeId}/foto-guia`, { method: "POST", body: fd }, 45000);
    return res.ok;
  } catch {
    return false;
  }
}

export function encolarFotoGuia(viajeId: string, foto: Foto) {
  return encolar({
    etiqueta: "Foto de la guía",
    recurso: "viajes",
    path: `/api/mis-viajes/${viajeId}/foto-guia`,
    method: "POST",
    body: {},
    archivo: { ...foto, campo: "foto" },
  });
}

/** Respaldo: encola la creación completa del viaje (JSON, + foto si hay). */
export function encolarViaje(borrador: BorradorViaje, foto?: Foto) {
  return encolar({
    etiqueta: "Registrar viaje",
    recurso: "viajes",
    path: "/api/mis-viajes",
    method: "POST",
    body: cuerpoViaje(borrador),
    archivo: foto ? { ...foto, campo: "foto" } : undefined,
  });
}
