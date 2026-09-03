import { Router } from "express";
import Anthropic from "@anthropic-ai/sdk";
import { crearMensajeIA } from "../claude";
import { supabase } from "../supabase";
import { env } from "../env";
import type { RequestConEmpresa } from "../empresa";
import { ah } from "../asyncHandler";
import { agregarDatosSeccion, SECCIONES_PERSONALIZADO } from "./informe";

export const asistenteRouter = Router();

const MAX_HISTORIAL = 40;
const MAX_ITERACIONES_HERRAMIENTA = 5;

// Mapa curado a mano de cómo funciona Bitácora — para que el asistente
// oriente con precisión ("andá a Informes → Informe IA") en vez de
// inventar procedimientos. Mantener corto y actualizado a mano.
const MAPA_APP = `Cómo se usa cada cosa en Bitácora (para orientar al usuario — NO inventes pasos fuera de esto):
- Clientes, equipos/vehículos, catálogo, inventario, proveedores: menú Registros.
- Órdenes de Servicio (OS): menú Órdenes de Servicio → "+ Nueva OS". El checklist, las fotos y la firma se cargan desde la app móvil o dentro de la OS.
- Viajes / guías de despacho: menú Viajes.
- Agenda y citas: menú Agenda. La reserva online para clientes (Agenda Pro) se configura en Configuración → Reserva online.
- Cotizaciones, gastos, cobros: menú Financiero.
- Informes de analítica: menú Informes (7 pestañas + exportar CSV/PDF).
- Informe con IA a partir de FOTOS + texto (ej. informe de inspección): menú Informes → Informe IA → modo libre. Sube hasta 5 imágenes y describe qué necesitas.
- Informe técnico de una OS puntual: dentro de la OS, botón "Generar informe con IA" (usa checklist, datos medidos, observaciones y análisis de fotos).
- Invitar gente al equipo, roles, correos/dominios autorizados: Configuración → Grupo y usuario.
- Personalización (logo, colores, datos de la empresa): Configuración → Empresa.
- Plantillas de documentos, tipos de OS, tipos de trabajo, checklists, categorías de gasto, centros de costo, unidades: submenús de Configuración.
- Avisos automáticos al cliente (correo y WhatsApp) y sus textos: Configuración → Notificaciones.
- Plan y suscripción (trial, Básico, Pro), registrar tarjeta: Configuración → Plan.
- Seguridad y verificación en dos pasos (2FA): Configuración → Seguridad.

Cosas que el usuario NO puede configurar solo en la app (las activa el equipo de Bitácora — si te preguntan cómo, decí eso, no inventes un procedimiento con SMS ni códigos):
- Conectar el bot de WhatsApp para choferes / la cuenta de Meta Business.
- Conectar una pasarela de pago real (Webpay/Flow/Mercado Pago) para cobrar al cliente final — hoy el link de pago es simulado.
- Crear o cambiar la definición de roles del sistema.
- Emisión de documentos tributarios ante el SII o de datos a Previred/DT (Remuneraciones genera archivos para carga manual, no emite).`;

