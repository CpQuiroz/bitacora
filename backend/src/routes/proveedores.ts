import { Router } from "express";
import type { Proveedor } from "@bitacora/shared";
import { formatearRut, validarRut } from "@bitacora/shared";
import { supabase } from "../supabase";
import type { RequestConEmpresa } from "../empresa";
import { ah } from "../asyncHandler";

export const proveedoresRouter = Router();

proveedoresRouter.get(
  "/",
  ah<RequestConEmpresa>(async (req, res) => {
    const { data, error } = await supabase
      .from("proveedores")
      .select("*, categoria:categorias_gasto(id, nombre, color)")
      .eq("empresa_id", req.empresaId!)
      .order("nombre");

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    res.json(data ?? []);
  })
);

proveedoresRouter.post(
  "/",
  ah<RequestConEmpresa>(async (req, res) => {
    const { nombre, razon_social, rut, telefono, correo, categoria_gasto_id } = req.body ?? {};

    if (typeof nombre !== "string" || !nombre.trim()) {
      res.status(400).json({ error: "Falta nombre" });
      return;
    }

    let rutFormateado: string | null = null;
    if (rut) {
      if (!validarRut(rut)) {
        res.status(400).json({ error: "RUT inválido (verifica el dígito verificador)" });
        return;
      }
      rutFormateado = formatearRut(rut);
    }

    if (categoria_gasto_id) {
      const { data: categoria } = await supabase
        .from("categorias_gasto")
        .select("id")
        .eq("empresa_id", req.empresaId!)
        .eq("id", categoria_gasto_id)
        .maybeSingle();
      if (!categoria) {
        res.status(400).json({ error: "La categoría de gasto indicada no existe" });
        return;
      }
    }

    const { data, error } = await supabase
      .from("proveedores")
      .insert({
        empresa_id: req.empresaId!,
        nombre: nombre.trim(),
        razon_social: razon_social?.trim() || null,
        rut: rutFormateado,
        telefono: telefono?.trim() || null,
        correo: correo?.trim() || null,
        categoria_gasto_id: categoria_gasto_id || null,
      })
      .select("*, categoria:categorias_gasto(id, nombre, color)")
      .single();

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    res.status(201).json(data);
  })
);

proveedoresRouter.patch(
  "/:id",
  ah<RequestConEmpresa>(async (req, res) => {
    const { nombre, razon_social, rut, telefono, correo, categoria_gasto_id, activo } = req.body ?? {};
    const cambios: Partial<Proveedor> = {};

    if (nombre !== undefined) {
      if (typeof nombre !== "string" || !nombre.trim()) {
        res.status(400).json({ error: "Falta nombre" });
        return;
      }
      cambios.nombre = nombre.trim();
    }
    if (razon_social !== undefined) cambios.razon_social = razon_social?.trim() || null;
    if (rut !== undefined) {
      if (rut) {
        if (!validarRut(rut)) {
          res.status(400).json({ error: "RUT inválido (verifica el dígito verificador)" });
          return;
        }
        cambios.rut = formatearRut(rut);
      } else {
        cambios.rut = null;
      }
    }
    if (telefono !== undefined) cambios.telefono = telefono?.trim() || null;
    if (correo !== undefined) cambios.correo = correo?.trim() || null;
    if (categoria_gasto_id !== undefined) {
      if (categoria_gasto_id) {
        const { data: categoria } = await supabase
          .from("categorias_gasto")
          .select("id")
          .eq("empresa_id", req.empresaId!)
          .eq("id", categoria_gasto_id)
          .maybeSingle();
        if (!categoria) {
          res.status(400).json({ error: "La categoría de gasto indicada no existe" });
          return;
        }
      }
      cambios.categoria_gasto_id = categoria_gasto_id || null;
    }
    if (activo !== undefined) cambios.activo = Boolean(activo);

    if (Object.keys(cambios).length === 0) {
      res.status(400).json({ error: "Nada que actualizar" });
      return;
    }

    const { data, error } = await supabase
      .from("proveedores")
      .update(cambios)
      .eq("empresa_id", req.empresaId!)
      .eq("id", req.params.id)
      .select("*, categoria:categorias_gasto(id, nombre, color)")
      .maybeSingle();

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    if (!data) {
      res.status(404).json({ error: "Proveedor no encontrado" });
      return;
    }
    res.json(data);
  })
);
