import { Router } from "express";
import type { CatalogoItem, TipoCatalogoItem } from "@bitacora/shared";
import { supabase } from "../supabase";
import type { RequestConEmpresa } from "../empresa";
import { ah } from "../asyncHandler";

export const catalogoRouter = Router();

const TIPOS: TipoCatalogoItem[] = ["producto", "servicio", "kit"];

type ItemKit = { item_id: string; cantidad: number };

// Bloque D — etiquetado de un ítem con los tipos de equipo a los que
// aplica (ej. "Cambio de aceite" -> Camión, Camioneta). Reemplaza por
// completo (borra e inserta) — mismo criterio que guardarKitItems.
async function cargarTiposEquipo(empresaId: string, itemIds: string[]) {
  if (itemIds.length === 0) return new Map<string, string[]>();
  const { data } = await supabase
    .from("catalogo_item_tipos_equipo")
    .select("catalogo_item_id, tipo_equipo")
    .eq("empresa_id", empresaId)
    .in("catalogo_item_id", itemIds);
  const porItem = new Map<string, string[]>();
  for (const fila of data ?? []) {
    const lista = porItem.get(fila.catalogo_item_id) ?? [];
    lista.push(fila.tipo_equipo);
    porItem.set(fila.catalogo_item_id, lista);
  }
  return porItem;
}

async function guardarTiposEquipo(empresaId: string, itemId: string, tipos: string[]) {
  await supabase.from("catalogo_item_tipos_equipo").delete().eq("empresa_id", empresaId).eq("catalogo_item_id", itemId);
  const limpios = [...new Set(tipos.map((t) => String(t).trim()).filter(Boolean))];
  if (limpios.length === 0) return;
  await supabase.from("catalogo_item_tipos_equipo").insert(limpios.map((tipo_equipo) => ({ empresa_id: empresaId, catalogo_item_id: itemId, tipo_equipo })));
}

async function cargarKitItems(empresaId: string, kitIds: string[]) {
  if (kitIds.length === 0) return new Map<string, (ItemKit & { nombre: string })[]>();
  const { data } = await supabase
    .from("catalogo_kit_items")
    .select("kit_id, item_id, cantidad, item:catalogo_items!item_id(nombre)")
    .eq("empresa_id", empresaId)
    .in("kit_id", kitIds);

  const porKit = new Map<string, (ItemKit & { nombre: string })[]>();
  for (const fila of data ?? []) {
    const item = Array.isArray(fila.item) ? fila.item[0] ?? null : fila.item;
    const lista = porKit.get(fila.kit_id) ?? [];
    lista.push({ item_id: fila.item_id, cantidad: fila.cantidad, nombre: item?.nombre ?? "" });
    porKit.set(fila.kit_id, lista);
  }
  return porKit;
}

// Reemplaza por completo los ítems de un kit (borra y vuelve a
// insertar) — más simple que calcular un diff, y el volumen esperado
// (unos pocos ítems por kit) hace que el costo sea irrelevante.
async function guardarKitItems(empresaId: string, kitId: string, items: ItemKit[]) {
  await supabase.from("catalogo_kit_items").delete().eq("empresa_id", empresaId).eq("kit_id", kitId);
  if (items.length === 0) return null;

  const idsValidos = await supabase
    .from("catalogo_items")
    .select("id")
    .eq("empresa_id", empresaId)
    .neq("tipo", "kit")
    .in("id", items.map((i) => i.item_id));
  const validos = new Set((idsValidos.data ?? []).map((r) => r.id));
  const invalido = items.find((i) => !validos.has(i.item_id));
  if (invalido) return `Ítem de kit inválido: ${invalido.item_id}`;

  const { error } = await supabase.from("catalogo_kit_items").insert(
    items.map((i) => ({ empresa_id: empresaId, kit_id: kitId, item_id: i.item_id, cantidad: i.cantidad || 1 }))
  );
  return error?.message ?? null;
}

catalogoRouter.get(
  "/",
  ah<RequestConEmpresa>(async (req, res) => {
    const { tipo } = req.query;
    let query = supabase.from("catalogo_items").select("*").eq("empresa_id", req.empresaId!).order("nombre");
    if (typeof tipo === "string" && TIPOS.includes(tipo as TipoCatalogoItem)) {
      query = query.eq("tipo", tipo as TipoCatalogoItem);
    }
    const { data, error } = await query;
    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    const kitIds = (data ?? []).filter((i) => i.tipo === "kit").map((i) => i.id);
    const kitItems = await cargarKitItems(req.empresaId!, kitIds);
    const tiposEquipoPorItem = await cargarTiposEquipo(req.empresaId!, (data ?? []).map((i) => i.id));
    res.json(
      (data ?? []).map((i) => ({
        ...i,
        items: i.tipo === "kit" ? kitItems.get(i.id) ?? [] : undefined,
        tipos_equipo: tiposEquipoPorItem.get(i.id) ?? [],
      }))
    );
  })
);

