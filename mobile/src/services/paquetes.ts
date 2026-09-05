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

// Vender/asignar un pack a un cliente = crear una INSTANCIA. Si viene
// tipo_pack_id, el backend copia nombre/cantidad/precio/vigencia del
// catálogo (lo que se manda acá para esos campos se ignora).
export async function crearPaquete(b: {
  cliente_id: string;
  tipo_pack_id?: string;
  nombre: string;
  cantidad_total: number;
  precio_pagado?: number | null;
}): Promise<{ ok: true; paquete: PaqueteSesiones } | { ok: false; error: string }> {
  const res = await apiJson<PaqueteSesiones>("/api/paquetes-sesiones", {
    method: "POST",
    body: JSON.stringify({
      cliente_id: b.cliente_id,
      tipo_pack_id: b.tipo_pack_id || null,
      nombre: b.nombre.trim(),
      cantidad_total: b.cantidad_total,
      precio_pagado: b.precio_pagado ?? null,
    }),
  });
  return res.ok ? { ok: true, paquete: res.data } : { ok: false, error: res.error };
}
