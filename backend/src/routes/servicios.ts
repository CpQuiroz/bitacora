import { Router } from "express";
import type { Servicio } from "@bitacora/shared";
import { supabase } from "../supabase";
import type { RequestConEmpresa } from "../empresa";
import { ah } from "../asyncHandler";
import { requiereModulo } from "../permisos";

// Catálogo de servicios (Agenda Pro) — nombre, precio de lista, duración
// sugerida. Se administra en la web y lo consume también móvil al
// armar una Nueva reserva. Ver supabase/migrations/88_servicios_y_packs_con_vigencia.sql.
export const serviciosRouter = Router();

serviciosRouter.use(requiereModulo("agenda_pro"));

serviciosRouter.get(
  "/",
  ah<RequestConEmpresa>(async (req, res) => {
    // ?activo=1 filtra a solo los vigentes — lo usa el selector de
    // servicio en Nueva reserva; el catálogo en la web trae todos.
    let query = supabase.from("servicios").select("*").eq("empresa_id", req.empresaId!).order("nombre");
    if (req.query.activo === "1") query = query.eq("activo", true);

    const { data, error } = await query;
    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    res.json(data);
  })
);

serviciosRouter.post(
  "/",
  ah<RequestConEmpresa>(async (req, res) => {
    const { nombre, precio, duracion_sugerida_min } = req.body ?? {};

    if (typeof nombre !== "string" || !nombre.trim()) {
      res.status(400).json({ error: "Falta nombre" });
      return;
    }
    if (typeof precio !== "number" || precio < 0) {
      res.status(400).json({ error: "precio inválido" });
      return;
    }
    if (!Number.isInteger(duracion_sugerida_min) || duracion_sugerida_min <= 0) {
      res.status(400).json({ error: "duracion_sugerida_min debe ser un entero mayor a 0" });
      return;
    }

    const { data, error } = await supabase
      .from("servicios")
      .insert({ empresa_id: req.empresaId!, nombre: nombre.trim(), precio, duracion_sugerida_min })
      .select()
      .single();

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    res.status(201).json(data);
  })
);

serviciosRouter.patch(
  "/:id",
  ah<RequestConEmpresa>(async (req, res) => {
    const { nombre, precio, duracion_sugerida_min, activo } = req.body ?? {};
    const cambios: Partial<Servicio> = {};

    if (nombre !== undefined) {
      if (typeof nombre !== "string" || !nombre.trim()) {
        res.status(400).json({ error: "Falta nombre" });
        return;
      }
      cambios.nombre = nombre.trim();
    }
    if (precio !== undefined) {
      if (typeof precio !== "number" || precio < 0) {
        res.status(400).json({ error: "precio inválido" });
        return;
      }
      cambios.precio = precio;
    }
    if (duracion_sugerida_min !== undefined) {
      if (!Number.isInteger(duracion_sugerida_min) || duracion_sugerida_min <= 0) {
        res.status(400).json({ error: "duracion_sugerida_min debe ser un entero mayor a 0" });
        return;
      }
      cambios.duracion_sugerida_min = duracion_sugerida_min;
    }
    if (activo !== undefined) cambios.activo = Boolean(activo);

    const { data, error } = await supabase
      .from("servicios")
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
