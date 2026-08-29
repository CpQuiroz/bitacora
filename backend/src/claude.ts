import Anthropic from "@anthropic-ai/sdk";
import { env } from "./env";

export const claude = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });

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
  base64: string,
  mediaType: "image/jpeg" | "image/png" | "image/webp"
): Promise<AnalisisFotoIA> {
  const response = await claude.messages.create({
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

export async function generarInformeOS(contexto: string): Promise<string | null> {
  try {
    const response = await claude.messages.create({
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
  base64: string,
  mediaType: "image/jpeg" | "image/png" | "image/webp"
): Promise<DatosGuiaIA> {
  const response = await claude.messages.create({
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
