import { Router } from "express";
import { supabase } from "../supabase";
import type { RequestConEmpresa } from "../empresa";
import { ah } from "../asyncHandler";
import { requiereModulo } from "../permisos";

export const centrosCostoRouter = Router();

centrosCostoRouter.get(
  "/",
  ah<RequestConEmpresa>(async (req, res) => {
    const [{ data: centros, error }, { data: categorias }] = await Promise.all([
      supabase.from("centros_costo").select("*").eq("empresa_id", req.empresaId!).order("nombre"),
      supabase.from("categorias_gasto").select("id, nombre").eq("empresa_id", req.empresaId!),
    ]);

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    const nombrePorId = new Map((categorias ?? []).map((c) => [c.id, c.nombre]));
    res.json(
      (centros ?? []).map((c) => ({
        ...c,
        categorias: (c.categoria_gasto_ids as string[]).map((id) => nombrePorId.get(id) ?? "—"),
      }))
    );
  })
);

centrosCostoRouter.post(
  "/",
  requiereModulo("configuracion"),
  ah<RequestConEmpresa>(async (req, res) => {
    const { nombre, categoria_gasto_ids } = req.body ?? {};
    if (typeof nombre !== "string" || !nombre.trim()) {
      res.status(400).json({ error: "Falta nombre" });
      return;
    }
    const ids = Array.isArray(categoria_gasto_ids) ? categoria_gasto_ids.filter((id) => typeof id === "string") : [];

    const { data, error } = await supabase
      .from("centros_costo")
      .insert({ empresa_id: req.empresaId!, nombre: nombre.trim(), categoria_gasto_ids: ids })
      .select()
      .single();

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    res.status(201).json(data);
  })
);

centrosCostoRouter.delete(
  "/:id",
  requiereModulo("configuracion"),
  ah<RequestConEmpresa>(async (req, res) => {
    const { error, count } = await supabase
      .from("centros_costo")
      .delete({ count: "exact" })
      .eq("empresa_id", req.empresaId!)
      .eq("id", req.params.id);

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    if (!count) {
      res.status(404).json({ error: "Centro de costo no encontrado" });
      return;
    }
    res.status(204).end();
  })
);
