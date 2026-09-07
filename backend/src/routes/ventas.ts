// ============================================================
// BITÁCORA — Registrar venta con líneas mixtas (migración 95).
//
// Una venta nace SIEMPRE de una cita o de una OS (hereda cliente y
// servicio); no hay venta libre. Queda PAGADA al instante — no genera
// cobro pendiente en `facturas`. Efectos al confirmar:
//   - producto: descuenta stock de catalogo_items + inventario_movimientos
//               (bloquea si no hay suficiente)
//   - pack:     crea la fila en paquetes_sesiones (se cobra completo)
//   - servicio: nada extra
// El precio viene del catálogo y es de solo lectura salvo para perfiles
// con la acción `facturar`.
// ============================================================
import { Router } from "express";
import type { TipoLineaVenta, VentaLinea } from "@bitacora/shared";
import { supabase } from "../supabase";
import type { RequestConEmpresa } from "../empresa";
import { ah } from "../asyncHandler";
import { rolTieneAccion } from "../roles";

export const ventasRouter = Router();

const IVA_TASA = 0.19;
const MEDIOS = ["efectivo", "transferencia", "tarjeta"] as const;
const TIPOS: TipoLineaVenta[] = ["servicio", "producto", "pack"];

type LineaEntrada = { tipo: TipoLineaVenta; referencia_id: string; cantidad: number; precio_unitario?: number; heredada?: boolean };

function hoyISO(): string {
  return new Date().toISOString().slice(0, 10);
}

async function resolverClienteDeOrigen(
  empresaId: string,
  tipo: "cita" | "os",
  id: string
): Promise<{ clienteId: string } | { error: string }> {
  const tabla = tipo === "cita" ? "tareas" : "trabajos";
  const { data } = await supabase.from(tabla).select("id, cliente_id").eq("empresa_id", empresaId).eq("id", id).maybeSingle();
  if (!data) return { error: tipo === "cita" ? "La cita no existe" : "La OS no existe" };
  if (!data.cliente_id) return { error: "El origen no tiene un cliente asociado" };
  return { clienteId: data.cliente_id };
}

// GET /api/ventas?cliente_id=  — historial de ventas pagadas de un cliente.
ventasRouter.get(
  "/",
  ah<RequestConEmpresa>(async (req, res) => {
    const clienteId = typeof req.query.cliente_id === "string" ? req.query.cliente_id : null;
    let q = supabase.from("ventas").select("*, lineas:venta_lineas(*)").eq("empresa_id", req.empresaId!).order("pagada_en", { ascending: false });
    if (clienteId) q = q.eq("cliente_id", clienteId);
    const { data, error } = await q;
    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    res.json(data ?? []);
  })
);

// GET /api/ventas/origen/:tipo/:id — ¿ya hay venta para esta cita/OS?
ventasRouter.get(
  "/origen/:tipo/:id",
  ah<RequestConEmpresa>(async (req, res) => {
    const tipo = req.params.tipo === "cita" ? "cita" : req.params.tipo === "os" ? "os" : null;
    if (!tipo) {
      res.status(400).json({ error: "Tipo de origen inválido" });
      return;
    }
    const { data } = await supabase
      .from("ventas")
      .select("*, lineas:venta_lineas(*)")
      .eq("empresa_id", req.empresaId!)
      .eq("origen_tipo", tipo)
      .eq("origen_id", req.params.id)
      .order("pagada_en", { ascending: false });
    res.json(data ?? []);
  })
);

