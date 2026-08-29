import { Router } from "express";
import type { CampoTipoTrabajo, TipoTrabajo } from "@bitacora/shared";
import { supabase } from "../supabase";
import type { RequestConEmpresa } from "../empresa";
import { ah } from "../asyncHandler";
import { requiereModulo } from "../permisos";

export const tiposTrabajoRouter = Router();

const TIPOS_CAMPO = ["texto", "numero", "fecha", "booleano"];

function campoValido(c: unknown): c is CampoTipoTrabajo {
  if (typeof c !== "object" || c === null) return false;
  const campo = c as Record<string, unknown>;
  return (
    typeof campo.clave === "string" &&
    campo.clave.trim().length > 0 &&
    typeof campo.etiqueta === "string" &&
    campo.etiqueta.trim().length > 0 &&
    typeof campo.tipo === "string" &&
    TIPOS_CAMPO.includes(campo.tipo)
  );
}

tiposTrabajoRouter.get(
  "/",
  ah<RequestConEmpresa>(async (req, res) => {
    const { data, error } = await supabase
      .from("tipos_trabajo")
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

// Cada empresa define sus propios tipos de trabajo y qué campos
// muestra el formulario (dinámico) en la app móvil y en el detalle
// de la OS para cada uno.
tiposTrabajoRouter.post(
  "/",
  requiereModulo("configuracion"),
  ah<RequestConEmpresa>(async (req, res) => {
    const { nombre, campos } = req.body ?? {};

    if (typeof nombre !== "string" || !nombre.trim()) {
      res.status(400).json({ error: "Falta nombre" });
      return;
    }
    if (!Array.isArray(campos) || !campos.every(campoValido)) {
      res.status(400).json({
        error: "campos debe ser un arreglo de {clave, etiqueta, tipo: texto|numero|fecha|booleano}",
      });
      return;
    }

    const { data, error } = await supabase
      .from("tipos_trabajo")
      .insert({ empresa_id: req.empresaId!, nombre: nombre.trim(), campos })
      .select()
      .single();

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    res.status(201).json(data);
  })
);

tiposTrabajoRouter.patch(
  "/:id",
  requiereModulo("configuracion"),
  ah<RequestConEmpresa>(async (req, res) => {
    const { nombre, campos, activo } = req.body ?? {};
    const cambios: Partial<TipoTrabajo> = {};

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
          error: "campos debe ser un arreglo de {clave, etiqueta, tipo: texto|numero|fecha|booleano}",
        });
        return;
      }
      cambios.campos = campos;
    }
    if (activo !== undefined) cambios.activo = Boolean(activo);
    if (Object.keys(cambios).length === 0) {
      res.status(400).json({ error: "Nada que actualizar" });
      return;
    }

    const { data, error } = await supabase
      .from("tipos_trabajo")
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
      res.status(404).json({ error: "Tipo de trabajo no encontrado" });
      return;
    }
    res.json(data);
  })
);

tiposTrabajoRouter.delete(
  "/:id",
  requiereModulo("configuracion"),
  ah<RequestConEmpresa>(async (req, res) => {
    const { error, count } = await supabase
      .from("tipos_trabajo")
      .delete({ count: "exact" })
      .eq("empresa_id", req.empresaId!)
      .eq("id", req.params.id);

    if (error) {
      // Restricción de llave foránea: hay trabajos que usan este tipo.
      if (error.code === "23503") {
        res.status(400).json({ error: "Este tipo de trabajo está en uso — desactívalo en vez de eliminarlo" });
        return;
      }
      res.status(500).json({ error: error.message });
      return;
    }
    if (!count) {
      res.status(404).json({ error: "Tipo de trabajo no encontrado" });
      return;
    }
    res.status(204).end();
  })
);
