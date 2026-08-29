// ============================================================
// BITÁCORA — Notificaciones automáticas al CLIENTE por correo.
// Distinto de notificar.ts (feed interno del equipo): esto le manda
// un email real a un cliente externo, respeta los switches de
// Configuración > Notificaciones y el mensaje personalizado si existe.
//
// Mismo criterio que notificar(): nunca lanza — un envío al cliente
// que falla no puede romper el flujo que lo disparó (marcar una OS
// como firmada, enviar una cotización, etc.), solo queda registrado
// en notificaciones_cliente_log para poder reenviarlo a mano.
// ============================================================
import type { EntidadNotificacionCliente, NotificacionesConfig, TipoMensajePersonalizado, TipoNotificacionCliente } from "@bitacora/shared";
import { sustituirVariables } from "@bitacora/shared";
import { supabase } from "./supabase";
import { env } from "./env";
import { enviarConReintento } from "./email";

const ASUNTOS_DEFAULT: Record<TipoNotificacionCliente, string> = {
  cotizacion_enviada: "Tu cotización de {empresa}",
  cotizacion_por_vencer: "Tu cotización está por vencer",
  tecnico_en_camino: "Tu técnico va en camino",
  os_completada: "Tu servicio fue completado",
  cobro_pendiente: "Tienes un cobro pendiente",
  cobro_vencido: "Tienes un cobro vencido",
  cita_agendada: "Tu cita con {empresa}",
};

const CUERPOS_DEFAULT: Record<TipoNotificacionCliente, string> = {
  cotizacion_enviada: "<p>Hola {cliente}, adjuntamos tu cotización de {empresa}.</p>",
  cotizacion_por_vencer: "<p>Hola {cliente}, tu cotización de {empresa} vence el {fecha} — contáctanos si tienes dudas.</p>",
  tecnico_en_camino: "<p>Hola {cliente}, nuestro técnico {tecnico} va en camino a tu dirección.</p>",
  os_completada: "<p>Hola {cliente}, adjuntamos el comprobante de tu servicio con {empresa}.</p>",
  cobro_pendiente: "<p>Hola {cliente}, tienes un cobro pendiente de {monto} con vencimiento el {fecha}.</p>",
  cobro_vencido: "<p>Hola {cliente}, tu cobro de {monto} venció el {fecha}. Contáctanos para regularizarlo.</p>",
  cita_agendada:
    "<p>Hola {cliente}, tienes una cita agendada con {empresa} el {fecha}{hora}. Confírmala o cancélala desde tu portal.</p>",
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
};

function activado(config: NotificacionesConfig | null, tipo: TipoNotificacionCliente): boolean {
  // Sin fila de config = todavía nadie tocó Configuración > Notificaciones
  // — mismo criterio que notificar() interno: por defecto activado.
  if (!config) return true;
  if (!config.correo_activado) return false;
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
  }
}

async function registrar(
  empresaId: string,
  tipo: TipoNotificacionCliente,
  destinatario: string,
  entidadTipo: EntidadNotificacionCliente,
  entidadId: string,
  exito: boolean,
  error: string | null
): Promise<void> {
  const { error: errorInsert } = await supabase.from("notificaciones_cliente_log").insert({
    empresa_id: empresaId,
    tipo,
    destinatario,
    entidad_tipo: entidadTipo,
    entidad_id: entidadId,
    exito,
    error,
  });
  if (errorInsert) console.error("Error registrando notificaciones_cliente_log:", errorInsert.message);
}

// Eventos que apuntan a un documento concreto que vale la pena poder
// revisar de nuevo después — se les agrega un link al Portal de
// Cliente en el correo. "técnico en camino" queda afuera: es un aviso
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
};

export async function notificarCliente(
  empresaId: string,
  tipo: TipoNotificacionCliente,
  destinatario: string,
  opciones: OpcionesNotificarCliente
): Promise<void> {
  try {
    const { data: config } = await supabase.from("notificaciones_config").select("*").eq("empresa_id", empresaId).maybeSingle();
    if (!activado(config, tipo)) return;

    const { data: personalizado } = await supabase
      .from("mensajes_personalizados")
      .select("asunto_correo, cuerpo_correo")
      .eq("empresa_id", empresaId)
      .eq("tipo", TIPO_MENSAJE[tipo])
      .maybeSingle();

    const asunto = sustituirVariables(personalizado?.asunto_correo || ASUNTOS_DEFAULT[tipo], opciones.variables);
    let cuerpo = sustituirVariables(personalizado?.cuerpo_correo || CUERPOS_DEFAULT[tipo], opciones.variables);

    const url = await linkPortal(empresaId, opciones.clienteId, tipo, opciones.entidadId);
    if (url) {
      cuerpo += `<p style="margin-top:20px;"><a href="${url}" style="display:inline-block;padding:10px 18px;background:#4338ca;color:#fff;text-decoration:none;border-radius:8px;font-weight:600;">Ver en mi portal</a></p>`;
    }

    const body: Record<string, unknown> = {
      from: env.RESEND_FROM_EMAIL,
      to: destinatario,
      subject: asunto,
      html: `<div style="font-family:sans-serif;max-width:520px;margin:0 auto;">${cuerpo}</div>`,
    };
    if (opciones.adjunto) {
      body.attachments = [{ filename: opciones.adjunto.filename, content: opciones.adjunto.buffer.toString("base64") }];
    }

    await enviarConReintento(body, tipo);
    await registrar(empresaId, tipo, destinatario, opciones.entidadTipo, opciones.entidadId, true, null);
  } catch (err) {
    const mensaje = err instanceof Error ? err.message : String(err);
    console.error(`Error notificando al cliente (${tipo}):`, mensaje);
    await registrar(empresaId, tipo, destinatario, opciones.entidadTipo, opciones.entidadId, false, mensaje);
  }
}
