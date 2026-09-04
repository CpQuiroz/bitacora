// ============================================================
// BITÁCORA — Notificaciones automáticas al CLIENTE, por correo y/o
// WhatsApp. Distinto de notificar.ts (feed interno del equipo): esto
// le manda un aviso real a un cliente externo, respeta los switches
// de Configuración > Notificaciones (por tipo y por canal) y el
// mensaje personalizado si existe.
//
// Mismo criterio que notificar(): nunca lanza — un envío al cliente
// que falla no puede romper el flujo que lo disparó (marcar una OS
// como firmada, enviar una cotización, etc.), solo queda registrado
// en notificaciones_cliente_log (una fila por canal intentado) para
// poder reenviarlo a mano.
// ============================================================
import type {
  CanalNotificacionCliente,
  EntidadNotificacionCliente,
  NotificacionesConfig,
  TipoMensajePersonalizado,
  TipoNotificacionCliente,
} from "@bitacora/shared";
import { sustituirVariables } from "@bitacora/shared";
import { supabase } from "./supabase";
import { env } from "./env";
import { enviarConReintento } from "./email";
import { enviarMensajeWhatsapp } from "./whatsapp";
import { linkBajaAvisos } from "./bajaAvisos";

const ASUNTOS_DEFAULT: Record<TipoNotificacionCliente, string> = {
  cotizacion_enviada: "Tu cotización de {empresa}",
  cotizacion_por_vencer: "Tu cotización está por vencer",
  tecnico_en_camino: "Tu técnico va en camino",
  os_completada: "Tu servicio fue completado",
  cobro_pendiente: "Tienes un cobro pendiente",
  cobro_vencido: "Tienes un cobro vencido",
  cita_agendada: "Tu cita con {empresa}",
  cita_cancelada: "Tu cita con {empresa} fue cancelada",
  cliente_cumpleanos: "¡Feliz cumpleaños de parte de {empresa}!",
};

const CUERPOS_DEFAULT: Record<TipoNotificacionCliente, string> = {
  cotizacion_enviada: "<p>Hola {cliente}, adjuntamos tu cotización de {empresa}.</p>",
  cotizacion_por_vencer: "<p>Hola {cliente}, tu cotización de {empresa} vence el {fecha} — contáctanos si tienes dudas.</p>",
  tecnico_en_camino: "<p>Hola {cliente}, nuestro técnico {tecnico} va en camino a tu dirección.</p>",
  os_completada: "<p>Hola {cliente}, adjuntamos el comprobante de tu servicio con {empresa}.</p>",
  cobro_pendiente: "<p>Hola {cliente}, tienes un cobro pendiente de {monto} con vencimiento el {fecha}.</p>",
  cobro_vencido: "<p>Hola {cliente}, tu cobro de {monto} venció el {fecha}. Contáctanos para regularizarlo.</p>",
  cita_agendada:
    "<p>Hola {cliente}, tienes una cita agendada con {empresa} el {fecha}{hora}.</p>{direccion}<p>Confírmala o cancélala desde tu portal.</p>",
  cita_cancelada: "<p>Hola {cliente}, tu cita con {empresa} del {fecha}{hora} fue cancelada. Si fue un error o quieres reagendar, contáctanos.</p>",
  cliente_cumpleanos: "<p>¡Feliz cumpleaños, {cliente}! Todo el equipo de {empresa} te desea un gran día.{descuento}</p>",
};

// Mismo contenido que CUERPOS_DEFAULT pero en texto plano (sin HTML) —
// WhatsApp no renderiza etiquetas.
const WHATSAPP_DEFAULT: Record<TipoNotificacionCliente, string> = {
  cotizacion_enviada: "Hola {cliente}, te enviamos tu cotización de {empresa}.",
  cotizacion_por_vencer: "Hola {cliente}, tu cotización de {empresa} vence el {fecha} — contáctanos si tienes dudas.",
  tecnico_en_camino: "Hola {cliente}, nuestro técnico {tecnico} va en camino a tu dirección.",
  os_completada: "Hola {cliente}, tu servicio con {empresa} fue completado.",
  cobro_pendiente: "Hola {cliente}, tienes un cobro pendiente de {monto} con vencimiento el {fecha}.",
  cobro_vencido: "Hola {cliente}, tu cobro de {monto} venció el {fecha}. Contáctanos para regularizarlo.",
  cita_agendada: "Hola {cliente}, tienes una cita agendada con {empresa} el {fecha}{hora}. Confírmala o cancélala desde tu portal.",
  cita_cancelada: "Hola {cliente}, tu cita con {empresa} del {fecha}{hora} fue cancelada. Si fue un error o quieres reagendar, contáctanos.",
  cliente_cumpleanos: "¡Feliz cumpleaños, {cliente}! Todo el equipo de {empresa} te desea un gran día.{descuento}",
};

