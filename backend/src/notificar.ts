// ============================================================
// BITÁCORA — Generador central de notificaciones internas. Un solo
// punto de entrada para insertar en el feed, llamado desde donde ya
// ocurre cada evento (no hay un job/cron aparte) — agregar un tipo de
// evento nuevo es una llamada más a notificar(), no un sistema nuevo.
// ============================================================
import type { EntidadNotificacion, TipoNotificacion } from "@bitacora/shared";
import { supabase } from "./supabase";

const TITULOS: Record<TipoNotificacion, string> = {
  os_asignada: "Nueva orden de servicio asignada",
  os_completada: "Orden de servicio completada",
  cobro_por_vencer: "Cobro próximo a vencer",
  cobro_vencido: "Cobro vencido",
  ruta_finalizada: "Ruta finalizada",
  tarea_retrasada: "Tarea retrasada",
  licencia_por_vencer: "Licencia próxima a vencer",
  email_fallido: "No se pudo enviar un correo",
  cotizacion_aprobada: "Cotización aprobada por el cliente",
  tarea_asignada: "Nueva tarea de agenda asignada",
};

export async function notificar(
  empresaId: string,
  usuarioId: string,
  tipo: TipoNotificacion,
  opciones: { cuerpo?: string; entidadTipo?: EntidadNotificacion; entidadId?: string } = {}
): Promise<void> {
  try {
    const { data: preferencia } = await supabase
      .from("notificaciones_preferencias")
      .select("app_activado")
      .eq("usuario_id", usuarioId)
      .eq("tipo", tipo)
      .maybeSingle();
    // Sin fila = preferencia por defecto (activada) — no todos los
    // usuarios tienen fila para todos los tipos hasta que la tocan.
    if (preferencia && !preferencia.app_activado) return;

    const { error } = await supabase.from("notificaciones").insert({
      empresa_id: empresaId,
      usuario_id: usuarioId,
      tipo,
      titulo: TITULOS[tipo],
      cuerpo: opciones.cuerpo ?? null,
      entidad_tipo: opciones.entidadTipo ?? null,
      entidad_id: opciones.entidadId ?? null,
    });
    if (error) console.error("Error creando notificación:", error);
  } catch (err) {
    // Una notificación que falla nunca debe romper el flujo principal
    // (crear la OS, cerrarla, etc.) — se loguea y sigue.
    console.error("Error en notificar():", err);
  }
}

// Notifica a todos los admin+supervisor de la empresa (ej. OS
// completada) — evita repetir el "buscar destinatarios" en cada
// evento que aplica a "la gerencia" en vez de a una persona puntual.
export async function notificarGerencia(
  empresaId: string,
  tipo: TipoNotificacion,
  opciones: { cuerpo?: string; entidadTipo?: EntidadNotificacion; entidadId?: string } = {}
): Promise<void> {
  const { data: destinatarios } = await supabase
    .from("usuarios")
    .select("id")
    .eq("empresa_id", empresaId)
    .in("rol", ["admin", "supervisor"])
    .eq("activo", true);
  await Promise.all((destinatarios ?? []).map((u) => notificar(empresaId, u.id, tipo, opciones)));
}
