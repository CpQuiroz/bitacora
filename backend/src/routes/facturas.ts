import { Router } from "express";
import { supabase } from "../supabase";
import type { RequestConEmpresa } from "../empresa";
import { ah } from "../asyncHandler";

export const facturasRouter = Router();

facturasRouter.get(
  "/",
  ah<RequestConEmpresa>(async (req, res) => {
    const { data, error } = await supabase
      .from("facturas")
      .select("*")
      .eq("empresa_id", req.empresaId!)
      .order("fecha_emision", { ascending: false });

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    res.json(data);
  })
);

// Arma una factura a partir de trabajos ya registrados, vía la
// función generar_factura() de 04_generalizacion.sql (suma montos,
// crea la fila y la deja vinculada a esos trabajos).
facturasRouter.post(
  "/",
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

    const { data: factura, error: errorFactura } = await supabase
      .from("facturas")
      .select("*")
      .eq("id", facturaId)
      .single();
    if (errorFactura) {
      res.status(500).json({ error: errorFactura.message });
      return;
    }
    res.status(201).json(factura);
  })
);
