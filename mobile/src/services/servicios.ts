import type { Servicio } from "@bitacora/shared";
import { apiJson } from "./api";

// Catálogo de servicios (se administra en la web, Configuración →
// Agenda Pro) — móvil solo lo consume para Nueva reserva. Solo trae los
// vigentes.
export async function listarServicios(): Promise<Servicio[]> {
  const res = await apiJson<Servicio[]>("/api/servicios?activo=1");
  return res.ok ? res.data : [];
}
