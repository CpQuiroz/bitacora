// ============================================================
// BITÁCORA — Descuento automático de inventario por cambio de estado
// de una OS (Bloque B, configurable). Reemplaza el diseño anterior
// (Prompt6), que tenía el estado disparador hardcodeado a "firmada" —
// ahora se lee de `empresas.inventario_descontar_en_estado`, junto
// con si se permite stock negativo y si se descuenta una sola vez por
// OS. El único otro punto de escritura de inventario_movimientos es
// el endpoint manual de Configuración > Inventario
// (backend/src/routes/inventario.ts), que bloquea stock negativo —
// esta lógica es deliberadamente independiente de ese endpoint,
// porque acá el stock SÍ puede quedar negativo según la configuración.
// ============================================================
import type { CatalogoItem, EstadoOS } from "@bitacora/shared";
import { supabase } from "./supabase";

type ConfigInventario = {
  activado: boolean;
  descontarEnEstado: EstadoOS;
  permitirNegativo: boolean;
  descontarUnaVez: boolean;
};

async function cargarConfigInventario(empresaId: string): Promise<ConfigInventario> {
  const { data } = await supabase
    .from("empresas")
    .select("inventario_activado, inventario_descontar_en_estado, inventario_permitir_negativo, inventario_descontar_una_vez")
    .eq("id", empresaId)
    .maybeSingle();
  return {
    activado: data?.inventario_activado ?? false,
    descontarEnEstado: (data?.inventario_descontar_en_estado as EstadoOS) ?? "firmada",
    permitirNegativo: data?.inventario_permitir_negativo ?? true,
    descontarUnaVez: data?.inventario_descontar_una_vez ?? true,
  };
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

// Se llama después de CUALQUIER cambio de estado_os de una OS (check-in,
// check-out, finalizar) — decide solo internamente si corresponde
// descontar, según la configuración de la empresa. Devuelve las
// advertencias de stock insuficiente para mostrar en el frontend — NO
// bloquea la operación (Bloque B punto 6): el stock puede quedar
// negativo aunque "permitir negativo" esté desactivado, ese toggle solo
// decide si se advierte o no. TODO: decisión pendiente — si en el
// futuro se quiere BLOQUEAR el cambio de estado por falta de stock, es
// acá donde iría ese chequeo (hoy no existe ninguna opción de bloqueo).
export async function aplicarDescuentoInventarioSiCorresponde(
  empresaId: string,
  ordenId: string,
  trabajoId: string,
  folio: number | null,
  nuevoEstadoOs: EstadoOS
): Promise<string[]> {
  const config = await cargarConfigInventario(empresaId);
  if (!config.activado || config.descontarEnEstado !== nuevoEstadoOs) return [];

  if (config.descontarUnaVez) {
    const { data: orden } = await supabase.from("ordenes_servicio").select("stock_descontado").eq("id", ordenId).maybeSingle();
    if (orden?.stock_descontado) return [];
  }

  const cantidadPorProducto = await productosADescontar(empresaId, trabajoId);
  if (cantidadPorProducto.size === 0) return [];

  const ids = [...cantidadPorProducto.keys()];
  const { data: productos } = await supabase.from("catalogo_items").select("id, nombre, stock_actual").eq("empresa_id", empresaId).in("id", ids);

  const advertencias: string[] = [];
  const motivo = `OS N° ${folio ?? trabajoId.slice(0, 8)} — descuento automático (${nuevoEstadoOs})`;
  for (const producto of productos ?? []) {
    const cantidad = cantidadPorProducto.get(producto.id)!;
    const stockActual = producto.stock_actual ?? 0;
    const stockResultante = stockActual - cantidad;
    if (stockResultante < 0 && !config.permitirNegativo) {
      advertencias.push(`Stock insuficiente de "${producto.nombre}": quedó en ${stockResultante}.`);
    }
    await supabase.from("catalogo_items").update({ stock_actual: stockResultante }).eq("empresa_id", empresaId).eq("id", producto.id);
    await supabase.from("inventario_movimientos").insert({
      empresa_id: empresaId,
      catalogo_item_id: producto.id,
      tipo: "salida",
      cantidad,
      stock_resultante: stockResultante,
      motivo,
      origen: "automatico",
    });
  }

  await supabase.from("ordenes_servicio").update({ stock_descontado: true }).eq("id", ordenId);
  return advertencias;
}

// Se llama cuando una OS que ya había descontado stock se cancela
// (trabajos.estado -> "cancelado"). Recalcula los mismos productos que
// aplicarDescuentoInventarioSiCorresponde() — es seguro porque los
// ítems de una OS quedan bloqueados (no editables) apenas hay firma,
// no pueden haber cambiado entre el descuento y la reversión. (Si el
// estado disparador configurado es uno anterior a la firma, ej.
// "en_proceso", los ítems en teoría podrían seguir editándose después
// del descuento — ver TODO de alcance en RESUMEN_TRABAJO.md.)
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
      origen: "automatico",
    });
  }

  await supabase.from("ordenes_servicio").update({ stock_descontado: false }).eq("id", ordenId);
}
