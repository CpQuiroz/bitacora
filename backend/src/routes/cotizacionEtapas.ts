// BITÁCORA — Etapas de cotización a medida de la empresa (migración
// 107). Capa de seguimiento interno, sin ninguna lógica propia — ver
// el comentario de la migración.
import { Router } from "express";
import { supabase } from "../supabase";
import type { RequestConEmpresa } from "../empresa";
import { ah } from "../asyncHandler";
import { requiereModulo } from "../permisos";

export const cotizacionEtapasRouter = Router();

// Mismas 5 etapas del ejemplo que motivó este pedido — solo se
// siembran la primera vez que una empresa pide la lista y no tiene
// ninguna todavía (mismo criterio que obtenerOCrearPlantilla en
// plantillas.ts). Después de eso, la empresa las administra libremente
// (agregar/editar/eliminar) y este seed no se vuelve a tocar.
const ETAPAS_POR_DEFECTO = ["Abiertos", "Aprobados", "Vendidos", "Entregados", "Cancelados"];

cotizacionEtapasRouter.get(
  "/",
  ah<RequestConEmpresa>(async (req, res) => {
    const { data: etapas, error } = await supabase
      .from("cotizacion_etapas")
      .select("*")
      .eq("empresa_id", req.empresaId!)
      .order("orden");

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    if (etapas && etapas.length > 0) {
      res.json(etapas);
      return;
    }

    const { data: sembradas, error: errorSeed } = await supabase
      .from("cotizacion_etapas")
      .insert(ETAPAS_POR_DEFECTO.map((nombre, orden) => ({ empresa_id: req.empresaId!, nombre, orden })))
      .select()
      .order("orden");

    if (errorSeed) {
      res.status(500).json({ error: errorSeed.message });
      return;
    }
    res.json(sembradas ?? []);
  })
);

cotizacionEtapasRouter.post(
  "/",
  requiereModulo("configuracion"),
  ah<RequestConEmpresa>(async (req, res) => {
    const { nombre } = req.body ?? {};
    if (typeof nombre !== "string" || !nombre.trim()) {
      res.status(400).json({ error: "Falta el nombre" });
      return;
    }
    const { count } = await supabase
      .from("cotizacion_etapas")
      .select("id", { count: "exact", head: true })
      .eq("empresa_id", req.empresaId!);

    const { data, error } = await supabase
      .from("cotizacion_etapas")
      .insert({ empresa_id: req.empresaId!, nombre: nombre.trim(), orden: count ?? 0 })
      .select()
      .single();

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    res.status(201).json(data);
  })
);

cotizacionEtapasRouter.patch(
  "/:id",
  requiereModulo("configuracion"),
  ah<RequestConEmpresa>(async (req, res) => {
    const { nombre, orden } = req.body ?? {};
    const cambios: { nombre?: string; orden?: number } = {};
    if (nombre !== undefined) {
      if (typeof nombre !== "string" || !nombre.trim()) {
        res.status(400).json({ error: "El nombre no puede quedar vacío" });
        return;
      }
      cambios.nombre = nombre.trim();
    }
    if (orden !== undefined) {
      if (typeof orden !== "number") {
        res.status(400).json({ error: "orden debe ser un número" });
        return;
      }
      cambios.orden = orden;
    }

    const { data, error } = await supabase
      .from("cotizacion_etapas")
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
      res.status(404).json({ error: "Etapa no encontrada" });
      return;
    }
    res.json(data);
  })
);

cotizacionEtapasRouter.delete(
  "/:id",
  requiereModulo("configuracion"),
  ah<RequestConEmpresa>(async (req, res) => {
    // on delete set null (migración 107): las cotizaciones que tenían
    // esta etapa simplemente quedan sin etapa, no se bloquea el borrado.
    const { error, count } = await supabase
      .from("cotizacion_etapas")
      .delete({ count: "exact" })
      .eq("empresa_id", req.empresaId!)
      .eq("id", req.params.id);

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    if (!count) {
      res.status(404).json({ error: "Etapa no encontrada" });
      return;
    }
    res.status(204).end();
  })
);
