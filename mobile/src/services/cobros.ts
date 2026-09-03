import * as Crypto from "expo-crypto";
import type { Cliente, Factura, MedioPago } from "@bitacora/shared";
import { apiFetch, apiJson } from "./api";
import { guardarCache, leerCache } from "./sync/cache";

export type CobroConCliente = Factura & { cliente_info?: Pick<Cliente, "id" | "nombre" | "correo" | "telefono"> | null };

/** Un cobro pendiente cuya fecha de vencimiento ya pasó cuenta como "vencido" (lo decide la fecha, no el campo estado). */
export function estaVencido(f: Factura, hoy = new Date().toISOString().slice(0, 10)): boolean {
  return f.estado === "pendiente" && f.fecha_vencimiento < hoy;
}

export async function listarCobros(): Promise<{ cobros: CobroConCliente[]; desdeCache: boolean; guardadoEn?: number }> {
  const res = await apiJson<CobroConCliente[]>("/api/cobros");
  if (res.ok) {
    await guardarCache("gestion:cobros", res.data);
    return { cobros: res.data, desdeCache: false };
  }
  const cache = await leerCache<CobroConCliente[]>("gestion:cobros");
  if (cache) return { cobros: cache.datos, desdeCache: true, guardadoEn: cache.guardadoEn };
  throw new Error(res.error);
}

export async function obtenerCobro(id: string): Promise<CobroConCliente> {
  const res = await apiJson<CobroConCliente>(`/api/cobros/${id}`);
  if (!res.ok) throw new Error(res.error);
  return res.data;
}

export type BorradorCobro = {
  cliente_id: string;
  monto: string;
  fecha_emision: string;
  fecha_vencimiento: string;
  medio_pago: MedioPago | "";
};

/**
 * Crea un cobro. Lleva Idempotency-Key propia y `apiFetch` reintenta ante
 * fallo transitorio: si el primer intento no confirma, se reintenta sin
 * riesgo de duplicar el cobro.
 */
export async function crearCobro(b: BorradorCobro): Promise<{ ok: true; cobro: CobroConCliente } | { ok: false; error: string }> {
  const res = await apiFetch(
    "/api/cobros",
    {
      method: "POST",
      headers: { "Idempotency-Key": Crypto.randomUUID().replace(/-/g, "") },
      body: JSON.stringify({
        cliente_id: b.cliente_id,
        monto: Number(b.monto.replace(/\D/g, "")),
        fecha_emision: b.fecha_emision,
        fecha_vencimiento: b.fecha_vencimiento,
        medio_pago: b.medio_pago || null,
      }),
    },
    30000
  );
  const data = (await res.json().catch(() => ({}))) as CobroConCliente & { error?: string };
  return res.ok ? { ok: true, cobro: data } : { ok: false, error: data.error ?? `Error ${res.status}` };
}

export async function marcarPagado(
  id: string,
  datos: { fecha_pago: string; medio_pago: MedioPago | ""; valor_recibido?: string; observaciones_pago?: string }
): Promise<{ ok: true; cobro: CobroConCliente } | { ok: false; error: string }> {
  const res = await apiJson<CobroConCliente>(`/api/cobros/${id}`, {
    method: "PATCH",
    body: JSON.stringify({
      estado: "pagada",
      fecha_pago: datos.fecha_pago,
      medio_pago: datos.medio_pago || null,
      valor_recibido: datos.valor_recibido ? Number(datos.valor_recibido.replace(/\D/g, "")) : null,
      observaciones_pago: datos.observaciones_pago?.trim() || null,
    }),
  });
  return res.ok ? { ok: true, cobro: res.data } : { ok: false, error: res.error };
}

export async function reabrirCobro(id: string): Promise<{ ok: true; cobro: CobroConCliente } | { ok: false; error: string }> {
  const res = await apiJson<CobroConCliente>(`/api/cobros/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ estado: "pendiente" }),
  });
  return res.ok ? { ok: true, cobro: res.data } : { ok: false, error: res.error };
}
