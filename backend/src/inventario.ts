// ============================================================
// BITÁCORA — Descuento automático de inventario al firmar una OS
// (Bloque B). Antes de esto NO existía ninguna lógica automática: el
// único punto de escritura de inventario_movimientos era el endpoint
// manual de Configuración > Inventario (backend/src/routes/inventario.ts),
// que además bloquea stock negativo — esta lógica es deliberadamente
// independiente de ese endpoint porque acá el stock SÍ puede quedar
// negativo (ver TODO abajo).
// ============================================================
import type { CatalogoItem } from "@bitacora/shared";
import { supabase } from "./supabase";

async function empresaTieneInventarioActivado(empresaId: string): Promise<boolean> {
  const { data } = await supabase.from("empresas").select("inventario_activado").eq("id", empresaId).maybeSingle();
  return data?.inventario_activado ?? false;
}

// Ítems de una OS ya expandidos a "cuántas unidades de qué producto
// hay que descontar", resolviendo kits a sus componentes. Un kit NO
// descuenta como unidad abstracta (Bloque B punto 4) — cada producto
// componente descuenta cantidad_en_kit * cantidad_de_kits_vendidos.
async function productosADescontar(empresaId: string, trabajoId: string): Promise<Map<string, number>> {
  const { data: osItems } = await supabase
    .from("os_items")
    .select("catalogo_item_id, cantidad")
    .eq("empresa_id", empresaId)
    .eq("trabajo_id", trabajoId)
    .not("catalogo_item_id", "is", null);

  const cantidadPorProducto = new Map<string, number>();
  if (!osItems || osItems.length === 0) return cantidadPorProducto;

  const catalogoIds = osItems.map((it) => it.catalogo_item_id!);
  const { data: catalogoItems } = await supabase.from("catalogo_items").select("id, tipo").in("id", catalogoIds);
  const tipoPorItem = new Map((catalogoItems ?? []).map((c) => [c.id, c.tipo as CatalogoItem["tipo"]]));

  const kitIds = osItems.filter((it) => tipoPorItem.get(it.catalogo_item_id!) === "kit").map((it) => it.catalogo_item_id!);
  const componentesPorKit = new Map<string, { item_id: string; cantidad: number; tipo: CatalogoItem["tipo"] }[]>();
  if (kitIds.length > 0) {
    const { data: kitItems } = await supabase
      .from("catalogo_kit_items")
      .select("kit_id, item_id, cantidad, item:catalogo_items!item_id(tipo)")
      .eq("empresa_id", empresaId)
      .in("kit_id", kitIds);
    for (const fila of kitItems ?? []) {
      const item = Array.isArray(fila.item) ? (fila.item[0] ?? null) : fila.item;
      const lista = componentesPorKit.get(fila.kit_id) ?? [];
      lista.push({ item_id: fila.item_id, cantidad: fila.cantidad, tipo: item?.tipo ?? "servicio" });
      componentesPorKit.set(fila.kit_id, lista);
    }
  }

  function sumar(catalogoItemId: string, cantidad: number) {
    cantidadPorProducto.set(catalogoItemId, (cantidadPorProducto.get(catalogoItemId) ?? 0) + cantidad);
  }

  for (const it of osItems) {
    const catalogoItemId = it.catalogo_item_id!;
    const tipo = tipoPorItem.get(catalogoItemId);
    if (tipo === "producto") {
      sumar(catalogoItemId, it.cantidad);
    } else if (tipo === "kit") {
      for (const componente of componentesPorKit.get(catalogoItemId) ?? []) {
        if (componente.tipo === "producto") sumar(componente.item_id, componente.cantidad * it.cantidad);
      }
    }
    // tipo === "servicio" (o catalogo_item_id ya borrado): no descuenta.
  }

  return cantidadPorProducto;
}

// Se llama al firmar una OS (estado_os -> "firmada"). Devuelve las
// advertencias de stock insuficiente para mostrar en el frontend — NO
// bloquea la operación (Bloque B punto 6): el stock puede quedar
// negativo. TODO: decisión pendiente — si en el futuro se quiere
// bloquear el cierre de una OS por falta de stock, es acá donde iría
// ese chequeo (hoy no existe ninguna opción de bloqueo).
export async function descontarStockPorOS(empresaId: string, ordenId: string, trabajoId: string, folio: number | null): Promise<string[]> {
  if (!(await empresaTieneInventarioActivado(empresaId))) return [];

  const cantidadPorProducto = await productosADescontar(empresaId, trabajoId);
  if (cantidadPorProducto.size === 0) return [];

  const ids = [...cantidadPorProducto.keys()];
  const { data: productos } = await supabase.from("catalogo_items").select("id, nombre, stock_actual").eq("empresa_id", empresaId).in("id", ids);

  const advertencias: string[] = [];
  const motivo = `OS N° ${folio ?? trabajoId.slice(0, 8)} — descuento automático al firmar`;
  for (const producto of productos ?? []) {
    const cantidad = cantidadPorProducto.get(producto.id)!;
    const stockActual = producto.stock_actual ?? 0;
    const stockResultante = stockActual - cantidad;
    if (stockResultante < 0) {
      advertencias.push(`Stock insuficiente de "${producto.nombre}": quedó en ${stockResultante} (se permitió negativo).`);
    }
    await supabase.from("catalogo_items").update({ stock_actual: stockResultante }).eq("empresa_id", empresaId).eq("id", producto.id);
    await supabase.from("inventario_movimientos").insert({
      empresa_id: empresaId,
      catalogo_item_id: producto.id,
      tipo: "salida",
      cantidad,
      stock_resultante: stockResultante,
      motivo,
    });
  }

  await supabase.from("ordenes_servicio").update({ stock_descontado: true }).eq("id", ordenId);
  return advertencias;
}

// Se llama cuando una OS que ya había descontado stock se cancela
// (trabajos.estado -> "cancelado"). Recalcula los mismos productos que
// descontarStockPorOS() — es seguro porque los ítems de una OS quedan
// bloqueados (no editables) apenas hay firma, así que no pueden haber
// cambiado entre el descuento y la reversión.
export async function revertirStockPorOS(empresaId: string, ordenId: string, trabajoId: string, folio: number | null): Promise<void> {
  const cantidadPorProducto = await productosADescontar(empresaId, trabajoId);
  if (cantidadPorProducto.size === 0) {
    await supabase.from("ordenes_servicio").update({ stock_descontado: false }).eq("id", ordenId);
    return;
  }

  const ids = [...cantidadPorProducto.keys()];
  const { data: productos } = await supabase.from("catalogo_items").select("id, stock_actual").eq("empresa_id", empresaId).in("id", ids);

  const motivo = `OS N° ${folio ?? trabajoId.slice(0, 8)} — reversión por cancelación`;
  for (const producto of productos ?? []) {
    const cantidad = cantidadPorProducto.get(producto.id)!;
    const stockResultante = (producto.stock_actual ?? 0) + cantidad;
    await supabase.from("catalogo_items").update({ stock_actual: stockResultante }).eq("empresa_id", empresaId).eq("id", producto.id);
    await supabase.from("inventario_movimientos").insert({
      empresa_id: empresaId,
      catalogo_item_id: producto.id,
      tipo: "entrada",
      cantidad,
      stock_resultante: stockResultante,
      motivo,
    });
  }

  await supabase.from("ordenes_servicio").update({ stock_descontado: false }).eq("id", ordenId);
}
