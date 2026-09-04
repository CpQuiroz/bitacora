import type { PaqueteSesiones, PaqueteSesionesConSaldo } from "@bitacora/shared";
import { apiJson } from "./api";
import { guardarCache, leerCache } from "./sync/cache";

/** Paquetes de sesiones (Agenda Pro) de un cliente, con el saldo restante. */
export async function listarPaquetesCliente(clienteId: string): Promise<PaqueteSesionesConSaldo[]> {
  const clave = `paquetes:${clienteId}`;
  const res = await apiJson<PaqueteSesionesConSaldo[]>(`/api/paquetes-sesiones?cliente_id=${clienteId}`);
  if (res.ok) {
    await guardarCache(clave, res.data);
    return res.data;
  }
  return (await leerCache<PaqueteSesionesConSaldo[]>(clave))?.datos ?? [];
}

export async function crearPaquete(b: {
  cliente_id: string;
  nombre: string;
  cantidad_total: number;
}): Promise<{ ok: true; paquete: PaqueteSesiones } | { ok: false; error: string }> {
  const res = await apiJson<PaqueteSesiones>("/api/paquetes-sesiones", {
    method: "POST",
    body: JSON.stringify({ cliente_id: b.cliente_id, nombre: b.nombre.trim(), cantidad_total: b.cantidad_total }),
  });
  return res.ok ? { ok: true, paquete: res.data } : { ok: false, error: res.error };
}
