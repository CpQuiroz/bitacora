import { Router } from "express";
import type { TipoPack } from "@bitacora/shared";
import { supabase } from "../supabase";
import type { RequestConEmpresa } from "../empresa";
import { ah } from "../asyncHandler";
import { requiereModulo } from "../permisos";

// CATÁLOGO de packs (Agenda Pro) — la plantilla que define el negocio
// una sola vez. No tiene saldo: vender un pack crea una INSTANCIA aparte
// (paquetes_sesiones) con un snapshot de estos valores. Ver
// supabase/migrations/84_tipos_pack.sql y 90.
export const tiposPackRouter = Router();

tiposPackRouter.use(requiereModulo("agenda_pro"));

async function servicioExiste(empresaId: string, servicioId: string) {
  const { data } = await supabase.from("servicios").select("id").eq("empresa_id", empresaId).eq("id", servicioId).maybeSingle();
  return Boolean(data);
}

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
    const { nombre, cantidad_sesiones, precio, servicio_id, vigencia_dias } = req.body ?? {};

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
    if (servicio_id !== null && servicio_id !== undefined && !(await servicioExiste(req.empresaId!, servicio_id))) {
      res.status(400).json({ error: "servicio_id inválido" });
      return;
    }
    // Opcional — null/ausente = el pack no vence.
    if (vigencia_dias !== null && vigencia_dias !== undefined && (!Number.isInteger(vigencia_dias) || vigencia_dias <= 0)) {
      res.status(400).json({ error: "vigencia_dias debe ser un entero mayor a 0" });
      return;
    }

    const { data, error } = await supabase
      .from("tipos_pack")
      .insert({
        empresa_id: req.empresaId!,
        nombre: nombre.trim(),
        cantidad_sesiones,
        precio: precio ?? null,
        servicio_id: servicio_id || null,
        vigencia_dias: vigencia_dias ?? null,
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
    const { nombre, cantidad_sesiones, precio, activo, servicio_id, vigencia_dias } = req.body ?? {};
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
    if (servicio_id !== undefined) {
      if (servicio_id !== null && !(await servicioExiste(req.empresaId!, servicio_id))) {
        res.status(400).json({ error: "servicio_id inválido" });
        return;
      }
      cambios.servicio_id = servicio_id || null;
    }
    if (vigencia_dias !== undefined) {
      if (vigencia_dias !== null && (!Number.isInteger(vigencia_dias) || vigencia_dias <= 0)) {
        res.status(400).json({ error: "vigencia_dias debe ser un entero mayor a 0" });
        return;
      }
      cambios.vigencia_dias = vigencia_dias;
    }

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