function systemPrompt() {
  const hoy = new Date().toISOString().slice(0, 10);
  return `Eres el asistente conversacional de Bitácora, una app de gestión para pymes de \
servicio en terreno en Chile (transporte, técnicos de mantención, instaladores). Conversas \
con el dueño o un colaborador de la empresa, en español, con un tono directo y cercano — \
como un asistente de confianza, no como un informe formal.

Hoy es ${hoy}. Tienes acceso de SOLO LECTURA a la información de la empresa a través de \
herramientas. Todo lo que devuelven ya está filtrado a la empresa del usuario. Nunca \
inventes datos: si una herramienta no trae resultados, dilo. Si la pregunta menciona un \
período relativo ("hoy", "mañana", "esta semana", "este mes", "el año pasado"), calcula tú \
las fechas desde/hasta a partir de hoy.

QUÉ NO PUEDES HACER: no configuras integraciones, no cambias ni creas datos, no ejecutas \
acciones, no ves imágenes ni archivos, no envías mensajes ni correos. Si te piden "cómo \
configuro / cómo activo / cómo conecto X" o "cómo hago Y en la app", respóndelo SOLO con lo \
que aparece en el mapa de abajo. Si no está en el mapa y no lo sabes con certeza, dilo \
claramente ("no tengo esa información" o "esa parte la maneja el equipo de Bitácora") — \
NUNCA inventes un procedimiento, pasos, nombres de botones ni menús. Puedes usar la \
herramienta "estado_configuracion" para responder con el estado real de la empresa.

${MAPA_APP}

Herramientas y cuándo usarlas:
- "datos_negocio": cifras YA AGREGADAS (KPIs de ingresos/cobros/gastos, ingresos vs gastos, \
ranking de mejores clientes por facturación, cotizaciones por estado, servicios más \
vendidos, estado de las OS, clientes nuevos/activos, gastos por categoría). Para totales, \
promedios y rankings.
- "buscar_clientes": datos de contacto de un cliente puntual (teléfono, correo, dirección, \
comuna), o los últimos agregados.
- "agenda": qué hay agendado (tareas y órdenes de servicio con fecha) en un rango — con el \
cliente, el responsable y la hora. Úsala para "qué tengo mañana", "quién está agendado el \
viernes", "citas de la semana".
- "consultar_registros": lista registros individuales de un área — viajes, órdenes de \
servicio, cotizaciones, facturas, equipos/vehículos, colaboradores, inventario/catálogo, \
proveedores, o mantenciones programadas. Acepta filtros de texto, estado y fechas.
- "estado_configuracion": el estado real de configuración de la empresa — datos completos, \
plan y trial, canales de aviso al cliente (correo/WhatsApp), pasarelas de pago conectadas, \
y si el bot de WhatsApp está disponible en la plataforma. Úsala cuando pregunten "tengo X \
activo", "por qué no me llegan los WhatsApp", "está conectado mi pago", "qué me falta configurar".

Si la pregunta no requiere datos (saludo, consejo general), responde directo. Sé conciso — \
texto plano puro, como en un chat real: SIN markdown de ningún tipo (nada de **negrita**, \
#, tablas ni bullets con "-" o "*"). Si listas varias cosas, usa una oración o numeración \
simple tipo "1) ... 2) ...".`;
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
  {
    name: "buscar_clientes",
    description:
      "Busca clientes puntuales por nombre, o lista los más recientes si no se da texto de búsqueda — devuelve registros individuales (nombre, contacto, dirección), no cifras agregadas. Úsala para preguntas sobre UN cliente en particular, no para rankings ni totales.",
    input_schema: {
      type: "object",
      properties: {
        busqueda: { type: "string", description: "Texto para buscar por nombre (opcional, coincidencia parcial) — si se omite, devuelve los más recientes" },
        limite: { type: "number", description: "Cuántos resultados devolver (por defecto 5, máximo 20)" },
      },
    },
  },
  {
    name: "agenda",
    description:
      "Devuelve lo que hay agendado (tareas y órdenes de servicio que tienen fecha) en un rango, con el cliente, el responsable asignado, la hora y el estado. Úsala para preguntas de calendario: qué hay hoy/mañana, quién está agendado tal día, citas de la semana, visitas programadas.",
    input_schema: {
      type: "object",
      properties: {
        desde: { type: "string", description: "Fecha de inicio YYYY-MM-DD (por defecto, hoy)" },
        hasta: { type: "string", description: "Fecha de término YYYY-MM-DD (por defecto, hoy + 30 días)" },
        cliente: { type: "string", description: "Filtra por nombre de cliente (opcional, coincidencia parcial)" },
      },
    },
  },
  {
    name: "consultar_registros",
    description:
      "Lista registros individuales de un área de la empresa. Para totales/rankings usa datos_negocio; esto trae las filas una por una.",
    input_schema: {
      type: "object",
      properties: {
        entidad: {
          type: "string",
          enum: [
            "viajes",
            "ordenes_servicio",
            "cotizaciones",
            "facturas",
            "equipos",
            "colaboradores",
            "inventario",
            "proveedores",
            "mantenciones",
          ],
          description:
            "viajes: guías de despacho (fecha, ruta, chofer, km, total, estado). " +
            "ordenes_servicio: trabajos/OS (código, fecha, cliente, responsable, ubicación, monto, estado, descripción). " +
            "cotizaciones: presupuestos (número, cliente, monto, estado, vencimiento). " +
            "facturas: cobros (cliente, monto, emisión, vencimiento, estado, pago). " +
            "equipos: equipos y vehículos (nombre, marca/modelo, patente, año, garantía, activo). " +
            "colaboradores: personas del equipo (nombre, rol, teléfono, zona, vencimiento de licencia). " +
            "inventario: ítems del catálogo (nombre, sku, precio, stock actual y mínimo). " +
            "proveedores: proveedores (nombre, razón social, rut, contacto). " +
            "mantenciones: planes de mantención programados (equipo, cada cuántos días, próxima fecha).",
        },
        texto: { type: "string", description: "Filtro de texto por nombre/cliente/código según la entidad (opcional, coincidencia parcial)" },
        estado: { type: "string", description: "Filtra por estado exacto (opcional; aplica a viajes, ordenes_servicio, cotizaciones, facturas)" },
        desde: { type: "string", description: "Fecha de inicio YYYY-MM-DD (opcional; filtra por la fecha principal de la entidad)" },
        hasta: { type: "string", description: "Fecha de término YYYY-MM-DD (opcional)" },
        limite: { type: "number", description: "Cuántos resultados devolver (por defecto 10, máximo 50)" },
      },
      required: ["entidad"],
    },
  },
  {
    name: "estado_configuracion",
    description:
      "Devuelve el estado real de configuración de la empresa: si los datos de la empresa están completos, el plan y los días de trial, si los avisos al cliente por correo y por WhatsApp están activos y si hay un número de WhatsApp cargado, qué pasarelas de pago están conectadas, y si el bot de WhatsApp para choferes está disponible en la plataforma. Úsala para preguntas de configuración ('tengo activo X', 'por qué no llegan los WhatsApp', 'qué me falta').",
    input_schema: { type: "object", properties: {} },
  },
];

