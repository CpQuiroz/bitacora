import { Router } from "express";
import multer from "multer";
import Anthropic from "@anthropic-ai/sdk";
import { claude } from "../claude";
import { supabase } from "../supabase";
import type { RequestConEmpresa } from "../empresa";
import { ah } from "../asyncHandler";

export const informeRouter = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 5 },
  fileFilter: (_req, file, cb) => {
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.mimetype)) {
      cb(new Error("Formato de imagen no soportado (usa jpeg, png o webp)"));
      return;
    }
    cb(null, true);
  },
});

const SYSTEM_PROMPT = `Eres un asistente financiero para dueños de pymes de servicio en \
terreno en Chile (transporte, técnicos de mantención, instaladores). Te paso datos reales \
de trabajos y facturas de una empresa y generas un informe ejecutivo breve en español, en \
texto plano (sin tablas markdown), con esta estructura:
1) Resumen de actividad reciente
2) Estado de facturación (pendiente / vencida / pagada)
3) Alertas o riesgos (facturas vencidas, concentración de clientes, caída de actividad, etc.)
4) Una recomendación concreta y accionable
Sé conciso y directo — el dueño lo va a leer en menos de un minuto.

A veces el usuario adjunta imágenes (fotos de recibos, boletas, trabajos, etc.) y/o \
instrucciones adicionales — si vienen, tómalas en cuenta y ajusta el informe según lo que \
pida (por ejemplo: enfocarse en un cliente, comparar periodos, ignorar cierta sección).`;

// Informe ejecutivo con IA (Claude API), a partir de los trabajos y
// facturas reales de la empresa del usuario logueado. Acepta además
// instrucciones libres del usuario e imágenes que la IA debe considerar.
informeRouter.post(
  "/",
  upload.array("imagenes", 5),
  ah<RequestConEmpresa>(async (req, res) => {
    const instrucciones = typeof req.body?.instrucciones === "string" ? req.body.instrucciones.trim() : "";
    const imagenes = (req.files as Express.Multer.File[] | undefined) ?? [];

    const [trabajosRes, facturasRes, empresaRes] = await Promise.all([
      supabase
        .from("trabajos")
        .select("fecha, cliente, monto, estado")
        .eq("empresa_id", req.empresaId!)
        .order("fecha", { ascending: false })
        .limit(200),
      supabase
        .from("facturas")
        .select("cliente, monto, estado, fecha_emision, fecha_vencimiento")
        .eq("empresa_id", req.empresaId!)
        .order("fecha_emision", { ascending: false })
        .limit(200),
      supabase.from("empresas").select("nombre, rubro").eq("id", req.empresaId!).single(),
    ]);

    if (trabajosRes.error || facturasRes.error || empresaRes.error) {
      const error = trabajosRes.error ?? facturasRes.error ?? empresaRes.error;
      res.status(500).json({ error: error!.message });
      return;
    }

    const trabajos = trabajosRes.data ?? [];
    const facturas = facturasRes.data ?? [];

    if (trabajos.length === 0 && facturas.length === 0) {
      res.status(400).json({ error: "Todavía no hay trabajos ni facturas para generar un informe" });
      return;
    }

    const datos = { empresa: empresaRes.data, trabajos, facturas };

    let texto = `Datos de la empresa:\n${JSON.stringify(datos, null, 2)}`;
    if (instrucciones) {
      texto += `\n\nInstrucciones adicionales del usuario: ${instrucciones}`;
    }
    if (imagenes.length > 0) {
      texto += `\n\nSe adjuntan ${imagenes.length} imagen(es) — considéralas al generar el informe.`;
    }

    const content: Anthropic.MessageParam["content"] = [
      ...imagenes.map(
        (img): Anthropic.ImageBlockParam => ({
          type: "image",
          source: {
            type: "base64",
            media_type: img.mimetype as "image/jpeg" | "image/png" | "image/webp",
            data: img.buffer.toString("base64"),
          },
        })
      ),
      { type: "text", text: texto },
    ];

    try {
      const response = await claude.messages.create({
        model: "claude-sonnet-5",
        max_tokens: 2048,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content }],
      });

      const textBlock = response.content.find(
        (b): b is Anthropic.TextBlock => b.type === "text"
      );
      res.json({ informe: textBlock?.text ?? "" });
    } catch (err) {
      if (err instanceof Anthropic.AuthenticationError) {
        res.status(500).json({ error: "ANTHROPIC_API_KEY inválida" });
      } else if (err instanceof Anthropic.RateLimitError) {
        res.status(429).json({ error: "Límite de la API de Claude alcanzado, intenta de nuevo" });
      } else if (err instanceof Anthropic.APIError) {
        res.status(502).json({ error: `Error de la API de Claude: ${err.message}` });
      } else {
        throw err;
      }
    }
  })
);
