import { Router } from "express";
import { supabase } from "../supabase";
import type { RequestConEmpresa } from "../empresa";
import { ah } from "../asyncHandler";
import { requiereModulo } from "../permisos";

export const paquetesSesionesRouter = Router();

paquetesSesionesRouter.use(requiereModulo("agenda_pro"));

async function clienteExiste(empresaId: string, clienteId: string) {
  const { data } = await supabase.from("clientes").select("id").eq("empresa_id", empresaId).eq("id", clienteId).maybeSingle();
  return Boolean(data);
}

paquetesSesionesRouter.get(
  "/",
  ah<RequestConEmpresa>(async (req, res) => {
    const { cliente_id } = req.query;

    let query = supabase
      .from("paquetes_sesiones")
      .select("*, cliente:clientes(nombre)")
      .eq("empresa_id", req.empresaId!)
      .order("creado_en", { ascending: false });
    if (typeof cliente_id === "string" && cliente_id) query = query.eq("cliente_id", cliente_id);

    const { data: paquetes, error } = await query;
    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    const ids = (paquetes ?? []).map((p) => p.id);
    const consumoPorPaquete = new Map<string, number>();
    if (ids.length > 0) {
      // no_asistio SÍ cuenta (se pierde la sesión) — solo "cancelada"
      // y "cancelada_anticipada" liberan el cupo.
      const { data: consumos } = await supabase
        .from("tareas")
        .select("paquete_id, sesiones_consumidas")
        .eq("empresa_id", req.empresaId!)
        .in("paquete_id", ids)
        .neq("estado", "cancelada")
        .neq("estado", "cancelada_anticipada");
      for (const c of consumos ?? []) {
        if (!c.paquete_id) continue;
        consumoPorPaquete.set(c.paquete_id, (consumoPorPaquete.get(c.paquete_id) ?? 0) + c.sesiones_consumidas);
      }
    }

    res.json((paquetes ?? []).map((p) => ({ ...p, saldo: p.cantidad_total - (consumoPorPaquete.get(p.id) ?? 0) })));
  })
);

paquetesSesionesRouter.post(
  "/",
  ah<RequestConEmpresa>(async (req, res) => {
    const { cliente_id, nombre, cantidad_total, fecha_compra, notas, tipo_pack_id } = req.body ?? {};

    if (typeof cliente_id !== "string" || !cliente_id || !(await clienteExiste(req.empresaId!, cliente_id))) {
      res.status(400).json({ error: "cliente_id inválido" });
      return;
    }
    if (typeof nombre !== "string" || !nombre.trim()) {
      res.status(400).json({ error: "Falta nombre" });
      return;
    }
    if (!Number.isInteger(cantidad_total) || cantidad_total <= 0) {
      res.status(400).json({ error: "cantidad_total debe ser un entero mayor a 0" });
      return;
    }
    // tipo_pack_id es solo trazabilidad (de qué plantilla del catálogo
    // salió) — nombre/cantidad_total siempre se copian, así que un tipo
    // inválido o de otra empresa simplemente se ignora en vez de bloquear
    // la venta.
    let tipoPackId: string | null = null;
    if (typeof tipo_pack_id === "string" && tipo_pack_id) {
      const { data: tipo } = await supabase
        .from("tipos_pack")
        .select("id")
        .eq("id", tipo_pack_id)
        .eq("empresa_id", req.empresaId!)
        .maybeSingle();
      if (tipo) tipoPackId = tipo.id;
    }

    const { data, error } = await supabase
      .from("paquetes_sesiones")
      .insert({
        empresa_id: req.empresaId!,
        cliente_id,
        tipo_pack_id: tipoPackId,
        nombre: nombre.trim(),
        cantidad_total,
        fecha_compra: fecha_compra || new Date().toISOString().slice(0, 10),
        notas: notas?.trim() || null,
      })
      .select()
      .single();

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    res.status(201).json({ ...data, saldo: data.cantidad_total });
  })
);