// Algunos eventos comparten el mismo "tipo" de mensaje personalizado
// (ej. cobro pendiente y vencido usan el mismo texto de "cobranza").
const TIPO_MENSAJE: Record<TipoNotificacionCliente, TipoMensajePersonalizado> = {
  cotizacion_enviada: "cotizacion",
  cotizacion_por_vencer: "cotizacion",
  tecnico_en_camino: "tecnico_en_camino",
  os_completada: "orden_servicio",
  cobro_pendiente: "cobranza",
  cobro_vencido: "cobranza",
  cita_agendada: "cita_agendada",
  cita_cancelada: "cita_cancelada",
  cliente_cumpleanos: "cumpleanos",
};

// "¿Este TIPO de evento está prendido?" — independiente del canal (el
// canal se apaga/prende aparte, ver correoActivado/whatsappActivado
// más abajo). Antes este chequeo venía mezclado con correo_activado.
function tipoActivado(config: NotificacionesConfig | null, tipo: TipoNotificacionCliente): boolean {
  // Sin fila de config = todavía nadie tocó Configuración > Notificaciones
  // — mismo criterio que notificar() interno: por defecto activado.
  if (!config) return true;
  switch (tipo) {
    case "cotizacion_enviada":
      return config.cotizacion_enviada;
    case "cotizacion_por_vencer":
      return config.cotizacion_por_vencer;
    case "tecnico_en_camino":
      return config.tecnico_en_camino;
    case "os_completada":
      return config.os_completada;
    case "cobro_pendiente":
      return config.cobro_pendiente;
    case "cobro_vencido":
      return config.cobranza_atrasada;
    case "cita_agendada":
      return config.cita_agendada;
    case "cita_cancelada":
      return config.cita_cancelada;
    case "cliente_cumpleanos":
      return config.cliente_cumpleanos;
  }
}

async function registrar(
  empresaId: string,
  tipo: TipoNotificacionCliente,
  destinatario: string,
  entidadTipo: EntidadNotificacionCliente,
  entidadId: string,
  canal: CanalNotificacionCliente,
  exito: boolean,
  error: string | null
): Promise<void> {
  const { error: errorInsert } = await supabase.from("notificaciones_cliente_log").insert({
    empresa_id: empresaId,
    tipo,
    destinatario,
    entidad_tipo: entidadTipo,
    entidad_id: entidadId,
    canal,
    exito,
    error,
  });
  if (errorInsert) console.error("Error registrando notificaciones_cliente_log:", errorInsert.message);
}

// Eventos que apuntan a un documento concreto que vale la pena poder
// revisar de nuevo después — se les agrega un link al Portal de
// Cliente en el aviso. "técnico en camino" queda afuera: es un aviso
// de estado, no un documento.
const ENTIDAD_PORTAL: Partial<Record<TipoNotificacionCliente, "trabajo" | "cotizacion" | "factura" | "tarea">> = {
  cotizacion_enviada: "cotizacion",
  cotizacion_por_vencer: "cotizacion",
  os_completada: "trabajo",
  cobro_pendiente: "factura",
  cobro_vencido: "factura",
  cita_agendada: "tarea",
};

async function linkPortal(empresaId: string, clienteId: string, tipo: TipoNotificacionCliente, entidadId: string): Promise<string | null> {
  const entidadTipo = ENTIDAD_PORTAL[tipo];
  if (!entidadTipo) return null;
  const { data, error } = await supabase
    .from("portal_accesos")
    .insert({
      empresa_id: empresaId,
      cliente_id: clienteId,
      entidad_tipo: entidadTipo,
      entidad_id: entidadId,
      expira_en: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    })
    .select("id")
    .single();
  if (error || !data) {
    console.error("Error creando acceso de portal:", error?.message);
    return null;
  }
  return `${env.WEB_URL}/portal/acceder?token=${data.id}`;
}

export type OpcionesNotificarCliente = {
  clienteId: string;
  entidadTipo: EntidadNotificacionCliente;
  entidadId: string;
  variables: Record<string, string>;
  adjunto?: { filename: string; buffer: Buffer };
  // Si viene y el canal WhatsApp está activado para la empresa, se
  // manda también por WhatsApp — independiente de si hay correo.
  telefono?: string | null;
  // Reenvío explícito pedido por el usuario (POST /:id/reenviar) —
  // salta el anti-duplicado por ventana. Los disparos automáticos no
  // lo pasan.
  forzar?: boolean;
};

// Anti-duplicado (AUDITORIA_RESILIENCIA.md R3): si el mismo evento ya se
// envió con éxito por este canal hace poco, un reintento de la request
// que lo disparó (doble-click, reinicio de Render a mitad de camino) no
// vuelve a molestar al cliente. Ventana corta: los eventos "de una vez"
// (cotización enviada, OS completada, cita agendada) pasan solo la
// primera vez; los recurrentes (cobro vencido) ya deduplican aguas
// arriba para siempre, así que la ventana no los afecta.
const VENTANA_DEDUPE_MIN = 120;

async function yaEnviadoRecientemente(
  empresaId: string,
  tipo: TipoNotificacionCliente,
  entidadId: string,
  canal: CanalNotificacionCliente
): Promise<boolean> {
  const desde = new Date(Date.now() - VENTANA_DEDUPE_MIN * 60_000).toISOString();
  const { data } = await supabase
    .from("notificaciones_cliente_log")
    .select("id")
    .eq("empresa_id", empresaId)
    .eq("tipo", tipo)
    .eq("entidad_id", entidadId)
    .eq("canal", canal)
    .eq("exito", true)
    .gte("creado_en", desde)
    .limit(1)
    .maybeSingle();
  return Boolean(data);
}

