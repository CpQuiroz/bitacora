import { Router } from "express";
import type { TipoPack } from "@bitacora/shared";
import { supabase } from "../supabase";
import type { RequestConEmpresa } from "../empresa";
import { ah } from "../asyncHandler";
import { requiereModulo } from "../permisos";

// Catálogo de "tipos de pack" (Agenda Pro) — se administra en la web y lo
// consume también móvil al vender un paquete a un cliente puntual. Ver
// supabase/migrations/84_tipos_pack.sql.
export const tiposPackRouter = Router();

tiposPackRouter.use(requiereModulo("agenda_pro"));

tiposPackRouter.get(
  "/",
  ah<RequestConEmpresa>(async (req, res) => {
    // ?activo=1 filtra a solo los vigentes — lo usa el selector al vender
    // un paquete; la pantalla de catálogo en la web trae todos.
    let query = supabase.from("tipos_pack").select("*").eq("empresa_id", req.empresaId!).order("nombre");
    if (req.query.activo === "1") query = query.eq("activo", true);

    const { data, error } = await query;
    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    res.json(data);
  })
);

tiposPackRouter.post(
  "/",
  ah<RequestConEmpresa>(async (req, res) => {
    const { nombre, cantidad_sesiones, precio } = req.body ?? {};

    if (typeof nombre !== "string" || !nombre.trim()) {
      res.status(400).json({ error: "Falta nombre" });
      return;
    }
    if (!Number.isInteger(cantidad_sesiones) || cantidad_sesiones <= 0) {
      res.status(400).json({ error: "cantidad_sesiones debe ser un entero mayor a 0" });
      return;
    }
    if (precio !== null && precio !== undefined && (typeof precio !== "number" || precio < 0)) {
      res.status(400).json({ error: "precio inválido" });
      return;
    }

    const { data, error } = await supabase
      .from("tipos_pack")
      .insert({
        empresa_id: req.empresaId!,
        nombre: nombre.trim(),
        cantidad_sesiones,
        precio: precio ?? null,
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

tiposPackRouter.patch(
  "/:id",
  ah<RequestConEmpresa>(async (req, res) => {
    const { nombre, cantidad_sesiones, precio, activo } = req.body ?? {};
    const cambios: Partial<TipoPack> = {};

    if (nombre !== undefined) {
      if (typeof nombre !== "string" || !nombre.trim()) {
        res.status(400).json({ error: "Falta nombre" });
        return;
      }
      cambios.nombre = nombre.trim();
    }
    if (cantidad_sesiones !== undefined) {
      if (!Number.isInteger(cantidad_sesiones) || cantidad_sesiones <= 0) {
        res.status(400).json({ error: "cantidad_sesiones debe ser un entero mayor a 0" });
        return;
      }
      cambios.cantidad_sesiones = cantidad_sesiones;
    }
    if (precio !== undefined) {
      if (precio !== null && (typeof precio !== "number" || precio < 0)) {
        res.status(400).json({ error: "precio inválido" });
        return;
      }
      cambios.precio = precio;
    }
    if (activo !== undefined) cambios.activo = Boolean(activo);

    const { data, error } = await supabase
      .from("tipos_pack")
      .update(cambios)
      .eq("id", req.params.id)
      .eq("empresa_id", req.empresaId!)
      .select()
      .maybeSingle();

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    if (!data) {
      res.status(404).json({ error: "No encontrado" });
      return;
    }
    res.json(data);
  })
);
