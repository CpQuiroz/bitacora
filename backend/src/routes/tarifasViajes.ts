// ============================================================
// Tarifas de viajes (tarea 135): precio por tramo (par de ciudades, vale
// en ambos sentidos) y precio por km, generales o por cliente. Solo Admin
// y Supervisor (decisión de la usuaria: estos costos no los ve el chofer).
// Montado en /api/viajes/tarifas detrás de requiereModulo("viajes").
// ============================================================
import { Router, type Response } from "express";
import { ROLES_SUPERVISION, calcularPorKm, calcularPorTramos, parTramo } from "@bitacora/shared";
import { supabase } from "../supabase";
import type { RequestConEmpresa } from "../empresa";
import { ah } from "../asyncHandler";

export const tarifasViajesRouter = Router();

tarifasViajesRouter.use(
  ah<RequestConEmpresa>(async (req, res, next) => {
    if (!ROLES_SUPERVISION.includes(req.rol ?? "")) {
      res.status(403).json({ error: "Las tarifas solo las ven el administrador y el supervisor" });
      return;
    }
    next();
  })
);

function montoValido(v: unknown): number | null {
  const n = Number(v);
  return v === "" || v === null || v === undefined || !Number.isFinite(n) || n < 0 ? null : Math.round(n * 100) / 100;
}

// cliente_id opcional; si viene, tiene que ser de la empresa.
async function clienteDeEmpresa(empresaId: string, clienteId: unknown): Promise<{ id: string | null } | { error: string }> {
  if (clienteId === undefined || clienteId === null || clienteId === "") return { id: null };
  if (typeof clienteId !== "string") return { error: "Cliente inválido" };
  const { data } = await supabase.from("clientes").select("id").eq("empresa_id", empresaId).eq("id", clienteId).maybeSingle();
  return data ? { id: data.id } : { error: "El cliente no existe en tu empresa" };
}

function responderError(res: Response, error: { code?: string; message: string }, duplicado: string) {
  if (error.code === "23505") res.status(409).json({ error: duplicado });
  else res.status(500).json({ error: error.message });
}

tarifasViajesRouter.get(
  "/",
  ah<RequestConEmpresa>(async (req, res) => {
    const [tramos, km] = await Promise.all([
      supabase
        .from("tarifas_tramo")
        .select("*, cliente:clientes(id, nombre)")
        .eq("empresa_id", req.empresaId!)
        .order("par_a")
        .order("par_b"),
      supabase.from("tarifas_km").select("*, cliente:clientes(id, nombre)").eq("empresa_id", req.empresaId!).order("creado_en"),
    ]);
    if (tramos.error || km.error) {
      res.status(500).json({ error: (tramos.error ?? km.error)!.message });
      return;
    }
    res.json({ tramos: tramos.data ?? [], km: km.data ?? [] });
  })
);

tarifasViajesRouter.post(
  "/tramos",
  ah<RequestConEmpresa>(async (req, res) => {
    const { origen, destino, precio, cliente_id } = req.body ?? {};
    if (typeof origen !== "string" || !origen.trim() || typeof destino !== "string" || !destino.trim()) {
      res.status(400).json({ error: "Indica origen y destino" });
      return;
    }
    const par = parTramo(origen, destino);
    if (par.par_a === par.par_b) {
      res.status(400).json({ error: "Origen y destino deben ser distintos" });
      return;
    }
    const monto = montoValido(precio);
    if (monto === null) {
      res.status(400).json({ error: "Precio inválido" });
      return;
    }
    const cliente = await clienteDeEmpresa(req.empresaId!, cliente_id);
    if ("error" in cliente) {
      res.status(400).json({ error: cliente.error });
      return;
    }
    const { data, error } = await supabase
      .from("tarifas_tramo")
      .insert({ empresa_id: req.empresaId!, cliente_id: cliente.id, origen: origen.trim(), destino: destino.trim(), ...par, precio: monto })
      .select("*, cliente:clientes(id, nombre)")
      .single();
    if (error) {
      responderError(res, error, "Ya existe una tarifa para ese tramo (vale en ambos sentidos)");
      return;
    }
    res.status(201).json(data);
  })
);

tarifasViajesRouter.patch(
  "/tramos/:id",
  ah<RequestConEmpresa>(async (req, res) => {
    const { precio, activo } = req.body ?? {};
    const cambios: { precio?: number; activo?: boolean; actualizado_en: string } = { actualizado_en: new Date().toISOString() };
    if (precio !== undefined) {
      const monto = montoValido(precio);
      if (monto === null) {
        res.status(400).json({ error: "Precio inválido" });
        return;
      }
      cambios.precio = monto;
    }
    if (activo !== undefined) cambios.activo = activo === true;
    const { data, error } = await supabase
      .from("tarifas_tramo")
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
      res.status(404).json({ error: "Tarifa no encontrada" });
      return;
    }
    res.json(data);
  })
);