async function enviarPorCorreo(
  empresaId: string,
  tipo: TipoNotificacionCliente,
  destinatario: string,
  opciones: OpcionesNotificarCliente,
  personalizado: { asunto_correo: string | null; cuerpo_correo: string | null } | null,
  url: string | null
): Promise<void> {
  try {
    const asunto = sustituirVariables(personalizado?.asunto_correo || ASUNTOS_DEFAULT[tipo], opciones.variables);
    let cuerpo = sustituirVariables(personalizado?.cuerpo_correo || CUERPOS_DEFAULT[tipo], opciones.variables);
    if (url) {
      cuerpo += `<p style="margin-top:20px;"><a href="${url}" style="display:inline-block;padding:10px 18px;background:#4338ca;color:#fff;text-decoration:none;border-radius:8px;font-weight:600;">Ver en mi portal</a></p>`;
    }

    // Ley 21.719 — link de oposición al contacto (derecho de baja).
    const pieBaja = opciones.clienteId
      ? `<p style="margin-top:28px;font-size:12px;color:#888;">Si no quieres recibir más avisos como este, <a href="${linkBajaAvisos(empresaId, opciones.clienteId)}" style="color:#888;">haz clic aquí para darte de baja</a>.</p>`
      : "";

    const body: Record<string, unknown> = {
      from: env.RESEND_FROM_EMAIL,
      to: destinatario,
      subject: asunto,
      html: `<div style="font-family:sans-serif;max-width:520px;margin:0 auto;">${cuerpo}${pieBaja}</div>`,
    };
    if (opciones.adjunto) {
      body.attachments = [{ filename: opciones.adjunto.filename, content: opciones.adjunto.buffer.toString("base64") }];
    }

    await enviarConReintento(body, tipo);
    await registrar(empresaId, tipo, destinatario, opciones.entidadTipo, opciones.entidadId, "correo", true, null);
  } catch (err) {
    const mensaje = err instanceof Error ? err.message : String(err);
    console.error(`Error notificando al cliente por correo (${tipo}):`, mensaje);
    await registrar(empresaId, tipo, destinatario, opciones.entidadTipo, opciones.entidadId, "correo", false, mensaje);
  }
}

async function enviarPorWhatsapp(
  empresaId: string,
  tipo: TipoNotificacionCliente,
  telefono: string,
  opciones: OpcionesNotificarCliente,
  mensajeWhatsapp: string | null | undefined,
  url: string | null
): Promise<void> {
  let texto = sustituirVariables(mensajeWhatsapp || WHATSAPP_DEFAULT[tipo], opciones.variables);
  if (url) texto += `\n\nVer más: ${url}`;
  const resultado = await enviarMensajeWhatsapp(telefono, texto);
  await registrar(empresaId, tipo, telefono, opciones.entidadTipo, opciones.entidadId, "whatsapp", resultado.ok, resultado.error ?? null);
}

export async function notificarCliente(
  empresaId: string,
  tipo: TipoNotificacionCliente,
  destinatario: string | null,
  opciones: OpcionesNotificarCliente
): Promise<void> {
  const { data: config } = await supabase.from("notificaciones_config").select("*").eq("empresa_id", empresaId).maybeSingle();
  if (!tipoActivado(config, tipo)) return;

  // Ley 21.719 — el cliente ejerció su derecho de oposición ("no recibir
  // más avisos", link en los correos). Se respeta siempre, aun con forzar.
  if (opciones.clienteId) {
    const { data: cli } = await supabase
      .from("clientes")
      .select("notificaciones_opt_out")
      .eq("id", opciones.clienteId)
      .maybeSingle();
    if (cli?.notificaciones_opt_out) return;
  }

  const { data: personalizado } = await supabase
    .from("mensajes_personalizados")
    .select("asunto_correo, cuerpo_correo, mensaje_whatsapp")
    .eq("empresa_id", empresaId)
    .eq("tipo", TIPO_MENSAJE[tipo])
    .maybeSingle();

  const url = await linkPortal(empresaId, opciones.clienteId, tipo, opciones.entidadId);

  const correoActivado = config?.correo_activado ?? true;
  const whatsappActivado = config?.whatsapp_activado ?? true;

  if (destinatario && correoActivado) {
    if (opciones.forzar || !(await yaEnviadoRecientemente(empresaId, tipo, opciones.entidadId, "correo"))) {
      await enviarPorCorreo(empresaId, tipo, destinatario, opciones, personalizado, url);
    }
  }
  if (opciones.telefono && whatsappActivado) {
    if (opciones.forzar || !(await yaEnviadoRecientemente(empresaId, tipo, opciones.entidadId, "whatsapp"))) {
      await enviarPorWhatsapp(empresaId, tipo, opciones.telefono, opciones, personalizado?.mensaje_whatsapp, url);
    }
  }
}
