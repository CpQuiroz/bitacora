import { supabase } from "./supabase";

// Folios propios de Cita/Viaje/Levantamiento (migración 108) — mismo
// mecanismo atómico que ya usan siguiente_folio_os/siguiente_folio_
// mantencion/siguiente_numero_cotizacion (contador por empresa +
// función que incrementa y devuelve, sin choques entre requests
// concurrentes). El prefijo ("OS-", "LEV-"...) se arma solo al mostrar
// (formatearFolio, @bitacora/shared) — acá se guarda el número plano.
//
// Deliberadamente tolerante a errores (a diferencia de un alta manual
// donde SÍ tiene sentido fallar fuerte si no se puede asignar folio):
// varios de los puntos de creación son flujos automáticos (bot de
// WhatsApp, captura por webhook) donde perder el folio es mucho menos
// grave que perder la fila entera — se loguea y sigue con folio null.
async function siguienteFolio(fn: "siguiente_folio_cita" | "siguiente_folio_viaje" | "siguiente_folio_levantamiento", empresaId: string): Promise<number | null> {
  const { data, error } = await supabase.rpc(fn, { p_empresa_id: empresaId });
  if (error) {
    console.error(`${fn}:`, error.message);
    return null;
  }
  return typeof data === "number" ? data : null;
}

export const siguienteFolioCita = (empresaId: string) => siguienteFolio("siguiente_folio_cita", empresaId);
export const siguienteFolioViaje = (empresaId: string) => siguienteFolio("siguiente_folio_viaje", empresaId);
export const siguienteFolioLevantamiento = (empresaId: string) => siguienteFolio("siguiente_folio_levantamiento", empresaId);
