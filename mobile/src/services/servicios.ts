import type { Servicio } from "@bitacora/shared";
import { apiJson } from "./api";

// Catálogo de servicios (Agenda Pro). Se administra en la web
// (Configuración → Agenda Pro) y también desde móvil, al vuelo, en
// "Nueva reserva". Móvil lo consume con soloActivos=true (default) para
// el selector, o false para mostrar el servicio de una cita vieja aunque
// se haya descontinuado.
export async function listarServicios(soloActivos = true): Promise<Servicio[]> {
  const res = await apiJson<Servicio[]>(`/api/servicios${soloActivos ? "?activo=1" : ""}`);
  return res.ok ? res.data : [];
}

export type BorradorServicio = { nombre: string; precio: number; duracion_sugerida_min: number };

export async function crearServicio(
  b: BorradorServicio
): Promise<{ ok: true; servicio: Servicio } | { ok: false; error: string }> {
  const res = await apiJson<Servicio>("/api/servicios", { method: "POST", body: JSON.stringify(b) });
  return res.ok ? { ok: true, servicio: res.data } : { ok: false, error: res.error };
}

export async function editarServicio(
  id: string,
  cambios: Partial<BorradorServicio & { activo: boolean }>
): Promise<{ ok: true; servicio: Servicio } | { ok: false; error: string }> {
  const res = await apiJson<Servicio>(`/api/servicios/${id}`, { method: "PATCH", body: JSON.stringify(cambios) });
  return res.ok ? { ok: true, servicio: res.data } : { ok: false, error: res.error };
}