// ---- Resolución de ids -> nombre legible ----
async function mapaNombres(
  tabla: "usuarios" | "clientes" | "equipos",
  empresaId: string,
  ids: (string | null | undefined)[]
): Promise<Map<string, string>> {
  const limpios = [...new Set(ids.filter((x): x is string => Boolean(x)))];
  if (limpios.length === 0) return new Map();
  const { data } = await supabase.from(tabla).select("id, nombre").eq("empresa_id", empresaId).in("id", limpios);
  return new Map((data ?? []).map((r) => [r.id as string, r.nombre as string]));
}

async function consultarAgenda(input: Record<string, unknown>, empresaId: string): Promise<Record<string, unknown>> {
  const hoy = new Date().toISOString().slice(0, 10);
  const desde = typeof input.desde === "string" && input.desde ? input.desde : hoy;
  const hasta =
    typeof input.hasta === "string" && input.hasta
      ? input.hasta
      : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const filtroCliente = typeof input.cliente === "string" ? input.cliente.trim().toLowerCase() : "";

  const [{ data: tareas }, { data: trabajos }] = await Promise.all([
    supabase
      .from("tareas")
      .select("titulo, fecha, hora, responsable_id, cliente_id, prioridad, estado")
      .eq("empresa_id", empresaId)
      .gte("fecha", desde)
      .lte("fecha", hasta)
      .order("fecha")
      .limit(100),
    supabase
      .from("trabajos")
      .select("codigo, fecha, hora_programada, responsable_id, cliente, cliente_id, ubicacion, estado")
      .eq("empresa_id", empresaId)
      .gte("fecha", desde)
      .lte("fecha", hasta)
      .order("fecha")
      .limit(100),
  ]);

  const usuarios = await mapaNombres("usuarios", empresaId, [
    ...(tareas ?? []).map((t) => t.responsable_id),
    ...(trabajos ?? []).map((t) => t.responsable_id),
  ]);
  const clientes = await mapaNombres("clientes", empresaId, [
    ...(tareas ?? []).map((t) => t.cliente_id),
    ...(trabajos ?? []).map((t) => t.cliente_id),
  ]);

  let items = [
    ...(tareas ?? []).map((t) => ({
      tipo: "tarea",
      fecha: t.fecha,
      hora: t.hora ?? null,
      titulo: t.titulo,
      cliente: t.cliente_id ? clientes.get(t.cliente_id) ?? null : null,
      responsable: t.responsable_id ? usuarios.get(t.responsable_id) ?? null : null,
      prioridad: t.prioridad,
      estado: t.estado,
    })),
    ...(trabajos ?? []).map((t) => ({
      tipo: "orden_servicio",
      fecha: t.fecha,
      hora: t.hora_programada ?? null,
      titulo: t.codigo ? `OS ${t.codigo}` : "Orden de servicio",
      cliente: t.cliente_id ? clientes.get(t.cliente_id) ?? t.cliente ?? null : t.cliente ?? null,
      responsable: t.responsable_id ? usuarios.get(t.responsable_id) ?? null : null,
      ubicacion: t.ubicacion ?? null,
      estado: t.estado,
    })),
  ];
  if (filtroCliente) items = items.filter((i) => (i.cliente ?? "").toLowerCase().includes(filtroCliente));
  items.sort((a, b) => (a.fecha + (a.hora ?? "")).localeCompare(b.fecha + (b.hora ?? "")));

  if (items.length === 0) {
    return {
      mensaje: `No hay tareas ni órdenes de servicio agendadas entre ${desde} y ${hasta}${
        filtroCliente ? ` para "${String(input.cliente)}"` : ""
      }.`,
    };
  }
  return { rango: { desde, hasta }, cantidad: items.length, agenda: items.slice(0, 50) };
}

