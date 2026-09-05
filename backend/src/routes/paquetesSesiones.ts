import { Router } from "express";
import { supabase } from "../supabase";
import type { RequestConEmpresa } from "../empresa";
import { ah } from "../asyncHandler";
import { requiereModulo } from "../permisos";
import { calcularConsumoPorPaquete } from "../agendaPro";

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
    const consumoPorPaquete = await calcularConsumoPorPaquete(req.empresaId!, ids);

    res.json((paquetes ?? []).map((p) => ({ ...p, saldo: p.cantidad_total - (consumoPorPaquete.get(p.id) ?? 0) })));
  })
);

// Vender/asignar un pack a un cliente = crear una INSTANCIA en
// paquetes_sesiones. Si viene tipo_pack_id, el snapshot (nombre,
// cantidad, precio, servicio, vencimiento) se copia AUTORITATIVAMENTE
// desde el catálogo — no se confía en lo que mande el cliente para esos
// campos. Si el negocio cambia el catálogo después, esta instancia no se
// entera. `precio_pagado` sí lo pone quien vende (descuento puntual).
paquetesSesionesRouter.post(
  "/",
  ah<RequestConEmpresa>(async (req, res) => {
    const { cliente_id, nombre, cantidad_total, fecha_compra, notas, tipo_pack_id, precio_pagado } = req.body ?? {};

    if (typeof cliente_id !== "string" || !cliente_id || !(await clienteExiste(req.empresaId!, cliente_id))) {
      res.status(400).json({ error: "cliente_id inválido" });
      return;
    }
    if (precio_pagado !== null && precio_pagado !== undefined && (typeof precio_pagado !== "number" || precio_pagado < 0)) {
      res.status(400).json({ error: "precio_pagado inválido" });
      return;
    }

    const fechaCompraFinal = fecha_compra || new Date().toISOString().slice(0, 10);

    // Valores de la instancia: por defecto los que manda el cliente
    // (pack "personalizado" sin catálogo); si hay tipo_pack_id válido,
    // se pisan con el snapshot del catálogo.
    let tipoPackId: string | null = null;
    let servicioId: string | null = null;
    let venceEl: string | null = null;
    let nombreFinal = typeof nombre === "string" ? nombre.trim() : "";
    let cantidadFinal = cantidad_total;
    let precioSnapshot: number | null = null;

    if (typeof tipo_pack_id === "string" && tipo_pack_id) {
      const { data: tipo } = await supabase
        .from("tipos_pack")
        .select("id, nombre, cantidad_sesiones, precio, servicio_id, vigencia_dias")
        .eq("id", tipo_pack_id)
        .eq("empresa_id", req.empresaId!)
        .maybeSingle();
      if (!tipo) {
        res.status(400).json({ error: "tipo_pack_id inválido" });
        return;
      }
      tipoPackId = tipo.id;
      nombreFinal = tipo.nombre;
      cantidadFinal = tipo.cantidad_sesiones;
      precioSnapshot = tipo.precio;
      servicioId = tipo.servicio_id;
      if (tipo.vigencia_dias) {
        const vence = new Date(`${fechaCompraFinal}T00:00:00`);
        vence.setDate(vence.getDate() + tipo.vigencia_dias);
        venceEl = vence.toISOString().slice(0, 10);
      }
    }

    if (!nombreFinal) {
      res.status(400).json({ error: "Falta nombre" });
      return;
    }
    if (!Number.isInteger(cantidadFinal) || cantidadFinal <= 0) {
      res.status(400).json({ error: "cantidad_total debe ser un entero mayor a 0" });
      return;
    }

    const { data, error } = await supabase
      .from("paquetes_sesiones")
      .insert({
        empresa_id: req.empresaId!,
        cliente_id,
        tipo_pack_id: tipoPackId,
        servicio_id: servicioId,
        vence_el: venceEl,
        nombre: nombreFinal,
        cantidad_total: cantidadFinal,
        precio: precioSnapshot,
        precio_pagado: precio_pagado ?? null,
        fecha_compra: fechaCompraFinal,
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
