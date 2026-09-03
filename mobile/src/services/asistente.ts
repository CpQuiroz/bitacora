import type { MensajeAsistente } from "@bitacora/shared";
import { apiFetch, apiJson } from "./api";

export async function historialAsistente(): Promise<MensajeAsistente[]> {
  const res = await apiJson<MensajeAsistente[]>("/api/asistente");
  if (!res.ok) throw new Error(res.error);
  return res.data;
}

export type EnvioAsistente =
  | { ok: true; respuesta: MensajeAsistente }
  | { ok: false; error: string; timeout: boolean };

/**
 * Manda un mensaje al asistente. No es streaming y puede tardar (usa
 * herramientas + Claude, más el cold start de Render) — por eso 90s de
 * timeout y SIN reintento: el backend guarda el mensaje del usuario
 * antes de llamar a la IA, así que un reintento duplicaría.
 */
export async function enviarAlAsistente(mensaje: string): Promise<EnvioAsistente> {
  try {
    const res = await apiFetch("/api/asistente/mensaje", { method: "POST", body: JSON.stringify({ mensaje }) }, 90000);
    const data = (await res.json().catch(() => ({}))) as MensajeAsistente & { error?: string };
    if (res.ok) return { ok: true, respuesta: data };
    return { ok: false, error: data.error ?? `Error ${res.status}`, timeout: false };
  } catch (e) {
    const timeout = e instanceof Error && e.name === "AbortError";
    return {
      ok: false,
      timeout,
      error: timeout
        ? "El asistente está tardando más de lo normal. Refresca en unos segundos para ver si respondió."
        : "No se pudo conectar con el asistente.",
    };
  }
}

export async function borrarHistorialAsistente(): Promise<void> {
  await apiFetch("/api/asistente", { method: "DELETE" });
}
