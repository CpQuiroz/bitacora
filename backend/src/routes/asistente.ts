import { Router } from "express";
import Anthropic from "@anthropic-ai/sdk";
import { claude } from "../claude";
import { supabase } from "../supabase";
import type { RequestConEmpresa } from "../empresa";
import { ah } from "../asyncHandler";
import { agregarDatosSeccion, SECCIONES_PERSONALIZADO } from "./informe";

export const asistenteRouter = Router();

const MAX_HISTORIAL = 40;
const MAX_ITERACIONES_HERRAMIENTA = 5;

function systemPrompt() {
  const hoy = new Date().toISOString().slice(0, 10);
  return `Eres el asistente conversacional de Bitácora, una app de gestión para pymes de \
servicio en terreno en Chile (transporte, técnicos de mantención, instaladores). Conversas \
con el dueño o un colaborador de la empresa, en español, con un tono directo y cercano — \
como un asistente de confianza, no como un informe formal.

Hoy es ${hoy}. Cuando la pregunta implique cifras reales del negocio (ingresos, gastos, \
clientes, ventas, operaciones, servicios), usa SIEMPRE la herramienta "datos_negocio" antes \
de responder — nunca inventes números. Si la pregunta menciona un período relativo ("este \
mes", "la semana pasada", "este año"), calcula tú las fechas desde/hasta a partir de hoy. Si \
no hay datos suficientes en el período, dilo directamente en vez de inventar.

Si la pregunta no requiere datos (saludo, duda sobre cómo usar la app, consejo general de \
negocio), responde directo sin usar la herramienta. Sé conciso — respuestas cortas, en texto \
plano puro, como en un chat real: SIN markdown de ningún tipo (nada de **negrita**, #, \
tablas ni bullets con "-" o "*"). Si necesitas listar varias cosas, usa una oración o \
numeración simple tipo "1) ... 2) ...".`;
}

const HERRAMIENTAS: Anthropic.Tool[] = [
  {
    name: "datos_negocio",
    description:
      "Obtiene datos reales y ya agregados del negocio del usuario para una sección y un rango de fechas. Úsala cada vez que la respuesta dependa de cifras reales.",
    input_schema: {
      type: "object",
      properties: {
        seccion: {
          type: "string",
          enum: SECCIONES_PERSONALIZADO,
          description:
            "financiero: KPIs de ingresos/cobros, resumen de gastos, ingresos vs gastos, forma de pago, Y el ranking de mejores clientes por facturación (usa esta sección para preguntas de \"mis mejores/top clientes\" o \"quién me factura más\"). " +
            "ventas: cotizaciones y su estado, ranking de servicios más vendidos. " +
            "operaciones: cantidad y distribución de estado de las órdenes de servicio (OS). " +
            "servicios: KPIs y ranking por tipo de servicio prestado. " +
            "clientes: cantidad de clientes totales/nuevos/activos, ingreso promedio por cliente, distribución por comuna (NO incluye ranking por facturación individual — para eso usa financiero). " +
            "gastos: resumen de gastos y ranking por categoría.",
        },
        desde: { type: "string", description: "Fecha de inicio, formato YYYY-MM-DD" },
        hasta: { type: "string", description: "Fecha de término, formato YYYY-MM-DD" },
      },
      required: ["seccion", "desde", "hasta"],
    },
  },
];

async function ejecutarHerramienta(
  nombre: string,
  input: Record<string, unknown>,
  empresaId: string
): Promise<Record<string, unknown>> {
  if (nombre !== "datos_negocio") return { error: `Herramienta desconocida: ${nombre}` };

  const seccion = input.seccion;
  const desde = input.desde;
  const hasta = input.hasta;
  if (
    typeof seccion !== "string" ||
    !SECCIONES_PERSONALIZADO.includes(seccion as (typeof SECCIONES_PERSONALIZADO)[number]) ||
    typeof desde !== "string" ||
    typeof hasta !== "string"
  ) {
    return { error: "Parámetros inválidos para datos_negocio" };
  }

  const { datos, hayDatos } = await agregarDatosSeccion(
    seccion as (typeof SECCIONES_PERSONALIZADO)[number],
    empresaId,
    desde,
    hasta
  );
  return hayDatos ? datos : { mensaje: `No hay datos suficientes en ese período para la sección "${seccion}".` };
}

