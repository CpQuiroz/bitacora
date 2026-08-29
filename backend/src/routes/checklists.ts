import { Router } from "express";
import type { ChecklistTemplate, SeccionChecklist } from "@bitacora/shared";
import { supabase } from "../supabase";
import type { RequestConEmpresa } from "../empresa";
import { ah } from "../asyncHandler";
import { requiereModulo } from "../permisos";

export const checklistsRouter = Router();

function seccionesValidas(secciones: unknown): secciones is SeccionChecklist[] {
  if (!Array.isArray(secciones)) return false;
  return secciones.every((s) => {
    if (typeof s !== "object" || s === null) return false;
    const seccion = s as Record<string, unknown>;
    return (
      typeof seccion.nombre === "string" &&
      Array.isArray(seccion.preguntas) &&
      seccion.preguntas.every(
        (p) => typeof p === "object" && p !== null && typeof (p as Record<string, unknown>).texto === "string" && typeof (p as Record<string, unknown>).obligatorio === "boolean"
      )
    );
  });
}

checklistsRouter.get(
  "/",
  ah<RequestConEmpresa>(async (req, res) => {
    const { data, error } = await supabase
      .from("checklist_templates")
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

checklistsRouter.get(
  "/:id",
  ah<RequestConEmpresa>(async (req, res) => {
    const { data, error } = await supabase
      .from("checklist_templates")
      .select("*")
      .eq("empresa_id", req.empresaId!)
      .eq("id", req.params.id)
      .maybeSingle();

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    if (!data) {
      res.status(404).json({ error: "Template no encontrado" });
      return;
    }
    res.json(data);
  })
);

checklistsRouter.post(
  "/",
  requiereModulo("configuracion"),
  ah<RequestConEmpresa>(async (req, res) => {
    const { nombre, descripcion, secciones } = req.body ?? {};
    if (typeof nombre !== "string" || !nombre.trim()) {
      res.status(400).json({ error: "Falta nombre" });
      return;
    }
    const seccionesFinal = secciones !== undefined ? secciones : [];
    if (!seccionesValidas(seccionesFinal)) {
      res.status(400).json({ error: "secciones inválidas" });
      return;
    }

    const { data, error } = await supabase
      .from("checklist_templates")
      .insert({
        empresa_id: req.empresaId!,
        nombre: nombre.trim(),
        descripcion: descripcion?.trim() || null,
        secciones: seccionesFinal,
      })
      .select()
      .single();

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    res.status(201).json(data);
  })
);

checklistsRouter.patch(
  "/:id",
  requiereModulo("configuracion"),
  ah<RequestConEmpresa>(async (req, res) => {
    const { nombre, descripcion, secciones, activo } = req.body ?? {};

    const { data: actual } = await supabase
      .from("checklist_templates")
      .select("version")
      .eq("empresa_id", req.empresaId!)
      .eq("id", req.params.id)
      .maybeSingle();
    if (!actual) {
      res.status(404).json({ error: "Template no encontrado" });
      return;
    }

    const cambios: Partial<ChecklistTemplate> = { actualizado_en: new Date().toISOString() };
    let contenidoCambio = false;

    if (nombre !== undefined) {
      if (typeof nombre !== "string" || !nombre.trim()) {
        res.status(400).json({ error: "Falta nombre" });
        return;
      }
      cambios.nombre = nombre.trim();
      contenidoCambio = true;
    }
    if (descripcion !== undefined) {
      cambios.descripcion = descripcion?.trim() || null;
      contenidoCambio = true;
    }
    if (secciones !== undefined) {
      if (!seccionesValidas(secciones)) {
        res.status(400).json({ error: "secciones inválidas" });
        return;
      }
      cambios.secciones = secciones;
      contenidoCambio = true;
    }
    if (activo !== undefined) cambios.activo = Boolean(activo);
    // El toggle activo/inactivo solo no cuenta como una nueva versión del
    // contenido — versionar es para cambios de nombre/descripción/preguntas.
    if (contenidoCambio) cambios.version = actual.version + 1;

    const { data, error } = await supabase
      .from("checklist_templates")
      .update(cambios)
      .eq("id", req.params.id)
      .select()
      .single();

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    res.json(data);
  })
);

checklistsRouter.post(
  "/:id/duplicar",
  requiereModulo("configuracion"),
  ah<RequestConEmpresa>(async (req, res) => {
    const { data: original, error: errorOriginal } = await supabase
      .from("checklist_templates")
      .select("*")
      .eq("empresa_id", req.empresaId!)
      .eq("id", req.params.id)
      .maybeSingle();

    if (errorOriginal) {
      res.status(500).json({ error: errorOriginal.message });
      return;
    }
    if (!original) {
      res.status(404).json({ error: "Template no encontrado" });
      return;
    }

    const { data, error } = await supabase
      .from("checklist_templates")
      .insert({
        empresa_id: req.empresaId!,
        nombre: `${original.nombre} (copia)`,
        descripcion: original.descripcion,
        secciones: original.secciones,
      })
      .select()
      .single();

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    res.status(201).json(data);
  })
);

checklistsRouter.delete(
  "/:id",
  requiereModulo("configuracion"),
  ah<RequestConEmpresa>(async (req, res) => {
    const { error, count } = await supabase
      .from("checklist_templates")
      .delete({ count: "exact" })
      .eq("empresa_id", req.empresaId!)
      .eq("id", req.params.id);

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    if (!count) {
      res.status(404).json({ error: "Template no encontrado" });
      return;
    }
    res.status(204).end();
  })
);
