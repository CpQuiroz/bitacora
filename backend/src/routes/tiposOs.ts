import { Router } from "express";
import type { TipoOS } from "@bitacora/shared";
import { supabase } from "../supabase";
import type { RequestConEmpresa } from "../empresa";
import { ah } from "../asyncHandler";

export const tiposOsRouter = Router();

async function checklistExiste(empresaId: string, checklistId: string) {
  const { data } = await supabase
    .from("checklist_templates")
    .select("id")
    .eq("empresa_id", empresaId)
    .eq("id", checklistId)
    .maybeSingle();
  return Boolean(data);
}

tiposOsRouter.get(
  "/",
  ah<RequestConEmpresa>(async (req, res) => {
    const { data, error } = await supabase
      .from("tipos_os")
      .select("*, checklist:checklist_templates(nombre)")
      .eq("empresa_id", req.empresaId!)
      .order("nombre");

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    res.json(data);
  })
);

tiposOsRouter.post(
  "/",
  ah<RequestConEmpresa>(async (req, res) => {
    if (req.rol !== "admin") {
      res.status(403).json({ error: "Solo un admin puede crear tipos de OS" });
      return;
    }
    const { nombre, descripcion, color, checklist_template_id } = req.body ?? {};
    if (typeof nombre !== "string" || !nombre.trim()) {
      res.status(400).json({ error: "Falta nombre" });
      return;
    }
    if (color !== undefined && color !== null && !/^#[0-9a-fA-F]{6}$/.test(color)) {
      res.status(400).json({ error: "color debe ser un hex válido (#rrggbb)" });
      return;
    }
    if (checklist_template_id && !(await checklistExiste(req.empresaId!, checklist_template_id))) {
      res.status(400).json({ error: "checklist_template_id inválido" });
      return;
    }

    const { data, error } = await supabase
      .from("tipos_os")
      .insert({
        empresa_id: req.empresaId!,
        nombre: nombre.trim(),
        descripcion: descripcion?.trim() || null,
        color: color || "#4338ca",
        checklist_template_id: checklist_template_id || null,
      })
      .select("*, checklist:checklist_templates(nombre)")
      .single();

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    res.status(201).json(data);
  })
);

tiposOsRouter.patch(
  "/:id",
  ah<RequestConEmpresa>(async (req, res) => {
    if (req.rol !== "admin") {
      res.status(403).json({ error: "Solo un admin puede editar tipos de OS" });
      return;
    }
    const { nombre, descripcion, color, checklist_template_id, activo } = req.body ?? {};
    const cambios: Partial<TipoOS> = {};

    if (nombre !== undefined) {
      if (typeof nombre !== "string" || !nombre.trim()) {
        res.status(400).json({ error: "Falta nombre" });
        return;
      }
      cambios.nombre = nombre.trim();
    }
    if (descripcion !== undefined) cambios.descripcion = descripcion?.trim() || null;
    if (color !== undefined) {
      if (color !== null && !/^#[0-9a-fA-F]{6}$/.test(color)) {
        res.status(400).json({ error: "color debe ser un hex válido (#rrggbb)" });
        return;
      }
      cambios.color = color;
    }
    if (checklist_template_id !== undefined) {
      if (checklist_template_id && !(await checklistExiste(req.empresaId!, checklist_template_id))) {
        res.status(400).json({ error: "checklist_template_id inválido" });
        return;
      }
      cambios.checklist_template_id = checklist_template_id || null;
    }
    if (activo !== undefined) cambios.activo = Boolean(activo);
    if (Object.keys(cambios).length === 0) {
      res.status(400).json({ error: "Nada que actualizar" });
      return;
    }

    const { data, error } = await supabase
      .from("tipos_os")
      .update(cambios)
      .eq("empresa_id", req.empresaId!)
      .eq("id", req.params.id)
      .select("*, checklist:checklist_templates(nombre)")
      .maybeSingle();

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    if (!data) {
      res.status(404).json({ error: "Tipo de OS no encontrado" });
      return;
    }
    res.json(data);
  })
);

tiposOsRouter.delete(
  "/:id",
  ah<RequestConEmpresa>(async (req, res) => {
    if (req.rol !== "admin") {
      res.status(403).json({ error: "Solo un admin puede eliminar tipos de OS" });
      return;
    }
    const { error, count } = await supabase
      .from("tipos_os")
      .delete({ count: "exact" })
      .eq("empresa_id", req.empresaId!)
      .eq("id", req.params.id);

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    if (!count) {
      res.status(404).json({ error: "Tipo de OS no encontrado" });
      return;
    }
    res.status(204).end();
  })
);
