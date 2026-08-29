import { Router } from "express";
import type { NotificacionesConfig, TipoMensajePersonalizado } from "@bitacora/shared";
import { supabase } from "../supabase";
import type { RequestConEmpresa } from "../empresa";
import { ah } from "../asyncHandler";
import { requiereModulo } from "../permisos";

export const notificacionesRouter = Router();

const TIPOS_MENSAJE: TipoMensajePersonalizado[] = ["cotizacion", "orden_servicio", "cobranza", "tecnico_en_camino"];

function tipoValido(tipo: string): tipo is TipoMensajePersonalizado {
  return (TIPOS_MENSAJE as string[]).includes(tipo);
}

async function obtenerOCrearConfig(empresaId: string): Promise<NotificacionesConfig> {
  const { data: existente, error: errorBuscar } = await supabase
    .from("notificaciones_config")
    .select("*")
    .eq("empresa_id", empresaId)
    .maybeSingle();
  if (errorBuscar) throw new Error(errorBuscar.message);
  if (existente) return existente;

  const { data: creada, error: errorCrear } = await supabase
    .from("notificaciones_config")
    .insert({ empresa_id: empresaId })
    .select()
    .single();
  if (errorCrear) throw new Error(errorCrear.message);
  return creada;
}

notificacionesRouter.get(
  "/",
  ah<RequestConEmpresa>(async (req, res) => {
    const config = await obtenerOCrearConfig(req.empresaId!);
    const { data: mensajes } = await supabase.from("mensajes_personalizados").select("*").eq("empresa_id", req.empresaId!);
    const porTipo = new Map((mensajes ?? []).map((m) => [m.tipo, m]));

    res.json({
      config,
      mensajes: Object.fromEntries(TIPOS_MENSAJE.map((t) => [t, porTipo.get(t) ?? null])),
    });
  })
);

notificacionesRouter.patch(
  "/",
  requiereModulo("configuracion"),
  ah<RequestConEmpresa>(async (req, res) => {
    const actual = await obtenerOCrearConfig(req.empresaId!);
    const camposBooleanos: (keyof NotificacionesConfig)[] = [
      "correo_activado",
      "cotizacion_creada",
      "cotizacion_aprobada",
      "cotizacion_rechazada",
      "os_creada",
      "os_completada",
      "cobranza_recibida",
      "cobranza_atrasada",
      "cotizacion_enviada",
      "cotizacion_por_vencer",
      "tecnico_en_camino",
      "cobro_pendiente",
    ];
    const cambios: Partial<NotificacionesConfig> = { actualizado_en: new Date().toISOString() };
    for (const campo of camposBooleanos) {
      if (req.body?.[campo] !== undefined) (cambios as Record<string, unknown>)[campo] = Boolean(req.body[campo]);
    }
    if (req.body?.dias_aviso_vencimiento !== undefined) {
      const dias = Number(req.body.dias_aviso_vencimiento);
      if (!Number.isInteger(dias) || dias < 0) {
        res.status(400).json({ error: "dias_aviso_vencimiento debe ser un entero positivo" });
        return;
      }
      cambios.dias_aviso_vencimiento = dias;
    }

    // tenant-ok: obtenerOCrearConfig() arriba ya scopeó por empresa_id.
    const { data, error } = await supabase
      .from("notificaciones_config")
      .update(cambios)
      .eq("id", actual.id)
      .select()
      .single();

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    res.json(data);
  })
);

notificacionesRouter.patch(
  "/mensajes/:tipo",
  requiereModulo("configuracion"),
  ah<RequestConEmpresa>(async (req, res) => {
    if (!tipoValido(req.params.tipo)) {
      res.status(400).json({ error: `tipo debe ser uno de: ${TIPOS_MENSAJE.join(", ")}` });
      return;
    }
    const { mensaje_whatsapp, asunto_correo, cuerpo_correo } = req.body ?? {};

    const { data: existente } = await supabase
      .from("mensajes_personalizados")
      .select("id")
      .eq("empresa_id", req.empresaId!)
      .eq("tipo", req.params.tipo)
      .maybeSingle();

    const cambios = {
      mensaje_whatsapp: mensaje_whatsapp?.trim() || null,
      asunto_correo: asunto_correo?.trim() || null,
      cuerpo_correo: cuerpo_correo?.trim() || null,
      actualizado_en: new Date().toISOString(),
    };

    const { data, error } = existente
      ? await supabase.from("mensajes_personalizados").update(cambios).eq("id", existente.id).select().single()
      : await supabase
          .from("mensajes_personalizados")
          .insert({ empresa_id: req.empresaId!, tipo: req.params.tipo, ...cambios })
          .select()
          .single();

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    res.json(data);
  })
);
