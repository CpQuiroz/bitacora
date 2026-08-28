import { Router } from "express";
import type { EstadoOS, OrdenServicio } from "@bitacora/shared";
import { supabase } from "../supabase";
import { urlFirmada } from "../storage";
import type { RequestConEmpresa } from "../empresa";
import { ah } from "../asyncHandler";

export const ordenesServicioRouter = Router();

const ESTADOS_OS: EstadoOS[] = ["pendiente", "enviada", "en_proceso", "completada", "firmada"];

type TrabajoConOrden = {
  id: string;
  [key: string]: unknown;
  orden: OrdenServicio | null;
};

// Panel de seguimiento: todas las OS de la empresa, con filtros.
ordenesServicioRouter.get(
  "/",
  ah<RequestConEmpresa>(async (req, res) => {
    const { estado_os, responsable_id, cliente_id, desde, hasta } = req.query;

    let query = supabase
      .from("trabajos")
      .select(
        "*, cliente_info:clientes(nombre), responsable:usuarios(nombre), orden:ordenes_servicio(*)"
      )
      .eq("empresa_id", req.empresaId!)
      .order("fecha", { ascending: false });

    if (typeof responsable_id === "string" && responsable_id) {
      query = query.eq("responsable_id", responsable_id);
    }
    if (typeof cliente_id === "string" && cliente_id) {
      query = query.eq("cliente_id", cliente_id);
    }
    if (typeof desde === "string" && desde) query = query.gte("fecha", desde);
    if (typeof hasta === "string" && hasta) query = query.lte("fecha", hasta);

    const { data, error } = await query;
    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    // PostgREST no siempre infiere que ordenes_servicio.trabajo_id es
    // 1-a-1 desde este lado del embed (viene del "many" side de la FK) y
    // a veces devuelve "orden" como array de 0-1 elementos en vez de
    // objeto — se normaliza acá en vez de depender de esa inferencia.
    let resultado = ((data ?? []) as unknown as (TrabajoConOrden & { orden: unknown })[]).map((t) => ({
      ...t,
      orden: (Array.isArray(t.orden) ? t.orden[0] : t.orden) ?? null,
    })) as TrabajoConOrden[];
    // Solo trabajos que tienen una OS eager-creada (todos los nuevos la
    // tienen — los muy antiguos, de antes de esta funcionalidad, no).
    resultado = resultado.filter((t) => t.orden !== null);
    if (typeof estado_os === "string" && ESTADOS_OS.includes(estado_os as EstadoOS)) {
      resultado = resultado.filter((t) => t.orden?.estado_os === estado_os);
    }

    res.json(resultado);
  })
);

// Detalle completo de una OS para el panel de administración.
ordenesServicioRouter.get(
  "/:trabajoId",
  ah<RequestConEmpresa>(async (req, res) => {
    const { data: trabajo, error } = await supabase
      .from("trabajos")
      .select("*, cliente_info:clientes(*), responsable:usuarios(nombre), tipo_trabajo:tipos_trabajo(*)")
      .eq("empresa_id", req.empresaId!)
      .eq("id", req.params.trabajoId)
      .maybeSingle();

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    if (!trabajo) {
      res.status(404).json({ error: "Trabajo no encontrado" });
      return;
    }

    const { data: orden } = await supabase
      .from("ordenes_servicio")
      .select("*")
      .eq("empresa_id", req.empresaId!)
      .eq("trabajo_id", req.params.trabajoId)
      .maybeSingle();

    const { data: items } = await supabase
      .from("os_items")
      .select("*")
      .eq("empresa_id", req.empresaId!)
      .eq("trabajo_id", req.params.trabajoId)
      .order("creado_en");

    let fotos: Record<string, unknown>[] = [];
    let firmaUrlFirmada: string | null = null;
    if (orden) {
      const { data: fotosData } = await supabase
        .from("analisis_fotos")
        .select("*")
        .eq("orden_servicio_id", orden.id)
        .order("creado_en", { ascending: false });
      fotos = await Promise.all(
        (fotosData ?? []).map(async (f) => ({ ...f, url: await urlFirmada(f.foto_url, 15) }))
      );
      firmaUrlFirmada = orden.firma_url ? await urlFirmada(orden.firma_url, 15) : null;
    }

    res.json({
      ...trabajo,
      orden: orden ? { ...orden, firma_url_firmada: firmaUrlFirmada } : null,
      items: items ?? [],
      fotos,
    });
  })
);
