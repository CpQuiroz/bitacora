import { Router } from "express";
import Anthropic from "@anthropic-ai/sdk";
import { claude } from "../claude";
import { supabase } from "../supabase";
import type { RequestConEmpresa } from "../empresa";

export const informeRouter = Router();

const SYSTEM_PROMPT = `Eres un asistente financiero para dueños de pymes de servicio en \
terreno en Chile (transporte, técnicos de mantención, instaladores). Te paso datos reales \
de trabajos y facturas de una empresa y generas un informe ejecutivo breve en español, en \
texto plano (sin tablas markdown), con esta estructura:
1) Resumen de actividad reciente
2) Estado de facturación (pendiente / vencida / pagada)
3) Alertas o riesgos (facturas vencidas, concentración de clientes, caída de actividad, etc.)
4) Una recomendación concreta y accionable
Sé conciso y directo — el dueño lo va a leer en menos de un minuto.`;

// Informe ejecutivo con IA (Claude API), a partir de los trabajos y
// facturas reales de la empresa del usuario logueado.
informeRouter.post("/", async (req: RequestConEmpresa, res) => {
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

  try {
    const response = await claude.messages.create({
      model: "claude-sonnet-5",
      max_tokens: 2048,
      system: SYSTEM_PROMPT,
      messages: [
        { role: "user", content: `Datos de la empresa:\n${JSON.stringify(datos, null, 2)}` },
      ],
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
});
