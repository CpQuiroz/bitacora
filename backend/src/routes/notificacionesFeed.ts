// ============================================================
// BITÁCORA — Centro de notificaciones (feed real, con leído/no
// leído). Distinto de routes/notificaciones.ts, que sigue siendo la
// configuración de qué eventos mandan correo a nivel empresa.
// ============================================================
import { Router } from "express";
import type { TipoNotificacion } from "@bitacora/shared";
import { supabase } from "../supabase";
import { notificar, notificarGerencia } from "../notificar";
import type { RequestConEmpresa } from "../empresa";
import { ah } from "../asyncHandler";

export const notificacionesFeedRouter = Router();

async function yaNotificado(empresaId: string, tipo: TipoNotificacion, entidadId: string): Promise<boolean> {
  const { data } = await supabase
    .from("notificaciones")
    .select("id")
    .eq("empresa_id", empresaId)
    .eq("tipo", tipo)
    .eq("entidad_id", entidadId)
    .limit(1)
    .maybeSingle();
  return Boolean(data);
}

// Sin cron en este proyecto: cada vez que alguien abre el centro de
// notificaciones, se revisa rápido si hay facturas/licencias que
// cruzaron el umbral desde la última vez y se insertan ahí mismo —
// dedupe por (empresa, tipo, entidad_id) para no repetir la alerta.
async function generarVencimientosPerezosos(empresaId: string) {
  const hoy = new Date().toISOString().slice(0, 10);
  const en7Dias = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const { data: facturas } = await supabase
    .from("facturas")
    .select("id, cliente, monto, fecha_vencimiento")
    .eq("empresa_id", empresaId)
    .eq("estado", "pendiente")
    .lte("fecha_vencimiento", en7Dias);

  for (const f of facturas ?? []) {
    const tipo: TipoNotificacion = f.fecha_vencimiento < hoy ? "cobro_vencido" : "cobro_por_vencer";
    if (await yaNotificado(empresaId, tipo, f.id)) continue;
    await notificarGerencia(empresaId, tipo, {
      cuerpo: `${f.cliente} — $${Math.round(f.monto).toLocaleString("es-CL")}, vence ${f.fecha_vencimiento}`,
      entidadTipo: "factura",
      entidadId: f.id,
    });
  }

  const { data: usuarios } = await supabase
    .from("usuarios")
    .select("id, nombre, fecha_vencimiento_licencia")
    .eq("empresa_id", empresaId)
    .eq("activo", true)
    .not("fecha_vencimiento_licencia", "is", null)
    .lte("fecha_vencimiento_licencia", en7Dias);

  for (const u of usuarios ?? []) {
    if (await yaNotificado(empresaId, "licencia_por_vencer", u.id)) continue;
    const cuerpo = `Licencia de ${u.nombre} vence ${u.fecha_vencimiento_licencia}`;
    await notificar(empresaId, u.id, "licencia_por_vencer", { cuerpo, entidadTipo: "usuario", entidadId: u.id });
    await notificarGerencia(empresaId, "licencia_por_vencer", { cuerpo, entidadTipo: "usuario", entidadId: u.id });
  }

  // Tarea retrasada: el día programado ya pasó y sigue "en_curso".
  const { data: trabajos } = await supabase
    .from("trabajos")
    .select("id, cliente, fecha, responsable_id")
    .eq("empresa_id", empresaId)
    .eq("estado", "en_curso")
    .lt("fecha", hoy);

  for (const t of trabajos ?? []) {
    if (await yaNotificado(empresaId, "tarea_retrasada", t.id)) continue;
    const cuerpo = `${t.cliente} — programada para ${t.fecha}`;
    if (t.responsable_id) {
      await notificar(empresaId, t.responsable_id, "tarea_retrasada", { cuerpo, entidadTipo: "trabajo", entidadId: t.id });
    }
    await notificarGerencia(empresaId, "tarea_retrasada", { cuerpo, entidadTipo: "trabajo", entidadId: t.id });
  }
}