async function consultarRegistros(input: Record<string, unknown>, empresaId: string): Promise<Record<string, unknown>> {
  const entidad = typeof input.entidad === "string" ? input.entidad : "";
  const texto = typeof input.texto === "string" ? input.texto.trim() : "";
  const estado = typeof input.estado === "string" ? input.estado.trim() : "";
  const desde = typeof input.desde === "string" ? input.desde : "";
  const hasta = typeof input.hasta === "string" ? input.hasta : "";
  const limite = Math.min(typeof input.limite === "number" && input.limite > 0 ? input.limite : 10, 50);
  const like = (col: string) => `${col}.ilike.%${texto.replace(/[%,()]/g, "")}%`;

  switch (entidad) {
    case "viajes": {
      let q = supabase
        .from("viajes")
        .select("fecha, numero_guia, cliente, chofer_id, origen, destino, km_inicial, km_final, total, estado")
        .eq("empresa_id", empresaId)
        .order("fecha", { ascending: false })
        .limit(limite);
      if (estado) q = q.eq("estado", estado as never);
      if (desde) q = q.gte("fecha", desde);
      if (hasta) q = q.lte("fecha", hasta);
      if (texto) q = q.or([like("cliente"), like("numero_guia"), like("origen"), like("destino")].join(","));
      const { data, error } = await q;
      if (error) return { error: error.message };
      const choferes = await mapaNombres("usuarios", empresaId, (data ?? []).map((v) => v.chofer_id));
      return {
        viajes: (data ?? []).map((v) => ({
          fecha: v.fecha,
          guia: v.numero_guia,
          cliente: v.cliente,
          chofer: v.chofer_id ? choferes.get(v.chofer_id) ?? null : null,
          ruta: `${v.origen} → ${v.destino}`,
          km: v.km_inicial != null && v.km_final != null ? Math.max(0, Number(v.km_final) - Number(v.km_inicial)) : null,
          total: v.total,
          estado: v.estado,
        })),
      };
    }
    case "ordenes_servicio": {
      let q = supabase
        .from("trabajos")
        .select("codigo, fecha, hora_programada, cliente, cliente_id, responsable_id, ubicacion, monto, estado, descripcion")
        .eq("empresa_id", empresaId)
        .order("fecha", { ascending: false })
        .limit(limite);
      if (estado) q = q.eq("estado", estado as never);
      if (desde) q = q.gte("fecha", desde);
      if (hasta) q = q.lte("fecha", hasta);
      if (texto) q = q.or([like("codigo"), like("cliente"), like("ubicacion"), like("descripcion")].join(","));
      const { data, error } = await q;
      if (error) return { error: error.message };
      const usuarios = await mapaNombres("usuarios", empresaId, (data ?? []).map((t) => t.responsable_id));
      const clientes = await mapaNombres("clientes", empresaId, (data ?? []).map((t) => t.cliente_id));
      return {
        ordenes_servicio: (data ?? []).map((t) => ({
          codigo: t.codigo,
          fecha: t.fecha,
          hora: t.hora_programada ?? null,
          cliente: t.cliente_id ? clientes.get(t.cliente_id) ?? t.cliente : t.cliente,
          responsable: t.responsable_id ? usuarios.get(t.responsable_id) ?? null : null,
          ubicacion: t.ubicacion,
          monto: t.monto,
          estado: t.estado,
          descripcion: t.descripcion,
        })),
      };
    }
    case "cotizaciones": {
      let q = supabase
        .from("presupuestos")
        .select("numero, cliente_id, descripcion, monto, fecha, estado, fecha_vencimiento")
        .eq("empresa_id", empresaId)
        .order("fecha", { ascending: false })
        .limit(limite);
      if (estado) q = q.eq("estado", estado as never);
      if (desde) q = q.gte("fecha", desde);
      if (hasta) q = q.lte("fecha", hasta);
      const { data, error } = await q;
      if (error) return { error: error.message };
      const clientes = await mapaNombres("clientes", empresaId, (data ?? []).map((p) => p.cliente_id));
      let filas = (data ?? []).map((p) => ({
        numero: p.numero,
        cliente: p.cliente_id ? clientes.get(p.cliente_id) ?? null : null,
        descripcion: p.descripcion,
        monto: p.monto,
        fecha: p.fecha,
        estado: p.estado,
        vence: p.fecha_vencimiento,
      }));
      if (texto) {
        const t = texto.toLowerCase();
        filas = filas.filter((r) => (r.cliente ?? "").toLowerCase().includes(t) || (r.descripcion ?? "").toLowerCase().includes(t));
      }
      return { cotizaciones: filas };
    }
    case "facturas": {
      let q = supabase
        .from("facturas")
        .select("cliente, monto, fecha_emision, fecha_vencimiento, estado, fecha_pago, medio_pago")
        .eq("empresa_id", empresaId)
        .order("fecha_emision", { ascending: false })
        .limit(limite);
      if (estado) q = q.eq("estado", estado as never);
      if (desde) q = q.gte("fecha_emision", desde);
      if (hasta) q = q.lte("fecha_emision", hasta);
      if (texto) q = q.ilike("cliente", `%${texto.replace(/[%,()]/g, "")}%`);
      const { data, error } = await q;
      if (error) return { error: error.message };
      return {
        facturas: (data ?? []).map((f) => ({
          cliente: f.cliente,
          monto: f.monto,
          emitida: f.fecha_emision,
          vence: f.fecha_vencimiento,
          estado: f.estado,
          pagada_el: f.fecha_pago,
          medio_pago: f.medio_pago,
        })),
      };
    }
    case "equipos": {
      let q = supabase
        .from("equipos")
        .select("nombre, marca, modelo, categoria, patente, anio, tipo_vehiculo, activo, garantia_vencimiento")
        .eq("empresa_id", empresaId)
        .order("nombre")
        .limit(limite);
      if (texto) q = q.or([like("nombre"), like("patente"), like("marca"), like("modelo")].join(","));
      const { data, error } = await q;
      if (error) return { error: error.message };
      return { equipos: data ?? [] };
    }
    case "colaboradores": {
      const { data, error } = await supabase
        .from("usuarios")
        .select("nombre, rol, telefono, activo, zona, fecha_vencimiento_licencia")
        .eq("empresa_id", empresaId)
        .order("nombre")
        .limit(limite);
      if (error) return { error: error.message };
      let filas = data ?? [];
      if (texto) {
        const t = texto.toLowerCase();
        filas = filas.filter((u) => u.nombre.toLowerCase().includes(t));
      }
      return { colaboradores: filas };
    }
    case "inventario": {
      let q = supabase
        .from("catalogo_items")
        .select("nombre, sku, tipo, categoria, unidad, precio_base, stock_actual, stock_minimo, activo")
        .eq("empresa_id", empresaId)
        .order("nombre")
        .limit(limite);
      if (texto) q = q.or([like("nombre"), like("sku"), like("categoria")].join(","));
      const { data, error } = await q;
      if (error) return { error: error.message };
      return { inventario: data ?? [] };
    }
    case "proveedores": {
      let q = supabase
        .from("proveedores")
        .select("nombre, razon_social, rut, telefono, correo, activo")
        .eq("empresa_id", empresaId)
        .order("nombre")
        .limit(limite);
      if (texto) q = q.or([like("nombre"), like("razon_social")].join(","));
      const { data, error } = await q;
      if (error) return { error: error.message };
      return { proveedores: data ?? [] };
    }
    case "mantenciones": {
      let q = supabase
        .from("planes_mantencion")
        .select("equipo_id, frecuencia_dias, proxima_fecha, activo, notas")
        .eq("empresa_id", empresaId)
        .order("proxima_fecha")
        .limit(limite);
      if (desde) q = q.gte("proxima_fecha", desde);
      if (hasta) q = q.lte("proxima_fecha", hasta);
      const { data, error } = await q;
      if (error) return { error: error.message };
      const equipos = await mapaNombres("equipos", empresaId, (data ?? []).map((p) => p.equipo_id));
      return {
        mantenciones: (data ?? []).map((p) => ({
          equipo: p.equipo_id ? equipos.get(p.equipo_id) ?? null : null,
          cada_dias: p.frecuencia_dias,
          proxima_fecha: p.proxima_fecha,
          activo: p.activo,
          notas: p.notas,
        })),
      };
    }
    default:
      return { error: `entidad no soportada: "${entidad}"` };
  }
}

