import { DOCUMENTOS_LEGALES, DOCUMENTOS_LEGALES_VERSION } from "@bitacora/shared";
import { supabase } from "./supabase";

// Ley 21.719 — registro de aceptación de la Política de Privacidad y los
// Términos. Ver migración 79. Insert-only: cada aceptación es una fila
// nueva, nunca se actualiza ni borra.

type Titular =
  | { usuarioId: string; clienteId?: undefined }
  | { clienteId: string; usuarioId?: undefined };

export async function registrarConsentimiento(
  titular: Titular,
  contexto: { empresaId?: string | null; ip?: string | null; userAgent?: string | null }
): Promise<void> {
  const filas = DOCUMENTOS_LEGALES.map((documento) => ({
    usuario_id: titular.usuarioId ?? null,
    cliente_id: titular.clienteId ?? null,
    empresa_id: contexto.empresaId ?? null,
    documento,
    version: DOCUMENTOS_LEGALES_VERSION,
    ip: contexto.ip ?? null,
    user_agent: contexto.userAgent ?? null,
  }));
  const { error } = await supabase.from("consentimientos").insert(filas as never);
  if (error) console.error("registrarConsentimiento:", error.message);
}

/** ¿La persona ya aceptó AMBOS documentos en la versión vigente? */
export async function tieneConsentimientoVigente(usuarioId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from("consentimientos")
    .select("documento")
    .eq("usuario_id", usuarioId)
    .eq("version", DOCUMENTOS_LEGALES_VERSION);
  if (error) {
    console.error("tieneConsentimientoVigente:", error.message);
    return true; // ante un error de lectura, no bloquear al usuario
  }
  const aceptados = new Set((data ?? []).map((f) => f.documento));
  return DOCUMENTOS_LEGALES.every((d) => aceptados.has(d));
}
