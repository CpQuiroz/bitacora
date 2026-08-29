import { Router } from "express";
import type { UnidadMedida } from "@bitacora/shared";
import { supabase } from "../supabase";
import type { RequestConEmpresa } from "../empresa";
import { ah } from "../asyncHandler";
import { requiereModulo } from "../permisos";

export const unidadesMedidaRouter = Router();

unidadesMedidaRouter.get(
  "/",
  ah<RequestConEmpresa>(async (req, res) => {
    const { data, error } = await supabase
      .from("unidades_medida")
      .select("*")
      .eq("empresa_id", req.empresaId!)
      .order("nombre");

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    res.json(data);
  })
);

unidadesMedidaRouter.post(
  "/",
  requiereModulo("configuracion"),
  ah<RequestConEmpresa>(async (req, res) => {
    const { nombre, abreviatura } = req.body ?? {};
    if (typeof nombre !== "string" || !nombre.trim()) {
      res.status(400).json({ error: "Falta nombre" });
      return;
    }

    const { data, error } = await supabase
      .from("unidades_medida")
      .insert({ empresa_id: req.empresaId!, nombre: nombre.trim(), abreviatura: abreviatura?.trim() || null })
      .select()
      .single();

    if (error) {
      res.status(error.code === "23505" ? 409 : 500).json({
        error: error.code === "23505" ? "Ya existe una unidad con ese nombre" : error.message,
      });
      return;
    }
    res.status(201).json(data);
  })
);

unidadesMedidaRouter.patch(
  "/:id",
  requiereModulo("configuracion"),
  ah<RequestConEmpresa>(async (req, res) => {
    const { nombre, abreviatura, activo } = req.body ?? {};
    const cambios: Partial<UnidadMedida> = {};
    if (nombre !== undefined) {
      if (typeof nombre !== "string" || !nombre.trim()) {
        res.status(400).json({ error: "Falta nombre" });
        return;
      }
      cambios.nombre = nombre.trim();
    }
    if (abreviatura !== undefined) cambios.abreviatura = abreviatura?.trim() || null;
    if (activo !== undefined) cambios.activo = Boolean(activo);
    if (Object.keys(cambios).length === 0) {
      res.status(400).json({ error: "Nada que actualizar" });
      return;
    }

    const { data, error } = await supabase
      .from("unidades_medida")
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
      res.status(404).json({ error: "Unidad no encontrada" });
      return;
    }
    res.json(data);
  })
);

unidadesMedidaRouter.delete(
  "/:id",
  requiereModulo("configuracion"),
  ah<RequestConEmpresa>(async (req, res) => {
    const { error, count } = await supabase
      .from("unidades_medida")
      .delete({ count: "exact" })
      .eq("empresa_id", req.empresaId!)
      .eq("id", req.params.id);

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    if (!count) {
      res.status(404).json({ error: "Unidad no encontrada" });
      return;
    }
    res.status(204).end();
  })
);
