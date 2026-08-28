import { Router } from "express";
import type { EstadoPresupuesto, Presupuesto } from "@bitacora/shared";
import { supabase } from "../supabase";
import { crearOrdenServicio } from "../ordenes";
import type { RequestConEmpresa } from "../empresa";
import { ah } from "../asyncHandler";

export const cotizacionesRouter = Router();

const ESTADOS: EstadoPresupuesto[] = ["borrador", "enviado", "aprobado", "rechazado", "expirado"];
const IVA_TASA = 0.19;

type ItemEntrada = { catalogo_item_id?: string | null; descripcion: string; cantidad: number; precio_unitario: number };

function calcularTotales(items: ItemEntrada[]) {
  const subtotal = items.reduce((acc, it) => acc + it.cantidad * it.precio_unitario, 0);
  const iva = Math.round(subtotal * IVA_TASA);
  return { subtotal: Math.round(subtotal), iva, total: Math.round(subtotal) + iva };
}

function parsearItems(raw: unknown): ItemEntrada[] | null {
  if (!Array.isArray(raw)) return null;
  const items: ItemEntrada[] = [];
  for (const it of raw) {
    const descripcion = String(it?.descripcion ?? "").trim();
    const cantidad = Number(it?.cantidad);
    const precioUnitario = Number(it?.precio_unitario);
    if (!descripcion || !Number.isFinite(cantidad) || cantidad <= 0 || !Number.isFinite(precioUnitario) || precioUnitario < 0) {
      return null;
    }
    items.push({ catalogo_item_id: it?.catalogo_item_id || null, descripcion, cantidad, precio_unitario: precioUnitario });
  }
  return items;
}

async function guardarItems(empresaId: string, presupuestoId: string, items: ItemEntrada[]) {
  await supabase.from("presupuesto_items").delete().eq("empresa_id", empresaId).eq("presupuesto_id", presupuestoId);
  if (items.length === 0) return;
  await supabase.from("presupuesto_items").insert(
    items.map((it) => ({
      empresa_id: empresaId,
      presupuesto_id: presupuestoId,
      catalogo_item_id: it.catalogo_item_id || null,
      descripcion: it.descripcion,
      cantidad: it.cantidad,
      precio_unitario: it.precio_unitario,
    }))
  );
}

cotizacionesRouter.get(
  "/",
  ah<RequestConEmpresa>(async (req, res) => {
    const { data, error } = await supabase
      .from("presupuestos")
      .select("*, cliente_info:clientes(nombre)")
      .eq("empresa_id", req.empresaId!)
      .order("numero", { ascending: false });

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    res.json(data ?? []);
  })
);

cotizacionesRouter.get(
  "/:id",
  ah<RequestConEmpresa>(async (req, res) => {
    const { data: cotizacion, error } = await supabase
      .from("presupuestos")
      .select("*, cliente_info:clientes(id, nombre, correo, telefono, direccion)")
      .eq("empresa_id", req.empresaId!)
      .eq("id", req.params.id)
      .maybeSingle();

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    if (!cotizacion) {
      res.status(404).json({ error: "Cotización no encontrada" });
      return;
    }

    const { data: items } = await supabase
      .from("presupuesto_items")
      .select("*")
      .eq("empresa_id", req.empresaId!)
      .eq("presupuesto_id", req.params.id)
      .order("creado_en");

    res.json({ ...cotizacion, items: items ?? [] });
  })
);

cotizacionesRouter.post(
  "/",
  ah<RequestConEmpresa>(async (req, res) => {
    const { cliente_id, descripcion, fecha_vencimiento, estado, items: itemsRaw } = req.body ?? {};

    if (typeof cliente_id !== "string" || !cliente_id.trim()) {
      res.status(400).json({ error: "Selecciona un cliente" });
      return;
    }
    const { data: cliente } = await supabase
      .from("clientes")
      .select("id")
      .eq("empresa_id", req.empresaId!)
      .eq("id", cliente_id)
      .maybeSingle();
    if (!cliente) {
      res.status(400).json({ error: "El cliente indicado no existe" });
      return;
    }

    const items = parsearItems(itemsRaw ?? []);
    if (!items) {
      res.status(400).json({ error: "Ítems inválidos — cada uno necesita descripción, cantidad y precio válidos" });
      return;
    }
    const estadoFinal: EstadoPresupuesto = ESTADOS.includes(estado) ? estado : "borrador";
    const { subtotal, iva, total } = calcularTotales(items);

    const { data: numero, error: errorNumero } = await supabase.rpc("siguiente_numero_cotizacion", {
      p_empresa_id: req.empresaId!,
    });
    if (errorNumero) {
      res.status(500).json({ error: errorNumero.message });
      return;
    }

    const { data, error } = await supabase
      .from("presupuestos")
      .insert({
        empresa_id: req.empresaId!,
        cliente_id,
        descripcion: descripcion?.trim() || null,
        monto: total,
        subtotal,
        iva,
        fecha: new Date().toISOString().slice(0, 10),
        fecha_vencimiento: fecha_vencimiento || null,
        estado: estadoFinal,
        numero,
      })
      .select("*, cliente_info:clientes(nombre)")
      .single();

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    await guardarItems(req.empresaId!, data.id, items);
    res.status(201).json({ ...data, items });
  })
);

