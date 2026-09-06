import type { TipoPack } from "@bitacora/shared";
import { apiJson } from "./api";

// Catálogo de tipos de pack (Agenda Pro). Se administra desde la web y
// desde móvil (pantalla "Servicios y packs" en Más). Móvil lo consume
// para vender un paquete (soloActivos=true, default) y para mostrar de
// qué tipo salió un pack ya vendido (soloActivos=false).
export async function listarTiposPack(soloActivos = true): Promise<TipoPack[]> {
  const res = await apiJson<TipoPack[]>(`/api/tipos-pack${soloActivos ? "?activo=1" : ""}`);
  return res.ok ? res.data : [];
}

export type BorradorTipoPack = {
  nombre: string;
  cantidad_sesiones: number;
  precio: number | null;
  servicio_id: string | null;
  vigencia_dias: number | null;
};

export async function crearTipoPack(
  b: BorradorTipoPack
): Promise<{ ok: true; tipoPack: TipoPack } | { ok: false; error: string }> {
  const res = await apiJson<TipoPack>("/api/tipos-pack", { method: "POST", body: JSON.stringify(b) });
  return res.ok ? { ok: true, tipoPack: res.data } : { ok: false, error: res.error };
}

export async function editarTipoPack(
  id: string,
  cambios: Partial<BorradorTipoPack & { activo: boolean }>
): Promise<{ ok: true; tipoPack: TipoPack } | { ok: false; error: string }> {
  const res = await apiJson<TipoPack>(`/api/tipos-pack/${id}`, { method: "PATCH", body: JSON.stringify(cambios) });
  return res.ok ? { ok: true, tipoPack: res.data } : { ok: false, error: res.error };
}
