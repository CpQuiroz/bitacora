import { Router } from "express";
import type { Equipo } from "@bitacora/shared";
import { supabase } from "../supabase";
import type { RequestConEmpresa } from "../empresa";
import { ah } from "../asyncHandler";

export const equiposRouter = Router();

equiposRouter.get(
  "/",
  ah<RequestConEmpresa>(async (req, res) => {
    const { data, error } = await supabase
      .from("equipos")
      .select("*, cliente:clientes(id, nombre)")
      .eq("empresa_id", req.empresaId!)
      .order("nombre");

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    res.json(data ?? []);
  })
);

equiposRouter.get(
  "/:id",
  ah<RequestConEmpresa>(async (req, res) => {
    const { data, error } = await supabase
      .from("equipos")
      .select("*, cliente:clientes(id, nombre)")
      .eq("empresa_id", req.empresaId!)
      .eq("id", req.params.id)
      .maybeSingle();

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    if (!data) {
      res.status(404).json({ error: "Equipo no encontrado" });
      return;
    }
    res.json(data);
  })
);

equiposRouter.post(
  "/",
  ah<RequestConEmpresa>(async (req, res) => {
    const { cliente_id, nombre, marca, modelo, numero_serie, categoria, notas } = req.body ?? {};

    if (typeof cliente_id !== "string" || !cliente_id.trim()) {
      res.status(400).json({ error: "Falta cliente_id" });
      return;
    }
    if (typeof nombre !== "string" || !nombre.trim()) {
      res.status(400).json({ error: "Falta nombre" });
      return;
    }

    const { data: cliente } = await supabase
      .from("clientes")
      .select("id")
      .eq("empresa_id", req.empresaId!)
      .eq("id", cliente_id)
      .maybeSingle();
    if (!cliente) {
      res.status(400).json({ error: "El cliente indicado no existe" });
      return;
    }

    const { data, error } = await supabase
      .from("equipos")
      .insert({
        empresa_id: req.empresaId!,
        cliente_id,
        nombre: nombre.trim(),
        marca: marca?.trim() || null,
        modelo: modelo?.trim() || null,
        numero_serie: numero_serie?.trim() || null,
        categoria: categoria?.trim() || null,
        notas: notas?.trim() || null,
      })
      .select("*, cliente:clientes(id, nombre)")
      .single();

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    res.status(201).json(data);
  })
);

equiposRouter.patch(
  "/:id",
  ah<RequestConEmpresa>(async (req, res) => {
    const { cliente_id, nombre, marca, modelo, numero_serie, categoria, notas, activo } = req.body ?? {};
    const cambios: Partial<Equipo> = {};

    if (cliente_id !== undefined) {
      if (typeof cliente_id !== "string" || !cliente_id.trim()) {
        res.status(400).json({ error: "cliente_id inválido" });
        return;
      }
      const { data: cliente } = await supabase
        .from("clientes")
        .select("id")
        .eq("empresa_id", req.empresaId!)
        .eq("id", cliente_id)
        .maybeSingle();
      if (!cliente) {
        res.status(400).json({ error: "El cliente indicado no existe" });
        return;
      }
      cambios.cliente_id = cliente_id;
    }
    if (nombre !== undefined) {
      if (typeof nombre !== "string" || !nombre.trim()) {
        res.status(400).json({ error: "Falta nombre" });
        return;
      }
      cambios.nombre = nombre.trim();
    }
    if (marca !== undefined) cambios.marca = marca?.trim() || null;
    if (modelo !== undefined) cambios.modelo = modelo?.trim() || null;
    if (numero_serie !== undefined) cambios.numero_serie = numero_serie?.trim() || null;
    if (categoria !== undefined) cambios.categoria = categoria?.trim() || null;
    if (notas !== undefined) cambios.notas = notas?.trim() || null;
    if (activo !== undefined) cambios.activo = Boolean(activo);

    if (Object.keys(cambios).length === 0) {
      res.status(400).json({ error: "Nada que actualizar" });
      return;
    }

    const { data, error } = await supabase
      .from("equipos")
      .update(cambios)
      .eq("empresa_id", req.empresaId!)
      .eq("id", req.params.id)
      .select("*, cliente:clientes(id, nombre)")
      .maybeSingle();

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    if (!data) {
      res.status(404).json({ error: "Equipo no encontrado" });
      return;
    }
    res.json(data);
  })
);
