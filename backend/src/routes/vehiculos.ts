import { Router } from "express";
import type { Vehiculo } from "@bitacora/shared";
import { supabase } from "../supabase";
import type { RequestConEmpresa } from "../empresa";
import { ah } from "../asyncHandler";

export const vehiculosRouter = Router();

// Vehículo actualmente asignado a cada uno (sin "hasta", o "hasta" en el
// futuro) — se usa acá y también en Ruteo/Viajes cuando lo necesiten.
async function asignacionVigentePorVehiculo(empresaId: string, vehiculoIds: string[]) {
  if (vehiculoIds.length === 0) return new Map<string, { colaborador_id: string; colaborador_nombre: string }>();
  const hoy = new Date().toISOString().slice(0, 10);
  const { data } = await supabase
    .from("vehiculo_asignaciones")
    .select("vehiculo_id, colaborador_id, desde, hasta, colaborador:usuarios(nombre)")
    .eq("empresa_id", empresaId)
    .in("vehiculo_id", vehiculoIds)
    .lte("desde", hoy)
    .or(`hasta.is.null,hasta.gte.${hoy}`)
    .order("desde", { ascending: false });

  const mapa = new Map<string, { colaborador_id: string; colaborador_nombre: string }>();
  for (const a of data ?? []) {
    if (mapa.has(a.vehiculo_id)) continue; // ya tomamos la más reciente
    const colaboradorNombre = (a as unknown as { colaborador: { nombre: string } | null }).colaborador?.nombre ?? "—";
    mapa.set(a.vehiculo_id, { colaborador_id: a.colaborador_id, colaborador_nombre: colaboradorNombre });
  }
  return mapa;
}

vehiculosRouter.get(
  "/",
  ah<RequestConEmpresa>(async (req, res) => {
    const { data, error } = await supabase.from("vehiculos").select("*").eq("empresa_id", req.empresaId!).order("patente");
    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    const asignaciones = await asignacionVigentePorVehiculo(req.empresaId!, (data ?? []).map((v) => v.id));
    res.json((data ?? []).map((v) => ({ ...v, asignacion_vigente: asignaciones.get(v.id) ?? null })));
  })
);

vehiculosRouter.get(
  "/:id",
  ah<RequestConEmpresa>(async (req, res) => {
    const { data, error } = await supabase.from("vehiculos").select("*").eq("empresa_id", req.empresaId!).eq("id", req.params.id).maybeSingle();
    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    if (!data) {
      res.status(404).json({ error: "Vehículo no encontrado" });
      return;
    }
    const asignaciones = await asignacionVigentePorVehiculo(req.empresaId!, [data.id]);
    res.json({ ...data, asignacion_vigente: asignaciones.get(data.id) ?? null });
  })
);

vehiculosRouter.post(
  "/",
  ah<RequestConEmpresa>(async (req, res) => {
    const { patente, marca, modelo, anio, tipo, capacidad_carga } = req.body ?? {};
    if (typeof patente !== "string" || !patente.trim()) {
      res.status(400).json({ error: "Falta patente" });
      return;
    }

    const { data, error } = await supabase
      .from("vehiculos")
      .insert({
        empresa_id: req.empresaId!,
        patente: patente.trim().toUpperCase(),
        marca: marca?.trim() || null,
        modelo: modelo?.trim() || null,
        anio: anio ? Number(anio) : null,
        tipo: tipo?.trim() || null,
        capacidad_carga: capacidad_carga?.trim() || null,
      })
      .select()
      .single();

    if (error) {
      res.status(error.code === "23505" ? 409 : 500).json({
        error: error.code === "23505" ? "Ya existe un vehículo con esa patente" : error.message,
      });
      return;
    }
    res.status(201).json(data);
  })
);

