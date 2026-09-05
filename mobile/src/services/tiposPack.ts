import type { TipoPack } from "@bitacora/shared";
import { apiJson } from "./api";

// Catálogo de tipos de pack (se administra en la web, Configuración →
// Agenda Pro) — móvil lo consume para vender un paquete (soloActivos=true,
// default) y para mostrar de qué tipo salió un pack ya vendido, aunque
// ese tipo se haya descontinuado después (soloActivos=false).
export async function listarTiposPack(soloActivos = true): Promise<TipoPack[]> {
  const res = await apiJson<TipoPack[]>(`/api/tipos-pack${soloActivos ? "?activo=1" : ""}`);
  return res.ok ? res.data : [];
}
