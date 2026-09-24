// ============================================================
// Viajes ↔ cobros (tabla facturas). Un viaje facturado apunta a su cobro
// con viajes.factura_id; el cobro guarda la lista en facturas.viaje_ids.
// ============================================================
import { supabase } from "./supabase";

// Cobro al que pertenece un viaje ya facturado — para decirle al usuario
// por qué no puede editarlo y en qué cobro está (tarea 132).
export async function cobroDeViaje(empresaId: string, facturaId: string | null) {
  if (!facturaId) return null;
  const { data } = await supabase.from("facturas").select("id, folio, estado").eq("empresa_id", empresaId).eq("id", facturaId).maybeSingle();
  return data;
}
