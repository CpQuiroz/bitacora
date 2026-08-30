import type { CatalogoItem } from "@bitacora/shared";

export type EstadoStock = "en_stock" | "stock_bajo" | "sin_stock";

// stock_minimo puede venir null (el ítem no definió el suyo) — en ese caso
// se usa el umbral por defecto de la empresa (Configuración > Inventario).
// Compartido entre Inventario, Catálogo y el selector de catálogo — antes
// vivía duplicado solo en la página de Inventario.
export function estadoStock(item: Pick<CatalogoItem, "stock_actual" | "stock_minimo">, minimoDefault: number): EstadoStock {
  const actual = item.stock_actual ?? 0;
  const minimo = item.stock_minimo ?? minimoDefault;
  if (actual <= 0) return "sin_stock";
  if (actual <= minimo) return "stock_bajo";
  return "en_stock";
}

export const ETIQUETA_ESTADO_STOCK: Record<EstadoStock, string> = {
  en_stock: "En stock",
  stock_bajo: "Stock bajo",
  sin_stock: "Sin stock",
};
