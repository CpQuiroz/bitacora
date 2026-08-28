import { Router } from "express";
import type { TipoMovimientoInventario } from "@bitacora/shared";
import { supabase } from "../supabase";
import type { RequestConEmpresa } from "../empresa";
import { ah } from "../asyncHandler";

export const inventarioRouter = Router();

const TIPOS_MOVIMIENTO: TipoMovimientoInventario[] = ["entrada", "salida", "ajuste"];

async function empresaTieneInventarioActivado(empresaId: string) {
  const { data } = await supabase.from("empresas").select("inventario_activado").eq("id", empresaId).maybeSingle();
  return data?.inventario_activado ?? false;
}

// Productos del catálogo + últimos movimientos, para la vista de
// stock. Solo tiene sentido cuando el toggle de Configuración está
// activado, pero devolver los datos igual acá no hace daño — es el
// frontend el que oculta la pantalla completa si está desactivado.
inventarioRouter.get(
  "/",
  ah<RequestConEmpresa>(async (req, res) => {
    const [{ data: productos, error }, { data: movimientos }] = await Promise.all([
      supabase
        .from("catalogo_items")
        .select("*")
        .eq("empresa_id", req.empresaId!)
        .eq("tipo", "producto")
        .order("nombre"),
      supabase
        .from("inventario_movimientos")
        .select("*")
        .eq("empresa_id", req.empresaId!)
        .order("creado_en", { ascending: false })
        .limit(30),
    ]);

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    const nombrePorItem = new Map((productos ?? []).map((p) => [p.id, p.nombre]));
    res.json({
      productos: productos ?? [],
      movimientos: (movimientos ?? []).map((m) => ({ ...m, item_nombre: nombrePorItem.get(m.catalogo_item_id) ?? null })),
    });
  })
);

inventarioRouter.post(
  "/movimientos",
  ah<RequestConEmpresa>(async (req, res) => {
    if (!(await empresaTieneInventarioActivado(req.empresaId!))) {
      res.status(403).json({ error: "El control de inventario está desactivado en Configuración" });
      return;
    }

    const { catalogo_item_id, tipo, cantidad, motivo } = req.body ?? {};

    if (typeof catalogo_item_id !== "string" || !catalogo_item_id.trim()) {
      res.status(400).json({ error: "Falta catalogo_item_id" });
      return;
    }
    if (typeof tipo !== "string" || !TIPOS_MOVIMIENTO.includes(tipo as TipoMovimientoInventario)) {
      res.status(400).json({ error: `tipo debe ser uno de: ${TIPOS_MOVIMIENTO.join(", ")}` });
      return;
    }
    const cantidadNum = Number(cantidad);
    if (!Number.isFinite(cantidadNum) || cantidadNum <= 0) {
      res.status(400).json({ error: "cantidad debe ser un número mayor a 0" });
      return;
    }

    const { data: item } = await supabase
      .from("catalogo_items")
      .select("id, stock_actual")
      .eq("empresa_id", req.empresaId!)
      .eq("id", catalogo_item_id)
      .eq("tipo", "producto")
      .maybeSingle();
    if (!item) {
      res.status(404).json({ error: "Producto no encontrado" });
      return;
    }

    const stockActual = item.stock_actual ?? 0;
    let stockResultante: number;
    if (tipo === "entrada") stockResultante = stockActual + cantidadNum;
    else if (tipo === "salida") stockResultante = stockActual - cantidadNum;
    else stockResultante = cantidadNum; // ajuste: fija el stock al valor indicado

    if (stockResultante < 0) {
      res.status(400).json({ error: "El stock no puede quedar negativo" });
      return;
    }

    const { error: errorUpdate } = await supabase
      .from("catalogo_items")
      .update({ stock_actual: stockResultante })
      .eq("empresa_id", req.empresaId!)
      .eq("id", catalogo_item_id);
    if (errorUpdate) {
      res.status(500).json({ error: errorUpdate.message });
      return;
    }

    const { data: movimiento, error } = await supabase
      .from("inventario_movimientos")
      .insert({
        empresa_id: req.empresaId!,
        catalogo_item_id,
        tipo: tipo as TipoMovimientoInventario,
        cantidad: cantidadNum,
        stock_resultante: stockResultante,
        motivo: motivo?.trim() || null,
      })
      .select()
      .single();

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    res.status(201).json(movimiento);
  })
);
