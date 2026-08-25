import { Router } from "express";
import type { CampoTipoTrabajo } from "@bitacora/shared";
import { supabase } from "../supabase";
import type { RequestConEmpresa } from "../empresa";
import { ah } from "../asyncHandler";

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
// muestra el formulario en la app móvil para cada uno.
tiposTrabajoRouter.post(
  "/",
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
