// ============================================================
// BITÁCORA — Cliente delgado de la Cloud API de WhatsApp (Meta).
// Todas las funciones son no-throw hacia el llamador salvo que se
// indique lo contrario: si faltan credenciales (WHATSAPP_ACCESS_TOKEN
// etc.) o falla la llamada a Meta, se loguea y se devuelve un valor
// "vacío" en vez de romper el webhook — un fallo acá nunca debe
// tumbar el resto del backend.
// ============================================================
import crypto from "node:crypto";
import { env } from "./env";

const GRAPH_VERSION = "v21.0";
const GRAPH_URL = `https://graph.facebook.com/${GRAPH_VERSION}`;

export function normalizarTelefono(tel: string | null | undefined): string {
  return (tel ?? "").replace(/\D/g, "");
}

// Meta firma el body crudo del webhook con HMAC-SHA256 usando el App
// Secret — hay que verificarlo con el body EXACTO que llegó (bytes),
// nunca con el JSON re-serializado (ver server.ts, verify callback de
// express.json()).
export function verificarFirmaWebhook(rawBody: Buffer, firmaHeader: string | undefined): boolean {
  if (!env.WHATSAPP_APP_SECRET) return false;
  if (!firmaHeader || !firmaHeader.startsWith("sha256=")) return false;
  const firmaRecibida = firmaHeader.slice("sha256=".length);
  const firmaEsperada = crypto.createHmac("sha256", env.WHATSAPP_APP_SECRET).update(rawBody).digest("hex");
  try {
    return crypto.timingSafeEqual(Buffer.from(firmaRecibida, "hex"), Buffer.from(firmaEsperada, "hex"));
  } catch {
    return false;
  }
}

// Devuelve { ok, error } en vez de lanzar — mismo criterio "no-throw"
// del resto del archivo, pero el resultado sí se propaga (a diferencia
// de antes) para que un llamador que necesite registrar el intento
// (ej. notificarCliente.ts) pueda distinguir éxito de fallo sin tener
// que duplicar la llamada a fetch.
export async function enviarMensajeWhatsapp(to: string, texto: string): Promise<{ ok: boolean; error?: string }> {
  if (!env.WHATSAPP_ACCESS_TOKEN || !env.WHATSAPP_PHONE_NUMBER_ID) {
    const error = "WhatsApp no configurado (falta WHATSAPP_ACCESS_TOKEN/WHATSAPP_PHONE_NUMBER_ID)";
    console.warn(`${error} — se omite el envío de:`, texto);
    return { ok: false, error };
  }
  try {
    const res = await fetch(`${GRAPH_URL}/${env.WHATSAPP_PHONE_NUMBER_ID}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.WHATSAPP_ACCESS_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to,
        type: "text",
        text: { body: texto },
      }),
    });
    if (!res.ok) {
      const detalle = await res.text().catch(() => "");
      console.error("Error enviando mensaje de WhatsApp:", res.status, detalle);
      return { ok: false, error: `Meta respondió ${res.status}: ${detalle.slice(0, 200)}` };
    }
    return { ok: true };
  } catch (err) {
    console.error("Error de red enviando mensaje de WhatsApp:", err);
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function descargarMediaWhatsapp(
  mediaId: string
): Promise<{ buffer: Buffer; mimeType: string } | null> {
  if (!env.WHATSAPP_ACCESS_TOKEN) {
    console.warn("WhatsApp no configurado — no se puede descargar el media", mediaId);
    return null;
  }
  try {
    const resMeta = await fetch(`${GRAPH_URL}/${mediaId}`, {
      headers: { Authorization: `Bearer ${env.WHATSAPP_ACCESS_TOKEN}` },
    });
    if (!resMeta.ok) return null;
    const meta = (await resMeta.json()) as { url?: unknown; mime_type?: unknown };
    if (typeof meta.url !== "string") return null;

    const resArchivo = await fetch(meta.url, {
      headers: { Authorization: `Bearer ${env.WHATSAPP_ACCESS_TOKEN}` },
    });
    if (!resArchivo.ok) return null;
    const buffer = Buffer.from(await resArchivo.arrayBuffer());
    const mimeType = typeof meta.mime_type === "string" ? meta.mime_type : "image/jpeg";
    return { buffer, mimeType };
  } catch (err) {
    console.error("Error descargando media de WhatsApp:", err);
    return null;
  }
}

// ------------------------------------------------------------
// Formas del payload del webhook que realmente usamos (recorte del
// esquema completo de Meta — solo lo necesario).
// ------------------------------------------------------------
export type MensajeEntranteWhatsapp = {
  id: string;
  from: string;
  type: string;
  timestamp?: string;
  text?: { body: string };
  image?: { id: string; mime_type: string };
};

export function extraerMensajes(payload: unknown): MensajeEntranteWhatsapp[] {
  const mensajes: MensajeEntranteWhatsapp[] = [];
  const entries = (payload as { entry?: unknown[] })?.entry;
  if (!Array.isArray(entries)) return mensajes;
  for (const entry of entries) {
    const changes = (entry as { changes?: unknown[] })?.changes;
    if (!Array.isArray(changes)) continue;
    for (const change of changes) {
      const value = (change as { value?: unknown })?.value as { messages?: unknown[] } | undefined;
      if (!value?.messages || !Array.isArray(value.messages)) continue;
      for (const m of value.messages) mensajes.push(m as MensajeEntranteWhatsapp);
    }
  }
  return mensajes;
}