ventasRouter.post(
  "/",
  ah<RequestConEmpresa>(async (req, res) => {
    const empresaId = req.empresaId!;
    const body = req.body ?? {};
    const origenTipo = body.origen_tipo === "cita" ? "cita" : body.origen_tipo === "os" ? "os" : null;
    const origenId = typeof body.origen_id === "string" ? body.origen_id : null;
    const medioPago = MEDIOS.includes(body.medio_pago) ? (body.medio_pago as (typeof MEDIOS)[number]) : null;
    const lineasRaw: unknown = body.lineas;

    if (!origenTipo || !origenId) {
      res.status(400).json({ error: "La venta tiene que nacer de una cita o de una OS" });
      return;
    }
    if (!medioPago) {
      res.status(400).json({ error: "Elige un medio de pago" });
      return;
    }
    if (!Array.isArray(lineasRaw) || lineasRaw.length === 0) {
      res.status(400).json({ error: "Agrega al menos una línea a la venta" });
      return;
    }

    const origen = await resolverClienteDeOrigen(empresaId, origenTipo, origenId);
    if ("error" in origen) {
      res.status(400).json({ error: origen.error });
      return;
    }
    const clienteId = origen.clienteId;

    const puedeEditarPrecio = await rolTieneAccion(req.rol ?? "colaborador", "facturar");

    // --- Validar y resolver cada línea contra el catálogo ---
    const lineas: (LineaEntrada & { nombre: string; precioCatalogo: number; precioUnitario: number; subtotal: number; packSesiones?: number; packVigenciaDias?: number | null; packServicioId?: string | null; packPrecioLista?: number | null })[] = [];
    for (const raw of lineasRaw as LineaEntrada[]) {
      if (!TIPOS.includes(raw?.tipo) || typeof raw?.referencia_id !== "string") {
        res.status(400).json({ error: "Línea inválida" });
        return;
      }
      const cantidad = raw.tipo === "pack" ? 1 : Number(raw.cantidad);
      if (!Number.isFinite(cantidad) || cantidad <= 0) {
        res.status(400).json({ error: "Cantidad inválida" });
        return;
      }

      if (raw.tipo === "servicio") {
        const { data } = await supabase.from("servicios").select("nombre, precio").eq("empresa_id", empresaId).eq("id", raw.referencia_id).maybeSingle();
        if (!data) {
          res.status(400).json({ error: "Servicio no encontrado en el catálogo" });
          return;
        }
        const precioCatalogo = Number(data.precio) || 0;
        const precioUnitario = puedeEditarPrecio && Number.isFinite(Number(raw.precio_unitario)) && Number(raw.precio_unitario) >= 0 ? Number(raw.precio_unitario) : precioCatalogo;
        lineas.push({ ...raw, cantidad, nombre: data.nombre, precioCatalogo, precioUnitario, subtotal: Math.round(precioUnitario * cantidad) });
      } else if (raw.tipo === "producto") {
        const { data } = await supabase
          .from("catalogo_items")
          .select("nombre, precio_base, stock_actual, tipo")
          .eq("empresa_id", empresaId)
          .eq("id", raw.referencia_id)
          .maybeSingle();
        if (!data || data.tipo !== "producto") {
          res.status(400).json({ error: "Producto no encontrado en el inventario" });
          return;
        }
        const precioCatalogo = Number(data.precio_base) || 0;
        const precioUnitario = puedeEditarPrecio && Number.isFinite(Number(raw.precio_unitario)) && Number(raw.precio_unitario) >= 0 ? Number(raw.precio_unitario) : precioCatalogo;
        lineas.push({ ...raw, cantidad, nombre: data.nombre, precioCatalogo, precioUnitario, subtotal: Math.round(precioUnitario * cantidad) });
      } else {
        const { data } = await supabase
          .from("tipos_pack")
          .select("nombre, precio, cantidad_sesiones, vigencia_dias, servicio_id")
          .eq("empresa_id", empresaId)
          .eq("id", raw.referencia_id)
          .maybeSingle();
        if (!data) {
          res.status(400).json({ error: "Pack no encontrado en el catálogo" });
          return;
        }
        const precioCatalogo = Number(data.precio) || 0;
        const precioUnitario = puedeEditarPrecio && Number.isFinite(Number(raw.precio_unitario)) && Number(raw.precio_unitario) >= 0 ? Number(raw.precio_unitario) : precioCatalogo;
        lineas.push({
          ...raw,
          cantidad: 1,
          nombre: data.nombre,
          precioCatalogo,
          precioUnitario,
          subtotal: Math.round(precioUnitario),
          packSesiones: data.cantidad_sesiones,
          packVigenciaDias: data.vigencia_dias,
          packServicioId: data.servicio_id,
          packPrecioLista: data.precio,
        });
      }
    }

    // --- Chequeo de stock ANTES de escribir nada (se bloquea) ---
    const necesidadPorProducto = new Map<string, number>();
    for (const l of lineas) if (l.tipo === "producto") necesidadPorProducto.set(l.referencia_id, (necesidadPorProducto.get(l.referencia_id) ?? 0) + l.cantidad);
    if (necesidadPorProducto.size > 0) {
      const { data: productos } = await supabase
        .from("catalogo_items")
        .select("id, nombre, stock_actual")
        .eq("empresa_id", empresaId)
        .in("id", [...necesidadPorProducto.keys()]);
      for (const p of productos ?? []) {
        const necesita = necesidadPorProducto.get(p.id)!;
        if ((Number(p.stock_actual) || 0) < necesita) {
          res.status(422).json({ error: `Stock insuficiente de "${p.nombre}": hay ${Number(p.stock_actual) || 0}, se necesitan ${necesita}.` });
          return;
        }
      }
    }

    const neto = lineas.reduce((s, l) => s + l.subtotal, 0);
    const iva = Math.round(neto * IVA_TASA);
    const total = neto + iva;

    // --- Escrituras ---
    const { data: venta, error: eVenta } = await supabase
      .from("ventas")
      .insert({
        empresa_id: empresaId,
        cliente_id: clienteId,
        origen_tipo: origenTipo,
        origen_id: origenId,
        neto,
        iva,
        total,
        medio_pago: medioPago,
        estado: "pagada",
        pagada_en: new Date().toISOString(),
        registrada_por: req.userId ?? null,
      })
      .select()
      .single();
    if (eVenta || !venta) {
      res.status(500).json({ error: eVenta?.message ?? "No se pudo registrar la venta" });
      return;
    }

    const lineasInsert: Partial<VentaLinea>[] = [];
    for (const l of lineas) {
      let paqueteSesionesId: string | null = null;
      if (l.tipo === "pack") {
        const { data: paquete } = await supabase
          .from("paquetes_sesiones")
          .insert({
            empresa_id: empresaId,
            cliente_id: clienteId,
            tipo_pack_id: l.referencia_id,
            nombre: l.nombre,
            cantidad_total: l.packSesiones ?? 0,
            precio: l.packPrecioLista ?? null,
            precio_pagado: l.subtotal,
            servicio_id: l.packServicioId ?? null,
            fecha_compra: hoyISO(),
            vence_el: l.packVigenciaDias != null ? new Date(Date.now() + l.packVigenciaDias * 86400000).toISOString().slice(0, 10) : null,
            notas: `Vendido en venta ${venta.id.slice(0, 8)}`,
          })
          .select("id")
          .single();
        paqueteSesionesId = paquete?.id ?? null;
      }
      lineasInsert.push({
        empresa_id: empresaId,
        venta_id: venta.id,
        tipo: l.tipo,
        referencia_id: l.referencia_id,
        nombre: l.nombre,
        cantidad: l.cantidad,
        precio_unitario: l.precioUnitario,
        subtotal: l.subtotal,
        heredada: Boolean(l.heredada),
        paquete_sesiones_id: paqueteSesionesId,
      });
    }
    await supabase.from("venta_lineas").insert(lineasInsert);

    // Descuento de stock de los productos.
    for (const [productoId, cantidad] of necesidadPorProducto) {
      const { data: p } = await supabase.from("catalogo_items").select("stock_actual, nombre").eq("empresa_id", empresaId).eq("id", productoId).maybeSingle();
      const stockResultante = (Number(p?.stock_actual) || 0) - cantidad;
      await supabase.from("catalogo_items").update({ stock_actual: stockResultante }).eq("empresa_id", empresaId).eq("id", productoId);
      await supabase.from("inventario_movimientos").insert({
        empresa_id: empresaId,
        catalogo_item_id: productoId,
        tipo: "salida",
        cantidad,
        stock_resultante: stockResultante,
        motivo: `Venta ${venta.id.slice(0, 8)} — ${p?.nombre ?? ""}`.trim(),
        origen: "automatico",
      });
    }

    const { data: completa } = await supabase.from("ventas").select("*, lineas:venta_lineas(*)").eq("id", venta.id).single();
    res.status(201).json(completa ?? venta);
  })
);
