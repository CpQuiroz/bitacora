import { Router } from "express";
import type { AplicaDocumento, TipoDocumento } from "@bitacora/shared";
import { supabase } from "../supabase";
import type { RequestConEmpresa } from "../empresa";
import { ah } from "../asyncHandler";
import { requiereModulo } from "../permisos";

export const tiposDocumentoRouter = Router();

const APLICA: AplicaDocumento[] = ["colaborador", "vehiculo", "ambos"];

tiposDocumentoRouter.get(
  "/",
  ah<RequestConEmpresa>(async (req, res) => {
    const { data, error } = await supabase.from("tipos_documento").select("*").eq("empresa_id", req.empresaId!).order("nombre");
    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    res.json(data);
  })
);

tiposDocumentoRouter.post(
  "/",
  requiereModulo("flota"),
  ah<RequestConEmpresa>(async (req, res) => {
    const { nombre, aplica_a } = req.body ?? {};
    if (typeof nombre !== "string" || !nombre.trim()) {
      res.status(400).json({ error: "Falta nombre" });
      return;
    }
    if (!APLICA.includes(aplica_a)) {
      res.status(400).json({ error: `aplica_a debe ser uno de: ${APLICA.join(", ")}` });
      return;
    }

    const { data, error } = await supabase
      .from("tipos_documento")
      .insert({ empresa_id: req.empresaId!, nombre: nombre.trim(), aplica_a })
      .select()
      .single();

    if (error) {
      res.status(error.code === "23505" ? 409 : 500).json({
        error: error.code === "23505" ? "Ya existe un tipo de documento con ese nombre" : error.message,
      });
      return;
    }
    res.status(201).json(data);
  })
);

tiposDocumentoRouter.patch(
  "/:id",
  requiereModulo("flota"),
  ah<RequestConEmpresa>(async (req, res) => {
    const { nombre, aplica_a, activo } = req.body ?? {};
    const cambios: Partial<TipoDocumento> = {};
    if (nombre !== undefined) {
      if (typeof nombre !== "string" || !nombre.trim()) {
        res.status(400).json({ error: "Falta nombre" });
        return;
      }
      cambios.nombre = nombre.trim();
    }
    if (aplica_a !== undefined) {
      if (!APLICA.includes(aplica_a)) {
        res.status(400).json({ error: `aplica_a debe ser uno de: ${APLICA.join(", ")}` });
        return;
      }
      cambios.aplica_a = aplica_a;
    }
    if (activo !== undefined) cambios.activo = Boolean(activo);
    if (Object.keys(cambios).length === 0) {
      res.status(400).json({ error: "Nada que actualizar" });
      return;
    }

    const { data, error } = await supabase
      .from("tipos_documento")
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
      res.status(404).json({ error: "Tipo de documento no encontrado" });
      return;
    }
    res.json(data);
  })
);

tiposDocumentoRouter.delete(
  "/:id",
  requiereModulo("flota"),
  ah<RequestConEmpresa>(async (req, res) => {
    const { error, count } = await supabase
      .from("tipos_documento")
      .delete({ count: "exact" })
      .eq("empresa_id", req.empresaId!)
      .eq("id", req.params.id);
    if (error) {
      res.status(error.code === "23503" ? 409 : 500).json({
        error: error.code === "23503" ? "Hay documentos que usan este tipo — desactívalo en vez de eliminarlo" : error.message,
      });
      return;
    }
    if (!count) {
      res.status(404).json({ error: "Tipo de documento no encontrado" });
      return;
    }
    res.status(204).end();
  })
);
