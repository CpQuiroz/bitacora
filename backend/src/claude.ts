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
