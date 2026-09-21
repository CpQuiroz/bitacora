// ============================================================
// BITÁCORA — Tipos de OS/Trabajo (migración 115, 21-sep-2026).
//
// Reemplaza a tiposTrabajo.ts + tiposOs.ts (mergeados acá) — antes 2
// catálogos separados: tipos_trabajo (campos dinámicos del formulario)
// y tipos_os (color/checklist/tiempo estimado). El pedido de la
// usuaria fue unificarlos: el formulario de Nueva OS mostraba 2
// selectores casi idénticos uno debajo del otro. Ahora es un solo
// catálogo con ambos conjuntos de campos a la vez.
// ============================================================
import { Router } from "express";
import type { CampoTipoTrabajo, TipoOsTrabajo } from "@bitacora/shared";
import { supabase } from "../supabase";
import type { RequestConEmpresa } from "../empresa";
import { ah } from "../asyncHandler";
import { requiereModulo } from "../permisos";

export const tiposOsTrabajoRouter = Router();

// "foto" faltaba acá desde la migración 105 — cualquier tipo con un
// campo tipo "foto" era rechazado por esta validación (400) antes de
// ese fix (17-sep-2026).
const TIPOS_CAMPO = ["texto", "numero", "fecha", "booleano", "foto", "seleccion"];

function campoValido(c: unknown): c is CampoTipoTrabajo {
  if (typeof c !== "object" || c === null) return false;
  const campo = c as Record<string, unknown>;
  if (
    typeof campo.clave !== "string" ||
    campo.clave.trim().length === 0 ||
    typeof campo.etiqueta !== "string" ||
    campo.etiqueta.trim().length === 0 ||
    typeof campo.tipo !== "string" ||
    !TIPOS_CAMPO.includes(campo.tipo)
  ) {
    return false;
  }
  if (campo.tipo === "seleccion") {
    return Array.isArray(campo.opciones) && campo.opciones.length > 0 && campo.opciones.every((o) => typeof o === "string" && o.trim().length > 0);
  }
  return true;
}

async function checklistExiste(empresaId: string, checklistId: string) {
  const { data } = await supabase
    .from("checklist_templates")
    .select("id")
    .eq("empresa_id", empresaId)
    .eq("id", checklistId)
    .maybeSingle();
  return Boolean(data);
}

tiposOsTrabajoRouter.get(
  "/",
  ah<RequestConEmpresa>(async (req, res) => {
    const { data, error } = await supabase
      .from("tipos_os_trabajo")
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

// Cada empresa define sus propios tipos: qué campos dinámicos muestra
// el formulario (mobile + detalle de OS) Y su clasificación (color,
// checklist predeterminado, tiempo estimado) para el listado/agenda.
tiposOsTrabajoRouter.post(
  "/",
  requiereModulo("configuracion"),
  ah<RequestConEmpresa>(async (req, res) => {
    const { nombre, campos, descripcion, color, checklist_template_id, tiempo_estimado_minutos } = req.body ?? {};

    if (typeof nombre !== "string" || !nombre.trim()) {
      res.status(400).json({ error: "Falta nombre" });
      return;
    }
    // campos es opcional al crear — un tipo sin campos dinámicos es
    // válido (así lo permite el propio default de la columna); si
    // viene, igual se valida su forma.
    const camposFinal = campos === undefined ? [] : campos;
    if (!Array.isArray(camposFinal) || !camposFinal.every(campoValido)) {
      res.status(400).json({
        error: "campos debe ser un arreglo de {clave, etiqueta, tipo: texto|numero|fecha|booleano|foto|seleccion (seleccion requiere opciones: string[] no vacío)}",
      });
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
    if (tiempo_estimado_minutos !== undefined && tiempo_estimado_minutos !== null && (!Number.isInteger(tiempo_estimado_minutos) || tiempo_estimado_minutos < 0)) {
      res.status(400).json({ error: "tiempo_estimado_minutos debe ser un entero positivo" });
      return;
    }

    const { data, error } = await supabase
      .from("tipos_os_trabajo")
      .insert({
        empresa_id: req.empresaId!,
        nombre: nombre.trim(),
        campos: camposFinal,
        descripcion: descripcion?.trim() || null,
        color: color || "#4338ca",
        checklist_template_id: checklist_template_id || null,
        tiempo_estimado_minutos: tiempo_estimado_minutos ?? null,
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

tiposOsTrabajoRouter.patch(
  "/:id",
  requiereModulo("configuracion"),
  ah<RequestConEmpresa>(async (req, res) => {
    const { nombre, campos, descripcion, color, checklist_template_id, tiempo_estimado_minutos, activo } = req.body ?? {};
    const cambios: Partial<TipoOsTrabajo> = {};

    if (nombre !== undefined) {
      if (typeof nombre !== "string" || !nombre.trim()) {
        res.status(400).json({ error: "Falta nombre" });
        return;
      }
      cambios.nombre = nombre.trim();
    }
    if (campos !== undefined) {
      if (!Array.isArray(campos) || !campos.every(campoValido)) {
        res.status(400).json({
          error: "campos debe ser un arreglo de {clave, etiqueta, tipo: texto|numero|fecha|booleano|foto|seleccion (seleccion requiere opciones: string[] no vacío)}",
        });
        return;
      }
      cambios.campos = campos;
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
    if (tiempo_estimado_minutos !== undefined) {
      if (tiempo_estimado_minutos !== null && (!Number.isInteger(tiempo_estimado_minutos) || tiempo_estimado_minutos < 0)) {
        res.status(400).json({ error: "tiempo_estimado_minutos debe ser un entero positivo" });
        return;
      }
      cambios.tiempo_estimado_minutos = tiempo_estimado_minutos;
    }
    if (activo !== undefined) cambios.activo = Boolean(activo);
    if (Object.keys(cambios).length === 0) {
      res.status(400).json({ error: "Nada que actualizar" });
      return;
    }

    const { data, error } = await supabase
      .from("tipos_os_trabajo")
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
      res.status(404).json({ error: "Tipo de OS/Trabajo no encontrado" });
      return;
    }
    res.json(data);
  })
);

tiposOsTrabajoRouter.delete(
  "/:id",
  requiereModulo("configuracion"),
  ah<RequestConEmpresa>(async (req, res) => {
    const { error, count } = await supabase
      .from("tipos_os_trabajo")
      .delete({ count: "exact" })
      .eq("empresa_id", req.empresaId!)
      .eq("id", req.params.id);

    if (error) {
      // Restricción de llave foránea: hay trabajos que usan este tipo.
      if (error.code === "23503") {
        res.status(409).json({ error: "Este tipo está en uso — desactívalo en vez de eliminarlo" });
        return;
      }
      res.status(500).json({ error: error.message });
      return;
    }
    if (!count) {
      res.status(404).json({ error: "Tipo de OS/Trabajo no encontrado" });
      return;
    }
    res.status(204).end();
  })
);
