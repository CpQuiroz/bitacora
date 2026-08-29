import { Router } from "express";
import multer from "multer";
import Anthropic from "@anthropic-ai/sdk";
import type { InformePersonalizado, SeccionInforme, TipoInforme } from "@bitacora/shared";
import { crearMensajeIA } from "../claude";
import { supabase } from "../supabase";
import {
  clientesPorComuna,
  desempenoColaboradores,
  distribucionClientes,
  estadoOT,
  estadoPresupuestos,
  gastosAgrupados,
  ingresosPorMes,
  ingresosVsGastos,
  kpis,
  kpisClientes,
  kpisVentas,
  kpisYDistribucionOperaciones,
  kpisYDistribucionServicios,
  mejoresClientes,
  porFormaPago,
  resumenFinanciero,
  resumenGastos,
  topClientes,
  topServiciosVendidos,
} from "../agregacionesDashboard";
import { generarPdfInforme } from "../generarPdfInforme";
import type { RequestConEmpresa } from "../empresa";
import { ah } from "../asyncHandler";

export const informeRouter = Router();

const TIPOS_INFORME: TipoInforme[] = ["financiero", "operativo", "clientes", "colaboradores"];
export const SECCIONES_PERSONALIZADO: SeccionInforme[] = ["financiero", "ventas", "operaciones", "servicios", "clientes", "gastos"];
const VENTANA_CACHE_SEGUNDOS = 60;

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
      const response = await crearMensajeIA(req.empresaId!, "informe_libre", {
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

async function agregarDatosInforme(tipo: TipoInforme, empresaId: string, desde: string, hasta: string) {
  switch (tipo) {
    case "financiero": {
      const [kpisData, financiero, gastos, ingresosGastos, porMes] = await Promise.all([
        kpis(empresaId, desde, hasta),
        resumenFinanciero(empresaId, desde, hasta),
        resumenGastos(empresaId, desde, hasta),
        ingresosVsGastos(empresaId, desde, hasta),
        ingresosPorMes(empresaId),
      ]);
      return {
        datos: {
          kpis: kpisData,
          resumen_financiero: financiero,
          resumen_gastos: gastos,
          ingresos_vs_gastos: ingresosGastos,
          ingresos_por_mes: porMes,
        },
        hayDatos: financiero.total > 0 || gastos.total > 0,
      };
    }
    case "operativo": {
      const [kpisData, ot] = await Promise.all([kpis(empresaId, desde, hasta), estadoOT(empresaId, desde, hasta)]);
      return { datos: { kpis: kpisData, estado_ot: ot }, hayDatos: ot.length > 0 };
    }
    case "clientes": {
      const clientes = await topClientes(empresaId, desde, hasta);
      return { datos: { top_clientes: clientes }, hayDatos: clientes.length > 0 };
    }
    case "colaboradores": {
      const desempeno = await desempenoColaboradores(empresaId, desde, hasta);
      return { datos: { desempeno_colaboradores: desempeno }, hayDatos: desempeno.length > 0 };
    }
    default:
      throw new Error(`tipo de informe no soportado: ${tipo}`);
  }
}

// Igual que agregarDatosInforme, pero para las 6 secciones que puede
// elegir un informe personalizado — reutiliza la misma analítica que
// ya alimenta las pestañas del módulo de Informes (nunca filas
// crudas, siempre datos ya agregados).
export async function agregarDatosSeccion(seccion: SeccionInforme, empresaId: string, desde: string, hasta: string) {
  switch (seccion) {
    case "financiero": {
      const [kpisData, financiero, gastos, ingresosGastos, formaPago, clientes] = await Promise.all([
        kpis(empresaId, desde, hasta),
        resumenFinanciero(empresaId, desde, hasta),
        resumenGastos(empresaId, desde, hasta),
        ingresosVsGastos(empresaId, desde, hasta),
        porFormaPago(empresaId, desde, hasta),
        mejoresClientes(empresaId, desde, hasta),
      ]);
      return {
        datos: {
          kpis: kpisData,
          resumen_financiero: financiero,
          resumen_gastos: gastos,
          ingresos_vs_gastos: ingresosGastos,
          por_forma_pago: formaPago,
          mejores_clientes: clientes,
        },
        hayDatos: financiero.total > 0 || gastos.total > 0,
      };
    }
    case "ventas": {
      const [kpisData, distribucion, topServicios] = await Promise.all([
        kpisVentas(empresaId, desde, hasta),
        estadoPresupuestos(empresaId, desde, hasta),
        topServiciosVendidos(empresaId, desde, hasta),
      ]);
      return {
        datos: { kpis: kpisData, distribucion_estado: distribucion, top_servicios: topServicios },
        hayDatos: kpisData.total_cotizaciones > 0,
      };
    }
    case "operaciones": {
      const resultado = await kpisYDistribucionOperaciones(empresaId, desde, hasta);
      return {
        datos: { kpis: resultado.kpis, distribucion_estado: resultado.distribucion },
        hayDatos: resultado.kpis.total_os > 0,
      };
    }
    case "servicios": {
      const resultado = await kpisYDistribucionServicios(empresaId, desde, hasta);
      return {
        datos: {
          kpis: resultado.kpis,
          distribucion_tipo: resultado.distribucion_tipo,
          ranking_tipos: resultado.ranking_tipos,
        },
        hayDatos: resultado.kpis.total_os > 0,
      };
    }
    case "clientes": {
      const [kpisData, distribucion, comunas] = await Promise.all([
        kpisClientes(empresaId, desde, hasta),
        distribucionClientes(empresaId),
        clientesPorComuna(empresaId),
      ]);
      return {
        datos: { kpis: kpisData, distribucion_estado: distribucion, por_comuna: comunas },
        hayDatos: kpisData.total_clientes > 0,
      };
    }
    case "gastos": {
      const [gastos, porCategoria] = await Promise.all([
        resumenGastos(empresaId, desde, hasta),
        gastosAgrupados(empresaId, desde, hasta, "categoria"),
      ]);
      return {
        datos: { resumen_gastos: gastos, ranking_categorias: porCategoria.ranking },
        hayDatos: gastos.total > 0,
      };
    }
  }
}

const SYSTEM_PROMPT_ESTRUCTURADO = `Eres un analista para dueños de pymes de servicio en \
terreno en Chile (transporte, técnicos de mantención, instaladores). Te paso datos YA \
AGREGADOS (no crudos) de un período específico de la empresa, y generas un resumen \
ejecutivo en español, en texto plano (sin tablas markdown), con esta estructura:
1) Hallazgos principales
2) Tendencias relevantes del período
3) Alertas (clientes con pagos atrasados, caída de ingresos, baja de conversión, etc. —
   solo si los datos las muestran, no inventes)
4) Recomendaciones accionables (2-3, concretas)
Nunca inventes cifras que no estén en los datos entregados. Si el usuario hizo una \
pregunta puntual, respóndela primero y de forma directa, y usa el resto de la estructura \
como contexto de apoyo. Sé conciso — se lee en menos de un minuto.`;

// Informe estructurado: tipo + rango de fechas + pregunta libre opcional.
// A diferencia de POST "/" (texto libre + fotos), acá los datos se agregan
// primero en el backend (agregacionesDashboard.ts, los mismos números que
// ve el dashboard) y solo esos agregados van a Claude — nunca filas crudas.
informeRouter.post(
  "/estructurado",
  ah<RequestConEmpresa>(async (req, res) => {
    const { tipo, desde, hasta, pregunta } = req.body ?? {};

    if (!TIPOS_INFORME.includes(tipo)) {
      res.status(400).json({ error: `tipo debe ser uno de: ${TIPOS_INFORME.join(", ")}` });
      return;
    }
    if (typeof desde !== "string" || !desde || typeof hasta !== "string" || !hasta) {
      res.status(400).json({ error: "Falta desde/hasta (YYYY-MM-DD)" });
      return;
    }
    const preguntaLimpia = typeof pregunta === "string" && pregunta.trim() ? pregunta.trim() : null;

    // Caché/límite de costo: mismo empresa+tipo+rango+pregunta generado
    // hace menos de un minuto devuelve ese mismo informe en vez de volver
    // a llamar a Claude.
    const haceUnMinuto = new Date(Date.now() - VENTANA_CACHE_SEGUNDOS * 1000).toISOString();
    let cacheQuery = supabase
      .from("informes_generados")
      .select("*")
      .eq("empresa_id", req.empresaId!)
      .eq("tipo", tipo)
      .eq("desde", desde)
      .eq("hasta", hasta)
      .gte("creado_en", haceUnMinuto)
      .order("creado_en", { ascending: false })
      .limit(1);
    cacheQuery = preguntaLimpia ? cacheQuery.eq("pregunta", preguntaLimpia) : cacheQuery.is("pregunta", null);
    const { data: cacheado } = await cacheQuery.maybeSingle();
    if (cacheado) {
      res.json(cacheado);
      return;
    }

    const { datos, hayDatos } = await agregarDatosInforme(tipo, req.empresaId!, desde, hasta);
    if (!hayDatos) {
      res.status(400).json({ error: "No hay datos suficientes en este período para generar un informe" });
      return;
    }

    let texto = `Tipo de informe solicitado: ${tipo}\nPeríodo: ${desde} a ${hasta}\n\nDatos agregados reales de la empresa:\n${JSON.stringify(datos, null, 2)}`;
    if (preguntaLimpia) texto += `\n\nPregunta del usuario: ${preguntaLimpia}`;

    // Solo la llamada a Claude va en try/catch: si falla, igual se guarda y
    // devuelve el informe con los datos agregados y resultado null (no se
    // rompe la pantalla por un problema de la API de IA).
    let resultado: string | null = null;
    try {
      const response = await crearMensajeIA(req.empresaId!, "informe_estructurado", {
        model: "claude-sonnet-5",
        max_tokens: 2048,
        system: SYSTEM_PROMPT_ESTRUCTURADO,
        messages: [{ role: "user", content: texto }],
      });
      const textBlock = response.content.find((b): b is Anthropic.TextBlock => b.type === "text");
      resultado = textBlock?.text ?? null;
    } catch (err) {
      console.error("Error generando informe estructurado con Claude:", err);
    }

    const { data: guardado, error } = await supabase
      .from("informes_generados")
      .insert({
        empresa_id: req.empresaId!,
        usuario_id: req.userId!,
        tipo,
        desde,
        hasta,
        pregunta: preguntaLimpia,
        resultado,
        datos_agregados: datos,
      })
      .select()
      .single();

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    res.status(201).json(guardado);
  })
);

const SYSTEM_PROMPT_PERSONALIZADO = `Eres un analista para dueños de pymes de servicio en \
terreno en Chile (transporte, técnicos de mantención, instaladores). Te paso datos YA \
AGREGADOS (no crudos) de un período específico, organizados por sección — el usuario eligió \
libremente cuáles secciones incluir, así que pueden venir una o varias juntas (financiero, \
ventas, operaciones, servicios, clientes, gastos). Generas un resumen ejecutivo en español, \
en texto plano (sin tablas markdown), con esta estructura:
1) Hallazgos principales de cada sección incluida (agrupa por sección si hay más de una)
2) Conexiones entre secciones si las hay (ej. una caída en ventas que explica menos ingreso)
3) Alertas (solo si los datos las muestran, no inventes)
4) Recomendaciones accionables (2-3, concretas)
Nunca inventes cifras que no estén en los datos entregados. Si el usuario hizo una \
pregunta puntual, respóndela primero y de forma directa. Sé conciso — se lee en menos de un \
minuto.`;

// Informe personalizado: el usuario elige libremente qué secciones
// incluir (en vez del "tipo" fijo de /estructurado) — cada sección
// reutiliza la misma analítica que ya alimenta esa pestaña del
// módulo de Informes. Puede guardarse como plantilla para reusar.
informeRouter.post(
  "/personalizado",
  ah<RequestConEmpresa>(async (req, res) => {
    const { secciones, desde, hasta, pregunta, nombre, guardar_como_plantilla, plantilla_id } = req.body ?? {};

    if (
      !Array.isArray(secciones) ||
      secciones.length === 0 ||
      secciones.some((s) => !SECCIONES_PERSONALIZADO.includes(s))
    ) {
      res.status(400).json({ error: `secciones debe ser un arreglo no vacío con valores de: ${SECCIONES_PERSONALIZADO.join(", ")}` });
      return;
    }
    if (typeof desde !== "string" || !desde || typeof hasta !== "string" || !hasta) {
      res.status(400).json({ error: "Falta desde/hasta (YYYY-MM-DD)" });
      return;
    }
    const preguntaLimpia = typeof pregunta === "string" && pregunta.trim() ? pregunta.trim() : null;
    const nombreLimpio = typeof nombre === "string" && nombre.trim() ? nombre.trim() : null;

    const seccionesOrdenadas = [...secciones].sort();

    const haceUnMinuto = new Date(Date.now() - VENTANA_CACHE_SEGUNDOS * 1000).toISOString();
    // supabase-js .eq() serializa un array JS como CSV plano (sin llaves),
    // lo que nunca calza con la sintaxis de literal de arreglo de Postgres
    // que espera PostgREST — hay que armar el literal "{a,b,c}" a mano.
    const seccionesLiteral = `{${seccionesOrdenadas.join(",")}}`;
    const { data: cacheado } = await supabase
      .from("informes_generados")
      .select("*")
      .eq("empresa_id", req.empresaId!)
      .eq("tipo", "personalizado")
      .eq("desde", desde)
      .eq("hasta", hasta)
      .eq("secciones", seccionesLiteral as unknown as SeccionInforme[])
      .gte("creado_en", haceUnMinuto)
      .order("creado_en", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (cacheado && cacheado.pregunta === preguntaLimpia) {
      res.json(cacheado);
      return;
    }

    const resultados = await Promise.all(
      seccionesOrdenadas.map((s: SeccionInforme) => agregarDatosSeccion(s, req.empresaId!, desde, hasta))
    );
    const datosPorSeccion: Record<string, unknown> = {};
    let hayAlgunDato = false;
    seccionesOrdenadas.forEach((s: SeccionInforme, i: number) => {
      datosPorSeccion[s] = resultados[i]!.datos;
      if (resultados[i]!.hayDatos) hayAlgunDato = true;
    });

    if (!hayAlgunDato) {
      res.status(400).json({ error: "No hay datos suficientes en este período para ninguna de las secciones elegidas" });
      return;
    }

    let texto = `Secciones incluidas: ${seccionesOrdenadas.join(", ")}\nPeríodo: ${desde} a ${hasta}\n\nDatos agregados reales de la empresa, por sección:\n${JSON.stringify(datosPorSeccion, null, 2)}`;
    if (preguntaLimpia) texto += `\n\nPregunta del usuario: ${preguntaLimpia}`;

    let resultadoTexto: string | null = null;
    try {
      const response = await crearMensajeIA(req.empresaId!, "informe_personalizado", {
        model: "claude-sonnet-5",
        max_tokens: 2560,
        system: SYSTEM_PROMPT_PERSONALIZADO,
        messages: [{ role: "user", content: texto }],
      });
      const textBlock = response.content.find((b): b is Anthropic.TextBlock => b.type === "text");
      resultadoTexto = textBlock?.text ?? null;
    } catch (err) {
      console.error("Error generando informe personalizado con Claude:", err);
    }

    let personalizadoId: string | null = typeof plantilla_id === "string" ? plantilla_id : null;
    if (guardar_como_plantilla && nombreLimpio && !personalizadoId) {
      const { data: plantilla, error: errorPlantilla } = await supabase
        .from("informes_personalizados")
        .insert({
          empresa_id: req.empresaId!,
          nombre: nombreLimpio,
          secciones: seccionesOrdenadas,
          pregunta: preguntaLimpia,
          creado_por: req.userId!,
        })
        .select()
        .single();
      if (errorPlantilla) {
        res.status(500).json({ error: errorPlantilla.message });
        return;
      }
      personalizadoId = plantilla.id;
    }

    const { data: guardado, error } = await supabase
      .from("informes_generados")
      .insert({
        empresa_id: req.empresaId!,
        usuario_id: req.userId!,
        tipo: "personalizado",
        desde,
        hasta,
        pregunta: preguntaLimpia,
        nombre: nombreLimpio,
        resultado: resultadoTexto,
        datos_agregados: datosPorSeccion,
        secciones: seccionesOrdenadas,
        personalizado_id: personalizadoId,
      })
      .select()
      .single();

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    res.status(201).json(guardado);
  })
);

informeRouter.get(
  "/plantillas",
  ah<RequestConEmpresa>(async (req, res) => {
    const { data, error } = await supabase
      .from("informes_personalizados")
      .select("*, creador:usuarios(nombre)")
      .eq("empresa_id", req.empresaId!)
      .order("nombre");
    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    res.json(data);
  })
);

informeRouter.post(
  "/plantillas",
  ah<RequestConEmpresa>(async (req, res) => {
    const { nombre, secciones, pregunta } = req.body ?? {};

    if (typeof nombre !== "string" || !nombre.trim()) {
      res.status(400).json({ error: "Falta nombre" });
      return;
    }
    if (
      !Array.isArray(secciones) ||
      secciones.length === 0 ||
      secciones.some((s) => !SECCIONES_PERSONALIZADO.includes(s))
    ) {
      res.status(400).json({ error: `secciones debe ser un arreglo no vacío con valores de: ${SECCIONES_PERSONALIZADO.join(", ")}` });
      return;
    }

    const { data, error } = await supabase
      .from("informes_personalizados")
      .insert({
        empresa_id: req.empresaId!,
        nombre: nombre.trim(),
        secciones,
        pregunta: typeof pregunta === "string" && pregunta.trim() ? pregunta.trim() : null,
        creado_por: req.userId!,
      })
      .select()
      .single();

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    res.status(201).json(data);
  })
);

informeRouter.patch(
  "/plantillas/:id",
  ah<RequestConEmpresa>(async (req, res) => {
    const { nombre, secciones, pregunta } = req.body ?? {};
    const cambios: Partial<InformePersonalizado> = { actualizado_en: new Date().toISOString() };

    if (nombre !== undefined) {
      if (typeof nombre !== "string" || !nombre.trim()) {
        res.status(400).json({ error: "Falta nombre" });
        return;
      }
      cambios.nombre = nombre.trim();
    }
    if (secciones !== undefined) {
      if (!Array.isArray(secciones) || secciones.length === 0 || secciones.some((s) => !SECCIONES_PERSONALIZADO.includes(s))) {
        res.status(400).json({ error: `secciones debe ser un arreglo no vacío con valores de: ${SECCIONES_PERSONALIZADO.join(", ")}` });
        return;
      }
      cambios.secciones = secciones;
    }
    if (pregunta !== undefined) cambios.pregunta = pregunta?.trim() || null;

    const { data, error } = await supabase
      .from("informes_personalizados")
      .update(cambios)
      .eq("empresa_id", req.empresaId!)
      .eq("id", req.params.id)
      .select()
      .maybeSingle();

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    if (!data) {
      res.status(404).json({ error: "Plantilla no encontrada" });
      return;
    }
    res.json(data);
  })
);

informeRouter.delete(
  "/plantillas/:id",
  ah<RequestConEmpresa>(async (req, res) => {
    const { error, count } = await supabase
      .from("informes_personalizados")
      .delete({ count: "exact" })
      .eq("empresa_id", req.empresaId!)
      .eq("id", req.params.id);
    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    if (!count) {
      res.status(404).json({ error: "Plantilla no encontrada" });
      return;
    }
    res.status(204).end();
  })
);

informeRouter.get(
  "/historial",
  ah<RequestConEmpresa>(async (req, res) => {
    const { data, error } = await supabase
      .from("informes_generados")
      .select("id, tipo, desde, hasta, pregunta, nombre, secciones, creado_en, usuario:usuarios(nombre)")
      .eq("empresa_id", req.empresaId!)
      .order("creado_en", { ascending: false })
      .limit(50);
    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    res.json(data);
  })
);

informeRouter.get(
  "/historial/:id",
  ah<RequestConEmpresa>(async (req, res) => {
    const { data, error } = await supabase
      .from("informes_generados")
      .select("*, usuario:usuarios(nombre)")
      .eq("empresa_id", req.empresaId!)
      .eq("id", req.params.id)
      .maybeSingle();
    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    if (!data) {
      res.status(404).json({ error: "Informe no encontrado" });
      return;
    }
    res.json(data);
  })
);

informeRouter.get(
  "/historial/:id/pdf",
  ah<RequestConEmpresa>(async (req, res) => {
    const { data: informe, error } = await supabase
      .from("informes_generados")
      .select("*")
      .eq("empresa_id", req.empresaId!)
      .eq("id", req.params.id)
      .maybeSingle();
    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    if (!informe) {
      res.status(404).json({ error: "Informe no encontrado" });
      return;
    }

    const { data: empresa } = await supabase
      .from("empresas")
      .select("nombre, logo_url, color_primario")
      .eq("id", req.empresaId!)
      .single();

    const pdf = await generarPdfInforme({
      empresaNombre: empresa?.nombre ?? "",
      empresaLogoUrl: empresa?.logo_url ?? null,
      colorPrimario: empresa?.color_primario ?? null,
      tipo: informe.tipo,
      nombre: informe.nombre,
      desde: informe.desde,
      hasta: informe.hasta,
      pregunta: informe.pregunta,
      resultado: informe.resultado,
      datosAgregados: informe.datos_agregados,
    });
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="informe-${informe.tipo}-${informe.desde}.pdf"`);
    res.send(pdf);
  })
);