asistenteRouter.get(
  "/",
  ah<RequestConEmpresa>(async (req, res) => {
    const { data, error } = await supabase
      .from("asistente_mensajes")
      .select("*")
      .eq("empresa_id", req.empresaId!)
      .eq("usuario_id", req.userId!)
      .order("creado_en", { ascending: true })
      .limit(200);
    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    res.json(data);
  })
);

asistenteRouter.post(
  "/mensaje",
  ah<RequestConEmpresa>(async (req, res) => {
    const { mensaje } = req.body ?? {};
    if (typeof mensaje !== "string" || !mensaje.trim()) {
      res.status(400).json({ error: "Falta mensaje" });
      return;
    }
    const mensajeLimpio = mensaje.trim();

    const { data: historialDb, error: errorHistorial } = await supabase
      .from("asistente_mensajes")
      .select("rol, contenido")
      .eq("empresa_id", req.empresaId!)
      .eq("usuario_id", req.userId!)
      .order("creado_en", { ascending: true })
      .limit(MAX_HISTORIAL);
    if (errorHistorial) {
      res.status(500).json({ error: errorHistorial.message });
      return;
    }

    const { error: errorGuardarUsuario } = await supabase
      .from("asistente_mensajes")
      .insert({ empresa_id: req.empresaId!, usuario_id: req.userId!, rol: "user", contenido: mensajeLimpio });
    if (errorGuardarUsuario) {
      res.status(500).json({ error: errorGuardarUsuario.message });
      return;
    }

    let mensajesClaude: Anthropic.MessageParam[] = [
      ...(historialDb ?? []).map((m) => ({ role: m.rol as "user" | "assistant", content: m.contenido })),
      { role: "user", content: mensajeLimpio },
    ];

    let respuestaFinal = "";
    try {
      for (let i = 0; i < MAX_ITERACIONES_HERRAMIENTA; i++) {
        const response = await claude.messages.create({
          model: "claude-sonnet-5",
          max_tokens: 1024,
          system: systemPrompt(),
          tools: HERRAMIENTAS,
          messages: mensajesClaude,
        });

        if (response.stop_reason === "tool_use") {
          mensajesClaude = [...mensajesClaude, { role: "assistant", content: response.content }];
          const resultados: Anthropic.ToolResultBlockParam[] = [];
          for (const block of response.content) {
            if (block.type === "tool_use") {
              const resultado = await ejecutarHerramienta(
                block.name,
                block.input as Record<string, unknown>,
                req.empresaId!
              );
              resultados.push({ type: "tool_result", tool_use_id: block.id, content: JSON.stringify(resultado) });
            }
          }
          mensajesClaude = [...mensajesClaude, { role: "user", content: resultados }];
          continue;
        }

        const textBlock = response.content.find((b): b is Anthropic.TextBlock => b.type === "text");
        respuestaFinal = textBlock?.text ?? "";
        break;
      }
      if (!respuestaFinal) respuestaFinal = "No pude generar una respuesta esta vez — intenta de nuevo.";
    } catch (err) {
      console.error("Error del asistente:", err);
      respuestaFinal = "Hubo un problema generando la respuesta. Intenta de nuevo en un momento.";
    }

    const { data: guardado, error } = await supabase
      .from("asistente_mensajes")
      .insert({ empresa_id: req.empresaId!, usuario_id: req.userId!, rol: "assistant", contenido: respuestaFinal })
      .select()
      .single();
    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    res.status(201).json(guardado);
  })
);

asistenteRouter.delete(
  "/",
  ah<RequestConEmpresa>(async (req, res) => {
    const { error } = await supabase
      .from("asistente_mensajes")
      .delete()
      .eq("empresa_id", req.empresaId!)
      .eq("usuario_id", req.userId!);
    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    res.status(204).end();
  })
);
