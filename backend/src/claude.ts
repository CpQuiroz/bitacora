import Anthropic from "@anthropic-ai/sdk";
import { env } from "./env";
import { supabase } from "./supabase";
import { verificarLimiteIA } from "./limites";
import { crearLimitadorConcurrencia } from "./concurrencia";

export const claude = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });

// Nada limitaba antes cuántas llamadas simultáneas salían a Claude —
// un pico de varias empresas a la vez (ej. todas subiendo fotos de
// una OS al mismo tiempo) podía chocar con los rate limits propios de
// la cuenta de Anthropic. El SDK ya reintenta solo ante un 429, pero
// eso no evita que salgan todas juntas en primer lugar.
const limitarConcurrenciaIA = crearLimitadorConcurrencia(8);

// Etiquetas de feature para ia_uso — una por cada punto de llamada real
// a Claude en el backend (ver Panel de Super-Admin, consumo por empresa).
export type FeatureIA =
  | "analisis_foto"
  | "informe_os"
  | "extraer_guia"
  | "informe_libre"
  | "informe_estructurado"
  | "informe_personalizado"
  | "asistente";

// Nunca bloquea la respuesta si falla — mismo criterio que notificar().
async function registrarUsoIA(empresaId: string, feature: FeatureIA, modelo: string, tokensEntrada: number, tokensSalida: number) {
  try {
    const { error } = await supabase.from("ia_uso").insert({
      empresa_id: empresaId,
      feature,
      modelo,
      tokens_entrada: tokensEntrada,
      tokens_salida: tokensSalida,
    });
    if (error) console.error("Error registrando uso de IA:", error);
  } catch (err) {
    console.error("Error en registrarUsoIA():", err);
  }
}

// Único punto que llama a la API de Claude en todo el backend — así el
// consumo por empresa (Panel de Super-Admin) se instrumenta una sola
// vez en vez de en cada uno de los call sites.
export async function crearMensajeIA(
  empresaId: string,
  feature: FeatureIA,
  params: Anthropic.MessageCreateParamsNonStreaming
): Promise<Anthropic.Message> {
  await verificarLimiteIA(empresaId);
  let response: Anthropic.Message;
  try {
    response = await limitarConcurrenciaIA(() => claude.messages.create(params));
  } catch (err) {
    if (err instanceof Anthropic.RateLimitError) void registrarRateLimit(empresaId, feature);
    throw err;
  }
  void registrarUsoIA(empresaId, feature, response.model, response.usage.input_tokens, response.usage.output_tokens);
  return response;
}

// Un 429 de Anthropic no es un bug del backend, pero sí algo que
// conviene ver en el Panel de Super-Admin si llega a pasar de verdad
// — por eso se loguea acá explícito en vez de depender del handler
// global de errores (que no registra los 4xx, ver server.ts).
async function registrarRateLimit(empresaId: string, feature: FeatureIA) {
  try {
    await supabase.from("errores_backend").insert({
      empresa_id: empresaId,
      ruta: `claude:${feature}`,
      metodo: "POST",
      mensaje: "Rate limit (429) de la API de Claude",
    });
  } catch (err) {
    console.error("Error registrando rate limit de Claude:", err);
  }
}

export interface AnalisisFotoIA {
  resumen: string;
  alerta: boolean;
  detalle_alerta: string | null;
}

const PROMPT_ANALISIS_FOTO = `Eres un asistente que revisa fotos tomadas en terreno por \
choferes/técnicos de una pyme de servicio (transporte, mantención, instalaciones). Mira la \
foto y responde SOLO con un objeto JSON (sin texto antes ni después, sin bloque de código), \
con esta forma exacta:
{"resumen": "descripción corta y objetiva de lo que se ve, en español", "alerta": true o \
false (true si se ve algo que requiere atención: daño, mala instalación, incumplimiento, \
riesgo de seguridad, etc.), "detalle_alerta": "qué se detectó, o null si alerta es false"}`;

export async function analizarFoto(
  empresaId: string,
  base64: string,
  mediaType: "image/jpeg" | "image/png" | "image/webp"
): Promise<AnalisisFotoIA> {
  const response = await crearMensajeIA(empresaId, "analisis_foto", {
    model: "claude-sonnet-5",
    max_tokens: 512,
    messages: [
      {
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: mediaType, data: base64 } },
          { type: "text", text: PROMPT_ANALISIS_FOTO },
        ],
      },
    ],
  });

  const textBlock = response.content.find(
    (b): b is Anthropic.TextBlock => b.type === "text"
  );
  const texto = (textBlock?.text ?? "").trim();

  try {
    const json = JSON.parse(texto);
    return {
      resumen: typeof json.resumen === "string" ? json.resumen : texto,
      alerta: Boolean(json.alerta),
      detalle_alerta: typeof json.detalle_alerta === "string" ? json.detalle_alerta : null,
    };
  } catch {
    return { resumen: texto || "No se pudo analizar la foto", alerta: false, detalle_alerta: null };
  }
}

