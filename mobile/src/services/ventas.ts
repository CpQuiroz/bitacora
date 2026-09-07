import type { CatalogoItem, MedioPagoVenta, TipoLineaVenta, VentaConLineas } from "@bitacora/shared";
import { apiJson } from "./api";

export type LineaBorrador = {
  tipo: TipoLineaVenta;
  referencia_id: string;
  nombre: string;
  cantidad: number;
  precio_unitario: number;
  heredada?: boolean;
};

export type BorradorVenta = {
  origen_tipo: "cita" | "os";
  origen_id: string;
  medio_pago: MedioPagoVenta;
  lineas: LineaBorrador[];
};

export async function listarProductos(): Promise<CatalogoItem[]> {
  const res = await apiJson<CatalogoItem[]>("/api/catalogo?tipo=producto");
  return res.ok ? res.data : [];
}

export async function ventasDeOrigen(tipo: "cita" | "os", id: string): Promise<VentaConLineas[]> {
  const res = await apiJson<VentaConLineas[]>(`/api/ventas/origen/${tipo}/${id}`);
  return res.ok ? res.data : [];
}

export async function ventasDeCliente(clienteId: string): Promise<VentaConLineas[]> {
  const res = await apiJson<VentaConLineas[]>(`/api/ventas?cliente_id=${clienteId}`);
  return res.ok ? res.data : [];
}

export async function crearVenta(b: BorradorVenta): Promise<{ ok: true; venta: VentaConLineas } | { ok: false; error: string }> {
  const res = await apiJson<VentaConLineas>("/api/ventas", { method: "POST", body: JSON.stringify(b) });
  return res.ok ? { ok: true, venta: res.data } : { ok: false, error: res.error };
}
