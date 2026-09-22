import type { Gasto, MetodoEntregaRendicion, PeriodoRendicion, Rendicion } from "@bitacora/shared";
import { apiJson } from "./api";
import { encolarComprobante, type BorradorGasto, type Foto } from "./gastos";

// Fondo por rendir / caja chica (migración 120, 21-sep-2026) — mismos
// endpoints que usa la web (web/src/app/dashboard/rendiciones), sin
// duplicar ninguna agregación (el saldo lo calcula siempre el backend).

export type RendicionConDatos = Rendicion & {
  colaborador: { id: string; nombre: string } | null;
  total_gastado: number;
  saldo: number;
};

export type GastoConDatos = Gasto & {
  categoria_info: { id: string; nombre: string; color: string } | null;
  proveedor_info: { id: string; nombre: string } | null;
};

export type DetalleRendicion = RendicionConDatos & {
  aprobador: { id: string; nombre: string } | null;
  gastos: GastoConDatos[];
};

export async function listarMisRendiciones(): Promise<RendicionConDatos[]> {
  const res = await apiJson<RendicionConDatos[]>("/api/rendiciones");
  return res.ok ? res.data : [];
}

export async function obtenerRendicion(id: string): Promise<{ ok: true; detalle: DetalleRendicion } | { ok: false; error: string }> {
  const res = await apiJson<DetalleRendicion>(`/api/rendiciones/${id}`);
  if (res.ok) return { ok: true, detalle: res.data };
  return { ok: false, error: res.error };
}

export type BorradorRendicion = {
  periodo: PeriodoRendicion;
  fecha_inicio: string;
  fecha_termino: string;
  monto_entregado: string; // solo dígitos (InputMonto)
  metodo_entrega: MetodoEntregaRendicion;
};

export async function crearRendicion(b: BorradorRendicion): Promise<{ ok: true; rendicion: Rendicion } | { ok: false; error: string }> {
  const res = await apiJson<Rendicion>("/api/rendiciones", {
    method: "POST",
    body: JSON.stringify({
      periodo: b.periodo,
      fecha_inicio: b.fecha_inicio,
      fecha_termino: b.fecha_termino,
      monto_entregado: Number(b.monto_entregado || 0),
      metodo_entrega: b.metodo_entrega,
    }),
  });
  if (res.ok) return { ok: true, rendicion: res.data };
  return { ok: false, error: res.error };
}

// Crea un gasto asociado a la rendición — misma forma que crearGasto
// (services/gastos.ts), pero apuntando a /api/rendiciones/:id/items y
// SIEMPRE encolando el comprobante aparte (nunca inline), igual que
// Nuevo Gasto — mismo mecanismo de reintento offline, nada nuevo.
export async function agregarGastoRendicion(
  rendicionId: string,
  b: BorradorGasto,
  foto: Foto
): Promise<{ ok: true; gasto: Gasto } | { ok: false; error: string }> {
  const res = await apiJson<Gasto>(`/api/rendiciones/${rendicionId}/items`, {
    method: "POST",
    body: JSON.stringify({
      descripcion: b.descripcion.trim() || undefined,
      monto: Number(b.monto || 0),
      categoria_gasto_id: b.categoria_gasto_id || undefined,
      centro_costo_id: b.centro_costo_id || undefined,
      proveedor_id: b.proveedor_id || undefined,
      trabajo_id: b.trabajo_id || undefined,
      fecha: b.fecha,
    }),
  });
  if (!res.ok) return { ok: false, error: res.error };
  await encolarComprobante(res.data.id, foto);
  return { ok: true, gasto: res.data };
}

export async function enviarRendicion(id: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const res = await apiJson<Rendicion>(`/api/rendiciones/${id}/enviar`, { method: "POST" });
  if (res.ok) return { ok: true };
  return { ok: false, error: res.error };
}
