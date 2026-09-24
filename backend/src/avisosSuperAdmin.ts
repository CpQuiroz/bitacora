// ============================================================
// Correo a los Super-Admin activos (tarea 124): cotización del plan
// Empresa y "Solicitar más módulos". Un solo lugar que arma el
// destinatario, el reply-to y escapa lo que escribió la empresa.
// ============================================================
import { supabase } from "./supabase";
import { env } from "./env";
import { enviarConReintento } from "./email";

export function escaparHtml(texto: string): string {
  return texto.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

export class SinSuperAdminsError extends Error {
  status = 503;
  constructor() {
    super("No pudimos enviar tu solicitud en este momento. Intenta de nuevo más tarde.");
    this.name = "SinSuperAdminsError";
  }
}

// `html` ya tiene que venir escapado (usar escaparHtml con todo lo que
// escribió el usuario). Lanza si no hay destinatarios o si Resend falla.
export async function avisarSuperAdmins(asunto: string, html: string, responderA: string | null, contexto: string): Promise<void> {
  const { data: admins, error } = await supabase.from("super_admins").select("correo").eq("activo", true).limit(50);
  if (error) throw new Error(`No se pudo leer a quién avisar: ${error.message}`);
  const destinatarios = (admins ?? []).map((a) => a.correo).filter(Boolean);
  if (destinatarios.length === 0) throw new SinSuperAdminsError();
  await enviarConReintento(
    { from: env.RESEND_FROM_EMAIL, to: destinatarios, reply_to: responderA ?? undefined, subject: asunto, html },
    contexto
  );
}
