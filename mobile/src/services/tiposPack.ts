import type { TipoPack } from "@bitacora/shared";
import { apiJson } from "./api";

// Catálogo de tipos de pack (se administra en la web, Configuración →
// Agenda Pro) — móvil solo lo consume para no tipear nombre/cantidad a
// mano al vender un paquete. Solo trae los vigentes.
export async function listarTiposPack(): Promise<TipoPack[]> {
  const res = await apiJson<TipoPack[]>("/api/tipos-pack?activo=1");
  return res.ok ? res.data : [];
}