const PROMPT_INFORME_OS = `Eres un asistente técnico que redacta el informe de una visita de \
servicio en terreno (mantención, instalación, inspección) para pymes chilenas de transporte, \
tratamiento de agua, sistemas contra incendios y rubros similares. Te paso el tipo de servicio, \
los datos medidos por el técnico (con su etiqueta, ya no son datos crudos inventados por ti), el \
checklist realizado, observaciones del técnico, y un resumen de lo que muestran las fotos \
tomadas en terreno. Redacta un informe técnico breve en español, en texto plano (sin markdown, \
sin tablas), con esta estructura:
1) Resumen de la visita (qué se hizo, en 1-2 frases)
2) Estado según los datos medidos — interpreta éstos, no los repitas tal cual (ej. "el pH de 7.2 \
está dentro del rango normal" en vez de solo "pH: 7.2")
3) Hallazgos de las fotos (solo si hay algo relevante — daño, incrustación, sedimento, corrosión, \
buen estado)
4) Recomendación (1-2 frases, concreta y accionable, o "sin observaciones" si todo está normal)
Nunca inventes un valor que no te haya sido entregado. Si falta un dato relevante para evaluar \
el estado, simplemente omítelo — no agregues una nota aparte señalando qué faltó ni ninguna \
sección fuera de las 4 de arriba. Sé conciso — es un informe que un cliente va a leer, no un \
reporte interno.`;

export async function generarInformeOS(empresaId: string, contexto: string): Promise<string | null> {
  try {
    const response = await crearMensajeIA(empresaId, "informe_os", {
      model: "claude-sonnet-5",
      max_tokens: 1024,
      system: PROMPT_INFORME_OS,
      messages: [{ role: "user", content: contexto }],
    });
    const textBlock = response.content.find((b): b is Anthropic.TextBlock => b.type === "text");
    return textBlock?.text?.trim() || null;
  } catch (err) {
    console.error("Error generando informe de OS con IA:", err);
    return null;
  }
}

export interface DatosGuiaIA {
  numero_guia: string | null;
  origen: string | null;
  destino: string | null;
  cliente_nombre: string | null;
}

const PROMPT_EXTRAER_GUIA = `Eres un asistente que lee fotos de guías de despacho chilenas \
(el documento tributario que acompaña un traslado de mercadería) enviadas por un chofer de \
transporte por WhatsApp. Mira la foto y extrae SOLO los datos que aparezcan impresos con \
claridad. Responde SOLO con un objeto JSON (sin texto antes ni después, sin bloque de código), \
con esta forma exacta:
{"numero_guia": "el número de folio de la guía, o null si no se lee", \
"origen": "dirección o comuna de origen del traslado, o null si no aparece", \
"destino": "dirección o comuna de destino, o null si no aparece", \
"cliente_nombre": "el nombre del cliente/receptor (campo 'Señor(es)' o similar), o null si no aparece"}
No inventes ningún dato — si un campo no se lee con claridad, va null.`;

export async function extraerDatosGuia(
  empresaId: string,
  base64: string,
  mediaType: "image/jpeg" | "image/png" | "image/webp"
): Promise<DatosGuiaIA> {
  const response = await crearMensajeIA(empresaId, "extraer_guia", {
    model: "claude-sonnet-5",
    max_tokens: 512,
    messages: [
      {
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: mediaType, data: base64 } },
          { type: "text", text: PROMPT_EXTRAER_GUIA },
        ],
      },
    ],
  });

  const textBlock = response.content.find((b): b is Anthropic.TextBlock => b.type === "text");
  const texto = (textBlock?.text ?? "").trim();

  try {
    const json = JSON.parse(texto);
    return {
      numero_guia: typeof json.numero_guia === "string" ? json.numero_guia : null,
      origen: typeof json.origen === "string" ? json.origen : null,
      destino: typeof json.destino === "string" ? json.destino : null,
      cliente_nombre: typeof json.cliente_nombre === "string" ? json.cliente_nombre : null,
    };
  } catch {
    return { numero_guia: null, origen: null, destino: null, cliente_nombre: null };
  }
}
