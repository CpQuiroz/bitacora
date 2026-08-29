import { Router } from "express";
import type { CategoriaGasto } from "@bitacora/shared";
import { supabase } from "../supabase";
import type { RequestConEmpresa } from "../empresa";
import { ah } from "../asyncHandler";
import { requiereModulo } from "../permisos";

export const categoriasGastoRouter = Router();

categoriasGastoRouter.get(
  "/",
  ah<RequestConEmpresa>(async (req, res) => {
    const [{ data: categorias, error }, { data: gastos }] = await Promise.all([
      supabase.from("categorias_gasto").select("*").eq("empresa_id", req.empresaId!).order("nombre"),
      supabase.from("gastos").select("categoria, categoria_gasto_id").eq("empresa_id", req.empresaId!),
    ]);

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    // "cantidad_gastos" cuenta por categoria_gasto_id (FK real, desde
    // que el módulo de Gastos la vincula) — con fallback a coincidencia
    // de texto contra gastos.categoria para filas creadas antes de esa FK.
    const conteoPorId = new Map<string, number>();
    const conteoPorNombre = new Map<string, number>();
    for (const g of gastos ?? []) {
      if (g.categoria_gasto_id) {
        conteoPorId.set(g.categoria_gasto_id, (conteoPorId.get(g.categoria_gasto_id) ?? 0) + 1);
      } else {
        conteoPorNombre.set(g.categoria, (conteoPorNombre.get(g.categoria) ?? 0) + 1);
      }
    }

    res.json(
      (categorias ?? []).map((c) => ({
        ...c,
        cantidad_gastos: (conteoPorId.get(c.id) ?? 0) + (conteoPorNombre.get(c.nombre) ?? 0),
      }))
    );
  })
);

categoriasGastoRouter.post(
  "/",
  requiereModulo("configuracion"),
  ah<RequestConEmpresa>(async (req, res) => {
    const { nombre, color } = req.body ?? {};
    if (typeof nombre !== "string" || !nombre.trim()) {
      res.status(400).json({ error: "Falta nombre" });
      return;
    }
    if (color !== undefined && color !== null && !/^#[0-9a-fA-F]{6}$/.test(color)) {
      res.status(400).json({ error: "color debe ser un hex válido (#rrggbb)" });
      return;
    }

    const { data, error } = await supabase
      .from("categorias_gasto")
      .insert({ empresa_id: req.empresaId!, nombre: nombre.trim(), color: color || "#4338ca" })
      .select()
      .single();

    if (error) {
      res.status(error.code === "23505" ? 409 : 500).json({
        error: error.code === "23505" ? "Ya existe una categoría con ese nombre" : error.message,
      });
      return;
    }
    res.status(201).json({ ...data, cantidad_gastos: 0 });
  })
);

categoriasGastoRouter.patch(
  "/:id",
  requiereModulo("configuracion"),
  ah<RequestConEmpresa>(async (req, res) => {
    const { nombre, color } = req.body ?? {};
    const cambios: Partial<CategoriaGasto> = {};
    if (nombre !== undefined) {
      if (typeof nombre !== "string" || !nombre.trim()) {
        res.status(400).json({ error: "Falta nombre" });
        return;
      }
      cambios.nombre = nombre.trim();
    }
    if (color !== undefined) {
      if (!/^#[0-9a-fA-F]{6}$/.test(color)) {
        res.status(400).json({ error: "color debe ser un hex válido (#rrggbb)" });
        return;
      }
      cambios.color = color;
    }
    if (Object.keys(cambios).length === 0) {
      res.status(400).json({ error: "Nada que actualizar" });
      return;
    }

    const { data, error } = await supabase
      .from("categorias_gasto")
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
      res.status(404).json({ error: "Categoría no encontrada" });
      return;
    }
    res.json(data);
  })
);

categoriasGastoRouter.delete(
  "/:id",
  requiereModulo("configuracion"),
  ah<RequestConEmpresa>(async (req, res) => {
    const { error, count } = await supabase
      .from("categorias_gasto")
      .delete({ count: "exact" })
      .eq("empresa_id", req.empresaId!)
      .eq("id", req.params.id);

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    if (!count) {
      res.status(404).json({ error: "Categoría no encontrada" });
      return;
    }
    res.status(204).end();
  })
);