cotizacionesRouter.patch(
  "/:id",
  ah<RequestConEmpresa>(async (req, res) => {
    const { descripcion, fecha_vencimiento, estado, items: itemsRaw } = req.body ?? {};
    const cambios: Partial<Presupuesto> = {};

    if (descripcion !== undefined) cambios.descripcion = descripcion?.trim() || null;
    if (fecha_vencimiento !== undefined) cambios.fecha_vencimiento = fecha_vencimiento || null;
    if (estado !== undefined) {
      if (!ESTADOS.includes(estado)) {
        res.status(400).json({ error: `estado debe ser uno de: ${ESTADOS.join(", ")}` });
        return;
      }
      cambios.estado = estado;
    }

    let items: ItemEntrada[] | null = null;
    if (itemsRaw !== undefined) {
      items = parsearItems(itemsRaw);
      if (!items) {
        res.status(400).json({ error: "Ítems inválidos — cada uno necesita descripción, cantidad y precio válidos" });
        return;
      }
      const { subtotal, iva, total } = calcularTotales(items);
      cambios.subtotal = subtotal;
      cambios.iva = iva;
      cambios.monto = total;
    }

    if (Object.keys(cambios).length === 0) {
      res.status(400).json({ error: "Nada que actualizar" });
      return;
    }

    const { data, error } = await supabase
      .from("presupuestos")
      .update(cambios)
      .eq("empresa_id", req.empresaId!)
      .eq("id", req.params.id)
      .select("*, cliente_info:clientes(nombre)")
      .maybeSingle();

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    if (!data) {
      res.status(404).json({ error: "Cotización no encontrada" });
      return;
    }

    if (items) await guardarItems(req.empresaId!, data.id, items);
    res.json(data);
  })
);

// Convierte una cotización aprobada en un trabajo + orden de servicio
// real, arrastrando sus ítems como os_items (mismo formato que ya usa
// el flujo manual de creación de OS) — así el Catálogo termina siendo
// la fuente real de precios de una OS, sin duplicar esa lógica acá.
cotizacionesRouter.post(
  "/:id/convertir-a-os",
  ah<RequestConEmpresa>(async (req, res) => {
    const { data: cotizacion, error } = await supabase
      .from("presupuestos")
      .select("*, cliente_info:clientes(nombre)")
      .eq("empresa_id", req.empresaId!)
      .eq("id", req.params.id)
      .maybeSingle();

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    if (!cotizacion) {
      res.status(404).json({ error: "Cotización no encontrada" });
      return;
    }
    if (cotizacion.estado !== "aprobado") {
      res.status(400).json({ error: "Solo una cotización aprobada puede convertirse en OS" });
      return;
    }
    if (cotizacion.trabajo_id) {
      res.status(400).json({ error: "Esta cotización ya fue convertida en una OS" });
      return;
    }

    const clienteNombre = (cotizacion as { cliente_info?: { nombre?: string } }).cliente_info?.nombre ?? "Cliente";

    const { data: trabajo, error: errorTrabajo } = await supabase
      .from("trabajos")
      .insert({
        empresa_id: req.empresaId!,
        cliente: clienteNombre,
        cliente_id: cotizacion.cliente_id,
        fecha: new Date().toISOString().slice(0, 10),
        monto: cotizacion.monto,
        estado: "en_curso",
        descripcion: cotizacion.descripcion,
        prioridad: "media",
        responsable_id: req.userId!,
      })
      .select()
      .single();

    if (errorTrabajo) {
      res.status(500).json({ error: errorTrabajo.message });
      return;
    }

    const { data: items } = await supabase
      .from("presupuesto_items")
      .select("*")
      .eq("empresa_id", req.empresaId!)
      .eq("presupuesto_id", req.params.id);

    if (items && items.length > 0) {
      await supabase.from("os_items").insert(
        items.map((it) => ({
          empresa_id: req.empresaId!,
          trabajo_id: trabajo.id,
          descripcion: it.descripcion,
          cantidad: it.cantidad,
          precio_unitario: it.precio_unitario,
        }))
      );
    }

    const orden = await crearOrdenServicio(req.empresaId!, trabajo.id);

    await supabase
      .from("presupuestos")
      .update({ trabajo_id: trabajo.id })
      .eq("empresa_id", req.empresaId!)
      .eq("id", req.params.id);

    res.status(201).json({ trabajo_id: trabajo.id, folio: orden.folio });
  })
);