notificacionesFeedRouter.get(
  "/",
  ah<RequestConEmpresa>(async (req, res) => {
    // Solo admin/supervisor disparan la revisión de vencimientos (evita
    // que se dispare N veces si varios colaboradores abren el panel a
    // la vez, y son igual los únicos destinatarios de esas alertas).
    if (req.rol === "admin" || req.rol === "supervisor") {
      await generarVencimientosPerezosos(req.empresaId!);
    }

    const { data, error } = await supabase
      .from("notificaciones")
      .select("*")
      .eq("empresa_id", req.empresaId!)
      .eq("usuario_id", req.userId!)
      .order("creado_en", { ascending: false })
      .limit(50);

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    res.json(data);
  })
);

notificacionesFeedRouter.patch(
  "/:id",
  ah<RequestConEmpresa>(async (req, res) => {
    const { leido } = req.body ?? {};
    const { data, error } = await supabase
      .from("notificaciones")
      .update({ leido: leido !== false })
      .eq("empresa_id", req.empresaId!)
      .eq("usuario_id", req.userId!)
      .eq("id", req.params.id)
      .select()
      .maybeSingle();

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    if (!data) {
      res.status(404).json({ error: "Notificación no encontrada" });
      return;
    }
    res.json(data);
  })
);

notificacionesFeedRouter.post(
  "/marcar-todas",
  ah<RequestConEmpresa>(async (req, res) => {
    const { error } = await supabase
      .from("notificaciones")
      .update({ leido: true })
      .eq("empresa_id", req.empresaId!)
      .eq("usuario_id", req.userId!)
      .eq("leido", false);

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    res.status(204).end();
  })
);

export const TIPOS_NOTIFICACION: TipoNotificacion[] = [
  "os_asignada",
  "os_completada",
  "cobro_por_vencer",
  "cobro_vencido",
  "ruta_finalizada",
  "tarea_retrasada",
  "licencia_por_vencer",
  "email_fallido",
  "cotizacion_aprobada",
];

// Preferencias por-usuario (canal "dentro de la app" ya funciona; el
// campo de correo queda guardado para cuando se conecte el envío real).
notificacionesFeedRouter.get(
  "/preferencias",
  ah<RequestConEmpresa>(async (req, res) => {
    const { data, error } = await supabase
      .from("notificaciones_preferencias")
      .select("*")
      .eq("usuario_id", req.userId!);
    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    const guardadas = new Map((data ?? []).map((p) => [p.tipo, p]));
    res.json(
      TIPOS_NOTIFICACION.map(
        (tipo) => guardadas.get(tipo) ?? { usuario_id: req.userId!, tipo, app_activado: true, email_activado: false }
      )
    );
  })
);

notificacionesFeedRouter.patch(
  "/preferencias/:tipo",
  ah<RequestConEmpresa>(async (req, res) => {
    const tipo = req.params.tipo as TipoNotificacion;
    if (!TIPOS_NOTIFICACION.includes(tipo)) {
      res.status(400).json({ error: `tipo debe ser uno de: ${TIPOS_NOTIFICACION.join(", ")}` });
      return;
    }
    const { app_activado, email_activado } = req.body ?? {};

    const { data: existente } = await supabase
      .from("notificaciones_preferencias")
      .select("*")
      .eq("usuario_id", req.userId!)
      .eq("tipo", tipo)
      .maybeSingle();

    const { data, error } = await supabase
      .from("notificaciones_preferencias")
      .upsert(
        {
          usuario_id: req.userId!,
          tipo,
          app_activado: app_activado !== undefined ? Boolean(app_activado) : (existente?.app_activado ?? true),
          email_activado: email_activado !== undefined ? Boolean(email_activado) : (existente?.email_activado ?? false),
        },
        { onConflict: "usuario_id,tipo" }
      )
      .select()
      .single();

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    res.json(data);
  })
);
