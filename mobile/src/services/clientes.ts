import type { Cliente } from "@bitacora/shared";
import { apiJson } from "./api";
import { guardarCache, leerCache } from "./sync/cache";

export type ClienteConActividad = Cliente & {
  cantidad_os?: number;
  cantidad_cotizaciones?: number;
  ultima_actividad?: string | null;
};

export async function listarClientes(): Promise<{ clientes: ClienteConActividad[]; desdeCache: boolean; guardadoEn?: number }> {
  const res = await apiJson<ClienteConActividad[]>("/api/clientes");
  if (res.ok) {
    await guardarCache("gestion:clientes", res.data);
    return { clientes: res.data, desdeCache: false };
  }
  const cache = await leerCache<ClienteConActividad[]>("gestion:clientes");
  if (cache) return { clientes: cache.datos, desdeCache: true, guardadoEn: cache.guardadoEn };
  throw new Error(res.error);
}

export async function obtenerCliente(id: string): Promise<Cliente> {
  const res = await apiJson<Cliente>(`/api/clientes/${id}`);
  if (!res.ok) throw new Error(res.error);
  return res.data;
}

export type BorradorCliente = {
  nombre: string;
  rut: string;
  direccion: string;
  comuna: string;
  telefono: string;
  correo: string;
  notas: string;
};

type Resultado = { ok: true; cliente: Cliente } | { ok: false; error: string };

export async function crearCliente(b: BorradorCliente): Promise<Resultado> {
  const res = await apiJson<Cliente>("/api/clientes", { method: "POST", body: JSON.stringify(cuerpo(b)) });
  return res.ok ? { ok: true, cliente: res.data } : { ok: false, error: res.error };
}

export async function editarCliente(id: string, b: BorradorCliente & { activo?: boolean }): Promise<Resultado> {
  const res = await apiJson<Cliente>(`/api/clientes/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ ...cuerpo(b), ...(b.activo !== undefined ? { activo: b.activo } : {}) }),
  });
  return res.ok ? { ok: true, cliente: res.data } : { ok: false, error: res.error };
}

function cuerpo(b: BorradorCliente) {
  return {
    nombre: b.nombre.trim(),
    rut: b.rut.trim() || null,
    direccion: b.direccion.trim(),
    comuna: b.comuna.trim() || null,
    telefono: b.telefono.trim() || null,
    correo: b.correo.trim() || null,
    notas: b.notas.trim() || null,
  };
}