async function buscarClientes(input: Record<string, unknown>, empresaId: string): Promise<Record<string, unknown>> {
  const busqueda = typeof input.busqueda === "string" ? input.busqueda.trim() : "";
  const limite = Math.min(typeof input.limite === "number" && input.limite > 0 ? input.limite : 5, 20);

  let query = supabase
    .from("clientes")
    .select("nombre, telefono, correo, direccion, comuna, activo, creado_en")
    .eq("empresa_id", empresaId)
    .limit(limite);

  query = busqueda ? query.ilike("nombre", `%${busqueda}%`).order("nombre") : query.order("creado_en", { ascending: false });

  const { data, error } = await query;
  if (error) return { error: error.message };
  if (!data || data.length === 0) {
    return { mensaje: busqueda ? `No encontré ningún cliente que coincida con "${busqueda}".` : "Todavía no hay clientes registrados." };
  }
  return { clientes: data };
}

async function consultarEstadoConfiguracion(empresaId: string): Promise<Record<string, unknown>> {
  const [{ data: empresa }, { data: notif }, { data: integraciones }] = await Promise.all([
    supabase
      .from("empresas")
      .select("nombre, rut, direccion_calle, telefono_empresa, whatsapp, logo_url, plan, prueba_termina_en")
      .eq("id", empresaId)
      .maybeSingle(),
    supabase
      .from("notificaciones_config")
      .select("correo_activado, whatsapp_activado")
      .eq("empresa_id", empresaId)
      .maybeSingle(),
    supabase.from("integraciones").select("proveedor, categoria, conectado").eq("empresa_id", empresaId),
  ]);

  const faltanDatosEmpresa = [
    !empresa?.rut && "RUT",
    !empresa?.direccion_calle && "dirección",
    !empresa?.telefono_empresa && "teléfono",
    !empresa?.logo_url && "logo",
  ].filter(Boolean);

  const pagos = (integraciones ?? []).filter((i) => i.categoria === "pagos");

  return {
    empresa: {
      nombre: empresa?.nombre ?? null,
      datos_incompletos: faltanDatosEmpresa.length > 0 ? faltanDatosEmpresa : "completos",
      plan: empresa?.plan ?? "trial",
      trial_termina: empresa?.prueba_termina_en ?? null,
    },
    avisos_al_cliente: {
      correo_activado: notif?.correo_activado ?? true,
      whatsapp_activado: notif?.whatsapp_activado ?? true,
      numero_whatsapp_cargado: Boolean(empresa?.whatsapp),
      nota: "El aviso por WhatsApp además requiere que el equipo de Bitácora haya conectado la cuenta de Meta Business de la plataforma.",
    },
    bot_whatsapp_choferes: {
      disponible_en_plataforma: Boolean(env.WHATSAPP_ACCESS_TOKEN),
      nota: "La conexión del bot de WhatsApp la hace el equipo de Bitácora, no se configura desde la app.",
    },
    pasarelas_de_pago: {
      conectadas: pagos.filter((p) => p.conectado).map((p) => p.proveedor),
      nota: "El link de pago al cliente final hoy es simulado — la integración real de pasarela la habilita el equipo de Bitácora.",
    },
  };
}

async function ejecutarHerramienta(
  nombre: string,
  input: Record<string, unknown>,
  empresaId: string
): Promise<Record<string, unknown>> {
  if (nombre === "buscar_clientes") return buscarClientes(input, empresaId);
  if (nombre === "agenda") return consultarAgenda(input, empresaId);
  if (nombre === "consultar_registros") return consultarRegistros(input, empresaId);
  if (nombre === "estado_configuracion") return consultarEstadoConfiguracion(empresaId);
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
        const response = await crearMensajeIA(req.empresaId!, "asistente", {
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
