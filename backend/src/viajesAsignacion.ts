// ============================================================
// Asignar un viaje a un chofer (tarea 133, 24-sep-2026).
//  - El chofer tiene que ser de la MISMA empresa, estar activo y tener
//    la función "chofer" (usuarios.funcion). Antes no se validaba: se
//    podía mandar el id de un usuario de otra empresa.
//  - Aviso al chofer con el flujo de notificaciones existente
//    (notificar → campana) y, si Resend está configurado, también por
//    correo, salvo que el chofer lo haya apagado en sus preferencias.
//    WhatsApp no: fuera de la ventana de 24 h Meta exige una plantilla
//    aprobada, que hoy no existe.
// ============================================================
import { supabase } from "./supabase";
import { env } from "./env";
import { notificar } from "./notificar";
import { enviarConReintento } from "./email";
import { escaparHtml } from "./avisosSuperAdmin";

export async function validarChofer(empresaId: string, choferId: unknown): Promise<{ id: string; nombre: string } | { error: string }> {
  if (typeof choferId !== "string" || !choferId) return { error: "Selecciona un chofer válido" };
  const { data } = await supabase
    .from("usuarios")
    .select("id, nombre, activo, funcion")
    .eq("empresa_id", empresaId)
    .eq("id", choferId)
    .maybeSingle();
  if (!data || !data.activo || data.funcion !== "chofer") {
    return { error: "El chofer tiene que ser un usuario activo de tu empresa con la función Chofer" };
  }
  return { id: data.id, nombre: data.nombre };
}

type ViajeAviso = { id: string; fecha: string; hora: string | null; origen: string; destino: string; cliente: string; numero_guia: string };

export async function avisarViajeAsignado(empresaId: string, choferId: string, viaje: ViajeAviso): Promise<void> {
  const cuando = `${viaje.fecha.split("-").reverse().join("-")}${viaje.hora ? ` a las ${viaje.hora.slice(0, 5)}` : ""}`;
  const cuerpo = `${viaje.origen} → ${viaje.destino} · ${viaje.cliente} · ${cuando} (guía ${viaje.numero_guia})`;
  await notificar(empresaId, choferId, "viaje_asignado", { cuerpo, entidadTipo: "viaje", entidadId: viaje.id });

  if (!env.RESEND_API_KEY || !env.RESEND_FROM_EMAIL) return;
  try {
    const { data: pref } = await supabase
      .from("notificaciones_preferencias")
      .select("email_activado")
      .eq("usuario_id", choferId)
      .eq("tipo", "viaje_asignado")
      .maybeSingle();
    if (pref && !pref.email_activado) return;
    const { data: authUser } = await supabase.auth.admin.getUserById(choferId);
    const correo = authUser?.user?.email;
    if (!correo) return;
    const html = `
      <div style="font-family:sans-serif;max-width:480px;">
        <h2>Tienes un viaje asignado</h2>
        <p><b>${escaparHtml(viaje.origen)} → ${escaparHtml(viaje.destino)}</b></p>
        <p>Cliente: ${escaparHtml(viaje.cliente)}<br>Fecha: ${escaparHtml(cuando)}<br>Guía: ${escaparHtml(viaje.numero_guia)}</p>
        <p>Lo ves en la Pizarra y en tu Agenda de la app.</p>
      </div>`;
    await enviarConReintento({ from: env.RESEND_FROM_EMAIL, to: correo, subject: `Viaje asignado: ${viaje.origen} → ${viaje.destino}`, html }, "el aviso de viaje asignado");
  } catch (err) {
    // El aviso por correo nunca debe romper la asignación.
    console.error("avisarViajeAsignado (correo):", err);
  }
}

// "HH:MM" o "HH:MM:SS" → "HH:MM:SS"; vacío → null; otro → error.
export function normalizarHora(hora: unknown): { hora: string | null } | { error: string } {
  if (hora === undefined || hora === null || hora === "") return { hora: null };
  if (typeof hora !== "string" || !/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/.test(hora)) return { error: "Hora inválida (usa HH:MM)" };
  return { hora: hora.length === 5 ? `${hora}:00` : hora };
}
