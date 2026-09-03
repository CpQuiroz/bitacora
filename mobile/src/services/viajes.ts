import type { Cliente, Equipo, Viaje } from "@bitacora/shared";
import { apiJson } from "./api";
import { encolar } from "./sync/queue";
import { guardarCache, leerCache } from "./sync/cache";

export type ViajeConDatos = Viaje & { cliente_info?: Pick<Cliente, "id" | "nombre"> | null };

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

export function encolarViaje(borrador: BorradorViaje, foto?: { uri: string; name: string; type: string }) {
  return encolar({
    etiqueta: "Registrar viaje",
    recurso: "viajes",
    path: "/api/mis-viajes",
    method: "POST",
    body: {
      cliente_id: borrador.cliente_id,
      numero_guia: borrador.numero_guia,
      origen: borrador.origen,
      destino: borrador.destino,
      equipo_id: borrador.equipo_id || null,
      km_inicial: borrador.km_inicial || null,
      km_final: borrador.km_final || null,
      subtotal: borrador.subtotal,
      aplica_iva: borrador.aplica_iva,
    },
    archivo: foto ? { ...foto, campo: "foto" } : undefined,
  });
}