tarifasViajesRouter.delete(
  "/tramos/:id",
  ah<RequestConEmpresa>(async (req, res) => {
    const { data, error } = await supabase.from("tarifas_tramo").delete().eq("empresa_id", req.empresaId!).eq("id", req.params.id).select("id");
    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    if (!data?.length) {
      res.status(404).json({ error: "Tarifa no encontrada" });
      return;
    }
    res.status(204).end();
  })
);

// Precio por km: una tarifa general (cliente_id null) y una por cliente.
tarifasViajesRouter.put(
  "/km",
  ah<RequestConEmpresa>(async (req, res) => {
    const { precio_km, cliente_id } = req.body ?? {};
    const monto = montoValido(precio_km);
    if (monto === null) {
      res.status(400).json({ error: "Precio por km inválido" });
      return;
    }
    const cliente = await clienteDeEmpresa(req.empresaId!, cliente_id);
    if ("error" in cliente) {
      res.status(400).json({ error: cliente.error });
      return;
    }
    let q = supabase.from("tarifas_km").select("id").eq("empresa_id", req.empresaId!);
    q = cliente.id ? q.eq("cliente_id", cliente.id) : q.is("cliente_id", null);
    const { data: existente } = await q.maybeSingle();
    const ahora = new Date().toISOString();
    const r = existente
      ? await supabase
          .from("tarifas_km")
          .update({ precio_km: monto, activo: true, actualizado_en: ahora })
          .eq("empresa_id", req.empresaId!)
          .eq("id", existente.id)
          .select("*, cliente:clientes(id, nombre)")
          .single()
      : await supabase
          .from("tarifas_km")
          .insert({ empresa_id: req.empresaId!, cliente_id: cliente.id, precio_km: monto })
          .select("*, cliente:clientes(id, nombre)")
          .single();
    if (r.error) {
      responderError(res, r.error, "Ya existe una tarifa por km para ese cliente");
      return;
    }
    res.status(existente ? 200 : 201).json(r.data);
  })
);

tarifasViajesRouter.delete(
  "/km/:id",
  ah<RequestConEmpresa>(async (req, res) => {
    const { data, error } = await supabase.from("tarifas_km").delete().eq("empresa_id", req.empresaId!).eq("id", req.params.id).select("id");
    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    if (!data?.length) {
      res.status(404).json({ error: "Tarifa no encontrada" });
      return;
    }
    res.status(204).end();
  })
);

// Precio propuesto para un viaje (lo usa el formulario; el Admin puede
// ajustarlo antes de guardar). Por tramos: paradas en orden. Por km: km.
tarifasViajesRouter.post(
  "/calcular",
  ah<RequestConEmpresa>(async (req, res) => {
    const { modo, paradas, km, cliente_id } = req.body ?? {};
    const cliente = await clienteDeEmpresa(req.empresaId!, cliente_id);
    if ("error" in cliente) {
      res.status(400).json({ error: cliente.error });
      return;
    }
    if (modo === "tramos") {
      if (!Array.isArray(paradas) || paradas.filter((p) => typeof p === "string" && p.trim()).length < 2) {
        res.status(400).json({ error: "Indica al menos origen y destino" });
        return;
      }
      const { data: tarifas, error } = await supabase
        .from("tarifas_tramo")
        .select("par_a, par_b, cliente_id, precio, activo")
        .eq("empresa_id", req.empresaId!)
        .eq("activo", true);
      if (error) {
        res.status(500).json({ error: error.message });
        return;
      }
      res.json({ modo, ...calcularPorTramos(paradas.filter((p): p is string => typeof p === "string"), tarifas ?? [], cliente.id) });
      return;
    }
    if (modo === "km") {
      const kmNum = montoValido(km);
      if (kmNum === null) {
        res.status(400).json({ error: "Kilómetros inválidos" });
        return;
      }
      const tarifa = await tarifaKmDe(req.empresaId!, cliente.id);
      if (tarifa === null) {
        res.status(400).json({ error: "No hay precio por km definido en Viajes › Tarifas" });
        return;
      }
      res.json({ modo, km: kmNum, precio_km: tarifa, subtotal: calcularPorKm(kmNum, tarifa) });
      return;
    }
    res.status(400).json({ error: "El modo debe ser tramos o km" });
  })
);

// Tarifa por km aplicable: la del cliente si existe, si no la general.
export async function tarifaKmDe(empresaId: string, clienteId: string | null): Promise<number | null> {
  const { data } = await supabase.from("tarifas_km").select("cliente_id, precio_km").eq("empresa_id", empresaId).eq("activo", true);
  const propia = clienteId ? data?.find((t) => t.cliente_id === clienteId) : undefined;
  const general = data?.find((t) => t.cliente_id === null);
  const t = propia ?? general;
  return t ? Number(t.precio_km) : null;
}
