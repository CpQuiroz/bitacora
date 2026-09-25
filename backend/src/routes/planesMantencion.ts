// ============================================================
// BITÁCORA — Bloque C: Plan de Mantención Preventiva de un equipo.
// Solo CRUD por ahora — la generación automática de una OS al llegar
// proxima_fecha queda pendiente (ver TODO en PlanMantencion,
// packages/shared/src/types.ts).
// ============================================================
import { Router } from "express";
import type { PlanMantencion } from "@bitacora/shared";
import { supabase } from "../supabase";
import type { RequestConEmpresa } from "../empresa";
import { ah } from "../asyncHandler";
import { esVehiculo, puedeEscribirEquipo } from "./equipos";

export const planesMantencionRouter = Router();

const FECHA = /^\d{4}-\d{2}-\d{2}$/;
const SIN_PERMISO = "No tienes permiso para gestionar el plan de mantención de este equipo";

async function equipoDeEmpresa(empresaId: string, equipoId: string) {
  const { data } = await supabase.from("equipos").select("id, categoria, patente").eq("empresa_id", empresaId).eq("id", equipoId).maybeSingle();
  return data;
}

// Tarea 146: antes ningún handler de escritura chequeaba permisos. Mismo
// criterio que editar el equipo (equipos.ts): vehículo → "flota"; otro
// equipo → "equipos" o "flota".
async function puedeGestionarPlanDe(req: RequestConEmpresa, equipoId: string, yaLeido?: { categoria: string | null; patente: string | null } | null): Promise<boolean> {
  const equipo = yaLeido ?? (await equipoDeEmpresa(req.empresaId!, equipoId));
  return Boolean(equipo) && (await puedeEscribirEquipo(req, esVehiculo(equipo)));
}

async function equipoDelPlan(empresaId: string, planId: string): Promise<string | null> {
  const { data } = await supabase.from("planes_mantencion").select("equipo_id").eq("empresa_id", empresaId).eq("id", planId).maybeSingle();
  return data?.equipo_id ?? null;
}

planesMantencionRouter.get(
  "/",
  ah<RequestConEmpresa>(async (req, res) => {
    const { equipo_id } = req.query;
    let query = supabase.from("planes_mantencion").select("*").eq("empresa_id", req.empresaId!).order("proxima_fecha", { ascending: true });
    if (typeof equipo_id === "string" && equipo_id) query = query.eq("equipo_id", equipo_id);
    const { data, error } = await query;
    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    res.json(data ?? []);
  })
);

planesMantencionRouter.post(
  "/",
  ah<RequestConEmpresa>(async (req, res) => {
    const { equipo_id, frecuencia_dias, proxima_fecha, notas } = req.body ?? {};

    const equipo = typeof equipo_id === "string" && equipo_id ? await equipoDeEmpresa(req.empresaId!, equipo_id) : null;
    if (!equipo) {
      res.status(400).json({ error: "equipo_id inválido" });
      return;
    }
    if (!(await puedeGestionarPlanDe(req, equipo_id, equipo))) {
      res.status(403).json({ error: SIN_PERMISO });
      return;
    }
    const frecuencia = Number(frecuencia_dias);
    if (!Number.isInteger(frecuencia) || frecuencia <= 0) {
      res.status(400).json({ error: "frecuencia_dias debe ser un entero mayor a 0" });
      return;
    }
    if (typeof proxima_fecha !== "string" || !FECHA.test(proxima_fecha)) {
      res.status(400).json({ error: "Falta proxima_fecha (YYYY-MM-DD)" });
      return;
    }

    const { data, error } = await supabase
      .from("planes_mantencion")
      .insert({ empresa_id: req.empresaId!, equipo_id, frecuencia_dias: frecuencia, proxima_fecha, notas: notas?.trim() || null })
      .select()
      .single();

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    res.status(201).json(data);
  })
);

planesMantencionRouter.patch(
  "/:id",
  ah<RequestConEmpresa>(async (req, res) => {
    const equipoId = await equipoDelPlan(req.empresaId!, req.params.id);
    if (!equipoId) {
      res.status(404).json({ error: "Plan no encontrado" });
      return;
    }
    if (!(await puedeGestionarPlanDe(req, equipoId))) {
      res.status(403).json({ error: SIN_PERMISO });
      return;
    }
    const { frecuencia_dias, proxima_fecha, notas, activo } = req.body ?? {};
    const cambios: Partial<PlanMantencion> = {};

    if (frecuencia_dias !== undefined) {
      const frecuencia = Number(frecuencia_dias);
      if (!Number.isInteger(frecuencia) || frecuencia <= 0) {
        res.status(400).json({ error: "frecuencia_dias debe ser un entero mayor a 0" });
        return;
      }
      cambios.frecuencia_dias = frecuencia;
    }
    if (proxima_fecha !== undefined) {
      if (typeof proxima_fecha !== "string" || !FECHA.test(proxima_fecha)) {
        res.status(400).json({ error: "proxima_fecha inválida" });
        return;
      }
      cambios.proxima_fecha = proxima_fecha;
    }
    if (notas !== undefined) cambios.notas = notas?.trim() || null;
    if (activo !== undefined) {
      if (typeof activo !== "boolean") {
        res.status(400).json({ error: "activo debe ser verdadero o falso" });
        return;
      }
      cambios.activo = activo;
    }

    if (Object.keys(cambios).length === 0) {
      res.status(400).json({ error: "Nada que actualizar" });
      return;
    }

    const { data, error } = await supabase
      .from("planes_mantencion")
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
      res.status(404).json({ error: "Plan no encontrado" });
      return;
    }
    res.json(data);
  })
);

planesMantencionRouter.delete(
  "/:id",
  ah<RequestConEmpresa>(async (req, res) => {
    const equipoId = await equipoDelPlan(req.empresaId!, req.params.id);
    if (!equipoId) {
      res.status(404).json({ error: "Plan no encontrado" });
      return;
    }
    if (!(await puedeGestionarPlanDe(req, equipoId))) {
      res.status(403).json({ error: SIN_PERMISO });
      return;
    }
    const { error, count } = await supabase
      .from("planes_mantencion")
      .delete({ count: "exact" })
      .eq("empresa_id", req.empresaId!)
      .eq("id", req.params.id);
    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    if (!count) {
      res.status(404).json({ error: "Plan no encontrado" });
      return;
    }
    res.status(204).end();
  })
);
