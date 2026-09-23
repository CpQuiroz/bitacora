import { Router } from "express";
import type { UnidadMedida } from "@bitacora/shared";
import { supabase } from "../supabase";
import type { RequestConEmpresa } from "../empresa";
import { ah } from "../asyncHandler";
import { requiereModulo } from "../permisos";

export const unidadesMedidaRouter = Router();

// Bug real (23-sep-2026, descubierto por reporte de la usuaria: "no sé
// por qué sale un 1 demás" en los materiales de un Levantamiento) —
// varias unidades de la empresa en prod terminaron con nombre "1", "10"
// o "15" (alguien las tipeó en el combobox "crear al vuelo" pensando
// en otra cosa) y `{cantidad} {unidad}` renderizaba "1 1". No hay forma
// de que "1" sea una unidad de medida real — se rechaza acá, en el
// único lugar donde se puede crear/editar una.
function esNombreUnidadValido(nombre: string): boolean {
  return !/^\d+$/.test(nombre.trim());
}

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
    if (!esNombreUnidadValido(nombre)) {
      res.status(400).json({ error: "El nombre de la unidad no puede ser solo un número (ej. \"1\") — usa algo como \"unidad\", \"litro\" o \"metro\"" });
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
      if (!esNombreUnidadValido(nombre)) {
        res.status(400).json({ error: "El nombre de la unidad no puede ser solo un número (ej. \"1\") — usa algo como \"unidad\", \"litro\" o \"metro\"" });
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
