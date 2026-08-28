import { Router } from "express";
import type { EstadoFactura, Factura, MedioPago } from "@bitacora/shared";
import { supabase } from "../supabase";
import type { RequestConEmpresa } from "../empresa";
import { ah } from "../asyncHandler";

export const cobrosRouter = Router();

const ESTADOS: EstadoFactura[] = ["pendiente", "pagada", "vencida"];
const MEDIOS: MedioPago[] = ["webpay", "flow", "mercadopago", "transferencia", "efectivo", "otro"];
const PROVEEDORES_PASARELA: MedioPago[] = ["webpay", "flow", "mercadopago"];

cobrosRouter.get(
  "/",
  ah<RequestConEmpresa>(async (req, res) => {
    const { data, error } = await supabase
      .from("facturas")
      .select("*, cliente_info:clientes(id, nombre)")
      .eq("empresa_id", req.empresaId!)
      .order("fecha_emision", { ascending: false });

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    res.json(data ?? []);
  })
);

// Cobro manual: cliente + monto directos, sin pasar por trabajos.
cobrosRouter.post(
  "/",
  ah<RequestConEmpresa>(async (req, res) => {
    const { cliente_id, monto, fecha_emision, fecha_vencimiento, medio_pago } = req.body ?? {};

    if (typeof cliente_id !== "string" || !cliente_id.trim()) {
      res.status(400).json({ error: "Selecciona un cliente" });
      return;
    }
    const { data: cliente } = await supabase
      .from("clientes")
      .select("id, nombre")
      .eq("empresa_id", req.empresaId!)
      .eq("id", cliente_id)
      .maybeSingle();
    if (!cliente) {
      res.status(400).json({ error: "El cliente indicado no existe" });
      return;
    }
    const montoNum = Number(monto);
    if (!Number.isFinite(montoNum) || montoNum <= 0) {
      res.status(400).json({ error: "monto inválido" });
      return;
    }
    if (typeof fecha_emision !== "string" || !fecha_emision) {
      res.status(400).json({ error: "Falta fecha de emisión" });
      return;
    }
    if (typeof fecha_vencimiento !== "string" || !fecha_vencimiento) {
      res.status(400).json({ error: "Falta fecha de vencimiento" });
      return;
    }
    if (medio_pago !== undefined && medio_pago !== null && !MEDIOS.includes(medio_pago)) {
      res.status(400).json({ error: `medio_pago debe ser uno de: ${MEDIOS.join(", ")}` });
      return;
    }

    const { data, error } = await supabase
      .from("facturas")
      .insert({
        empresa_id: req.empresaId!,
        cliente: cliente.nombre,
        cliente_id: cliente.id,
        monto: montoNum,
        fecha_emision,
        fecha_vencimiento,
        medio_pago: medio_pago || null,
        estado: "pendiente",
      })
      .select("*, cliente_info:clientes(id, nombre)")
      .single();

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    res.status(201).json(data);
  })
);

// Cobro desde trabajos completados — arma el monto sumando los
// trabajos seleccionados vía generar_factura() (04_generalizacion.sql).
cobrosRouter.post(
  "/desde-trabajos",
  ah<RequestConEmpresa>(async (req, res) => {
    const { cliente, semana, trabajo_ids, dias_plazo } = req.body ?? {};

    if (typeof cliente !== "string" || !cliente.trim()) {
      res.status(400).json({ error: "Falta cliente" });
      return;
    }
    if (!Array.isArray(trabajo_ids) || trabajo_ids.length === 0) {
      res.status(400).json({ error: "Selecciona al menos un trabajo" });
      return;
    }

    const { data: facturaId, error } = await supabase.rpc("generar_factura", {
      p_empresa_id: req.empresaId!,
      p_cliente: cliente.trim(),
      p_semana: typeof semana === "string" ? semana : "",
      p_trabajo_ids: trabajo_ids,
      p_dias_plazo: typeof dias_plazo === "number" ? dias_plazo : 30,
    });

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    // generar_factura() no conoce cliente_id (recibe solo texto) — se
    // completa acá mirando el cliente_id del primer trabajo incluido,
    // así el cobro queda vinculado igual que uno creado manualmente.
    const { data: primerTrabajo } = await supabase
      .from("trabajos")
      .select("cliente_id")
      .eq("id", trabajo_ids[0])
      .maybeSingle();
    if (primerTrabajo?.cliente_id) {
      await supabase.from("facturas").update({ cliente_id: primerTrabajo.cliente_id }).eq("id", facturaId);
    }

    const { data: factura, error: errorFactura } = await supabase
      .from("facturas")
      .select("*, cliente_info:clientes(id, nombre)")
      .eq("id", facturaId)
      .single();
    if (errorFactura) {
      res.status(500).json({ error: errorFactura.message });
      return;
    }
    res.status(201).json(factura);
  })
);

