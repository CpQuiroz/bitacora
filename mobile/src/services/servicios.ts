import type { Servicio } from "@bitacora/shared";
import { apiJson } from "./api";

// Catálogo de servicios (se administra en la web, Configuración →
// Agenda Pro) — móvil lo consume para Nueva reserva (soloActivos=true,
// default) y para mostrar el servicio de una cita ya creada, aunque ese
// servicio se haya descontinuado después (soloActivos=false).
export async function listarServicios(soloActivos = true): Promise<Servicio[]> {
  const res = await apiJson<Servicio[]>(`/api/servicios${soloActivos ? "?activo=1" : ""}`);
  return res.ok ? res.data : [];
}