catalogoRouter.post(
  "/",
  ah<RequestConEmpresa>(async (req, res) => {
    const { tipo, nombre, sku, categoria, unidad, precio_base, items, tipos_equipo, stock_inicial } = req.body ?? {};

    if (typeof tipo !== "string" || !TIPOS.includes(tipo as TipoCatalogoItem)) {
      res.status(400).json({ error: `tipo debe ser uno de: ${TIPOS.join(", ")}` });
      return;
    }
    if (typeof nombre !== "string" || !nombre.trim()) {
      res.status(400).json({ error: "Falta nombre" });
      return;
    }
    const precio = Number(precio_base);
    if (!Number.isFinite(precio) || precio < 0) {
      res.status(400).json({ error: "precio_base inválido" });
      return;
    }

    // Stock inicial: solo aplica a productos (servicios y kits no tienen
    // stock propio). Opcional, default 0.
    const stockInicial = tipo === "producto" ? Number(stock_inicial) || 0 : 0;
    if (stockInicial < 0) {
      res.status(400).json({ error: "El stock inicial no puede ser negativo" });
      return;
    }

    const { data, error } = await supabase
      .from("catalogo_items")
      .insert({
        empresa_id: req.empresaId!,
        tipo: tipo as TipoCatalogoItem,
        nombre: nombre.trim(),
        sku: sku?.trim() || null,
        categoria: categoria?.trim() || null,
        unidad: unidad?.trim() || "unidad",
        precio_base: precio,
        stock_actual: tipo === "producto" ? stockInicial : null,
        // null = "sin definir", distinto de "definido en 0" — cae al
        // umbral por defecto de la empresa (Configuración > Inventario).
        stock_minimo: null,
      })
      .select()
      .single();

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    // Deja el movimiento de "entrada" que explica de dónde salió ese
    // stock — mismo patrón que el ajuste manual (routes/inventario.ts) y
    // que el descuento automático por OS (inventario.ts): stock_actual +
    // inventario_movimientos siempre van juntos. No bloquea la respuesta.
    if (stockInicial > 0) {
      const { error: errorMov } = await supabase.from("inventario_movimientos").insert({
        empresa_id: req.empresaId!,
        catalogo_item_id: data.id,
        tipo: "entrada",
        cantidad: stockInicial,
        stock_resultante: stockInicial,
        motivo: "Stock inicial",
        origen: "manual",
      });
      if (errorMov) console.error("Error registrando el movimiento de stock inicial:", errorMov);
    }

    if (tipo === "kit" && Array.isArray(items) && items.length > 0) {
      const err = await guardarKitItems(req.empresaId!, data.id, items);
      if (err) {
        res.status(400).json({ error: err });
        return;
      }
    }
    if (Array.isArray(tipos_equipo)) {
      await guardarTiposEquipo(req.empresaId!, data.id, tipos_equipo);
    }

    res.status(201).json({ ...data, tipos_equipo: Array.isArray(tipos_equipo) ? tipos_equipo : [] });
  })
);

catalogoRouter.patch(
  "/:id",
  ah<RequestConEmpresa>(async (req, res) => {
    const { nombre, sku, categoria, unidad, precio_base, activo, items, tipos_equipo } = req.body ?? {};
    const cambios: Partial<CatalogoItem> = {};

    if (nombre !== undefined) {
      if (typeof nombre !== "string" || !nombre.trim()) {
        res.status(400).json({ error: "Falta nombre" });
        return;
      }
      cambios.nombre = nombre.trim();
    }
    if (sku !== undefined) cambios.sku = sku?.trim() || null;
    if (categoria !== undefined) cambios.categoria = categoria?.trim() || null;
    if (unidad !== undefined) cambios.unidad = unidad?.trim() || "unidad";
    if (precio_base !== undefined) {
      const precio = Number(precio_base);
      if (!Number.isFinite(precio) || precio < 0) {
        res.status(400).json({ error: "precio_base inválido" });
        return;
      }
      cambios.precio_base = precio;
    }
    if (activo !== undefined) cambios.activo = Boolean(activo);

    if (Object.keys(cambios).length === 0 && items === undefined && tipos_equipo === undefined) {
      res.status(400).json({ error: "Nada que actualizar" });
      return;
    }

    let data: CatalogoItem | null = null;
    if (Object.keys(cambios).length > 0) {
      const resultado = await supabase
        .from("catalogo_items")
        .update(cambios)
        .eq("empresa_id", req.empresaId!)
        .eq("id", req.params.id)
        .select()
        .maybeSingle();
      if (resultado.error) {
        res.status(500).json({ error: resultado.error.message });
        return;
      }
      data = resultado.data;
    } else {
      const resultado = await supabase
        .from("catalogo_items")
        .select()
        .eq("empresa_id", req.empresaId!)
        .eq("id", req.params.id)
        .maybeSingle();
      data = resultado.data;
    }

    if (!data) {
      res.status(404).json({ error: "Ítem no encontrado" });
      return;
    }

    if (data.tipo === "kit" && Array.isArray(items)) {
      const err = await guardarKitItems(req.empresaId!, data.id, items);
      if (err) {
        res.status(400).json({ error: err });
        return;
      }
    }
    if (Array.isArray(tipos_equipo)) {
      await guardarTiposEquipo(req.empresaId!, data.id, tipos_equipo);
    }

    const tiposEquipoActuales = Array.isArray(tipos_equipo)
      ? tipos_equipo
      : [...(await cargarTiposEquipo(req.empresaId!, [data.id])).get(data.id) ?? []];
    res.json({ ...data, tipos_equipo: tiposEquipoActuales });
  })
);