cobrosRouter.patch(
  "/:id",
  ah<RequestConEmpresa>(async (req, res) => {
    const { estado, fecha_pago, medio_pago } = req.body ?? {};
    const cambios: Partial<Factura> = {};

    if (estado !== undefined) {
      if (!ESTADOS.includes(estado)) {
        res.status(400).json({ error: `estado debe ser uno de: ${ESTADOS.join(", ")}` });
        return;
      }
      cambios.estado = estado;
      cambios.fecha_pago = estado === "pagada" ? fecha_pago || new Date().toISOString().slice(0, 10) : null;
    }
    if (medio_pago !== undefined) {
      if (medio_pago !== null && !MEDIOS.includes(medio_pago)) {
        res.status(400).json({ error: `medio_pago debe ser uno de: ${MEDIOS.join(", ")}` });
        return;
      }
      cambios.medio_pago = medio_pago;
    }

    if (Object.keys(cambios).length === 0) {
      res.status(400).json({ error: "Nada que actualizar" });
      return;
    }

    const { data, error } = await supabase
      .from("facturas")
      .update(cambios)
      .eq("empresa_id", req.empresaId!)
      .eq("id", req.params.id)
      .select("*, cliente_info:clientes(id, nombre)")
      .maybeSingle();

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    if (!data) {
      res.status(404).json({ error: "Cobro no encontrado" });
      return;
    }
    res.json(data);
  })
);

// Genera un link de pago con la pasarela conectada en Configuración →
// Integraciones. IMPORTANTE: no hay credenciales de sandbox de
// Webpay/Flow/Mercado Pago disponibles en este entorno, así que esto
// NUNCA llama a una API real — solo exige que la integración esté
// "conectada" y guarda un link simulado, dejando clarísimo en la
// respuesta que es una simulación.
cobrosRouter.post(
  "/:id/generar-link-pago",
  ah<RequestConEmpresa>(async (req, res) => {
    const { proveedor: proveedorRaw } = req.body ?? {};
    if (typeof proveedorRaw !== "string" || !PROVEEDORES_PASARELA.includes(proveedorRaw as MedioPago)) {
      res.status(400).json({ error: `proveedor debe ser uno de: ${PROVEEDORES_PASARELA.join(", ")}` });
      return;
    }
    const proveedor = proveedorRaw as "webpay" | "flow" | "mercadopago";

    const { data: integracion } = await supabase
      .from("integraciones")
      .select("conectado")
      .eq("empresa_id", req.empresaId!)
      .eq("proveedor", proveedor)
      .maybeSingle();
    if (!integracion?.conectado) {
      res.status(400).json({ error: `Conecta ${proveedor} en Configuración → Integraciones primero` });
      return;
    }

    const linkSimulado = `https://pagos-simulados.bitacora.app/${proveedor}/${req.params.id}`;

    const { data, error } = await supabase
      .from("facturas")
      .update({ medio_pago: proveedor, link_pago: linkSimulado })
      .eq("empresa_id", req.empresaId!)
      .eq("id", req.params.id)
      .select("*, cliente_info:clientes(id, nombre)")
      .maybeSingle();

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    if (!data) {
      res.status(404).json({ error: "Cobro no encontrado" });
      return;
    }
    res.json({ ...data, simulado: true });
  })
);
