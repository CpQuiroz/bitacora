// ============================================================
// Viajes ↔ cobros (tabla facturas). Un viaje facturado apunta a su cobro
// con viajes.factura_id; el cobro guarda la lista en facturas.viaje_ids.
// ============================================================
import type { DetalleViajesCobro, ViajeDetalleCobro } from "@bitacora/shared";
import { supabase } from "./supabase";

// Cobro al que pertenece un viaje ya facturado — para decirle al usuario
// por qué no puede editarlo y en qué cobro está (tarea 132).
export async function cobroDeViaje(empresaId: string, facturaId: string | null) {
  if (!facturaId) return null;
  const { data } = await supabase.from("facturas").select("id, folio, estado").eq("empresa_id", empresaId).eq("id", facturaId).maybeSingle();
  return data;
}

// Detalle por viaje de un cobro (tarea 134): N° guía, fecha, chofer,
// cliente, origen, destino, neto, IVA y total, más los totales y el
// período (primer y último viaje). Siempre filtrado por empresa.
export async function detalleViajesDeCobro(empresaId: string, viajeIds: string[] | null | undefined): Promise<DetalleViajesCobro> {
  const ids = (viajeIds ?? []).filter(Boolean);
  if (ids.length === 0) return { filas: [], totales: { neto: 0, iva: 0, total: 0 }, periodo: null };
  const { data, error } = await supabase
    .from("viajes")
    .select("id, folio, numero_guia, fecha, cliente, origen, destino, subtotal, iva, total, modo_precio, distancia_km, tramos_detalle, chofer:usuarios(nombre), cliente_info:clientes(nombre)")
    .eq("empresa_id", empresaId)
    .in("id", ids)
    .order("fecha", { ascending: true })
    .order("folio", { ascending: true });
  if (error) throw new Error(`No se pudo leer el detalle de viajes del cobro: ${error.message}`);
  const filas: ViajeDetalleCobro[] = (data ?? []).map((v) => {
    const r = v as unknown as {
      id: string; folio: number | null; numero_guia: string; fecha: string; cliente: string; origen: string; destino: string;
      subtotal: number | string; iva: number | string; total: number | string;
      modo_precio: string | null; distancia_km: number | string | null; tramos_detalle: { destino: string }[] | null;
      chofer: { nombre: string } | null; cliente_info: { nombre: string } | null;
    };
    return {
      id: r.id,
      folio: r.folio,
      numero_guia: r.numero_guia,
      fecha: r.fecha,
      chofer: r.chofer?.nombre ?? null,
      cliente: r.cliente_info?.nombre ?? r.cliente,
      origen: r.origen,
      destino: r.destino,
      km: r.modo_precio === "km" && r.distancia_km != null ? Number(r.distancia_km) : null,
      via: r.modo_precio === "tramos" && r.tramos_detalle && r.tramos_detalle.length > 1 ? r.tramos_detalle.slice(0, -1).map((t) => t.destino) : [],
      neto: Number(r.subtotal),
      iva: Number(r.iva),
      total: Number(r.total),
    };
  });
  const totales = filas.reduce((t, f) => ({ neto: t.neto + f.neto, iva: t.iva + f.iva, total: t.total + f.total }), { neto: 0, iva: 0, total: 0 });
  const periodo = filas.length ? { desde: filas[0]!.fecha, hasta: filas[filas.length - 1]!.fecha } : null;
  return { filas, totales, periodo };
}