vehiculosRouter.patch(
  "/:id",
  ah<RequestConEmpresa>(async (req, res) => {
    const { patente, marca, modelo, anio, tipo, capacidad_carga, activo } = req.body ?? {};
    const cambios: Partial<Vehiculo> = {};
    if (patente !== undefined) {
      if (typeof patente !== "string" || !patente.trim()) {
        res.status(400).json({ error: "Falta patente" });
        return;
      }
      cambios.patente = patente.trim().toUpperCase();
    }
    if (marca !== undefined) cambios.marca = marca?.trim() || null;
    if (modelo !== undefined) cambios.modelo = modelo?.trim() || null;
    if (anio !== undefined) cambios.anio = anio ? Number(anio) : null;
    if (tipo !== undefined) cambios.tipo = tipo?.trim() || null;
    if (capacidad_carga !== undefined) cambios.capacidad_carga = capacidad_carga?.trim() || null;
    if (activo !== undefined) cambios.activo = Boolean(activo);
    if (Object.keys(cambios).length === 0) {
      res.status(400).json({ error: "Nada que actualizar" });
      return;
    }

    const { data, error } = await supabase
      .from("vehiculos")
      .update(cambios)
      .eq("empresa_id", req.empresaId!)
      .eq("id", req.params.id)
      .select()
      .maybeSingle();

    if (error) {
      res.status(error.code === "23505" ? 409 : 500).json({
        error: error.code === "23505" ? "Ya existe un vehículo con esa patente" : error.message,
      });
      return;
    }
    if (!data) {
      res.status(404).json({ error: "Vehículo no encontrado" });
      return;
    }
    res.json(data);
  })
);

// Historial de asignaciones de un vehículo (más reciente primero).
vehiculosRouter.get(
  "/:id/asignaciones",
  ah<RequestConEmpresa>(async (req, res) => {
    const { data, error } = await supabase
      .from("vehiculo_asignaciones")
      .select("*, colaborador:usuarios(nombre)")
      .eq("empresa_id", req.empresaId!)
      .eq("vehiculo_id", req.params.id)
      .order("desde", { ascending: false });
    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    res.json(data);
  })
);

// Asigna el vehículo a un colaborador — si había una asignación vigente
// (sin "hasta"), se cierra automáticamente el día anterior, así el
// vehículo no queda "asignado" a dos personas a la vez.
vehiculosRouter.post(
  "/:id/asignar",
  ah<RequestConEmpresa>(async (req, res) => {
    const { colaborador_id, desde } = req.body ?? {};
    if (typeof colaborador_id !== "string" || !colaborador_id.trim()) {
      res.status(400).json({ error: "Falta colaborador_id" });
      return;
    }
    const { data: vehiculo } = await supabase.from("vehiculos").select("id").eq("empresa_id", req.empresaId!).eq("id", req.params.id).maybeSingle();
    if (!vehiculo) {
      res.status(404).json({ error: "Vehículo no encontrado" });
      return;
    }
    const { data: colaborador } = await supabase
      .from("usuarios")
      .select("id")
      .eq("empresa_id", req.empresaId!)
      .eq("id", colaborador_id)
      .maybeSingle();
    if (!colaborador) {
      res.status(400).json({ error: "El colaborador indicado no existe" });
      return;
    }

    const fechaDesde = typeof desde === "string" && desde ? desde : new Date().toISOString().slice(0, 10);
    const diaAnterior = new Date(new Date(fechaDesde).getTime() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    await supabase
      .from("vehiculo_asignaciones")
      .update({ hasta: diaAnterior })
      .eq("empresa_id", req.empresaId!)
      .eq("vehiculo_id", req.params.id)
      .is("hasta", null);

    const { data, error } = await supabase
      .from("vehiculo_asignaciones")
      .insert({ empresa_id: req.empresaId!, vehiculo_id: req.params.id, colaborador_id, desde: fechaDesde })
      .select("*, colaborador:usuarios(nombre)")
      .single();

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    res.status(201).json(data);
  })
);

// Termina la asignación vigente de un vehículo (sin reemplazarla por otra).
vehiculosRouter.post(
  "/:id/desasignar",
  ah<RequestConEmpresa>(async (req, res) => {
    const { error, count } = await supabase
      .from("vehiculo_asignaciones")
      .update({ hasta: new Date().toISOString().slice(0, 10) }, { count: "exact" })
      .eq("empresa_id", req.empresaId!)
      .eq("vehiculo_id", req.params.id)
      .is("hasta", null);
    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    if (!count) {
      res.status(404).json({ error: "Este vehículo no tiene una asignación vigente" });
      return;
    }
    res.status(204).end();
  })
);
