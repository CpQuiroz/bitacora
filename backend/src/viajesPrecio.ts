// ============================================================
// Cómo se calculó el precio de un viaje (tarea 135). El formulario manda la
// forma de cobro (fijo | tramos | km) con sus datos; acá se valida y se
// arma lo que se guarda en el viaje. El detalle de tramos y el precio por km
// los pone el servidor con las tarifas vigentes (no se confía en el
// navegador); el subtotal final sigue viniendo del formulario, porque el
// Admin puede ajustar lo propuesto (queda en el historial de monto).
// ============================================================
import type { ModoPrecioViaje, TramoPrecio } from "@bitacora/shared";
import { ROLES_SUPERVISION, calcularPorTramos } from "@bitacora/shared";
import type { RequestConEmpresa } from "./empresa";
import { supabase } from "./supabase";
import { tarifaKmDe } from "./routes/tarifasViajes";

const MODOS: ModoPrecioViaje[] = ["fijo", "tramos", "km"];

export type PedidoPrecio =
  | { modo: "fijo" }
  | { modo: "tramos"; paradas: string[] }
  | { modo: "km"; distanciaKm: number };

export function leerPedidoPrecio(body: Record<string, unknown>): { sinCambio: true } | { pedido: PedidoPrecio } | { error: string } {
  const { modo_precio, paradas, distancia_km } = body;
  if (modo_precio === undefined) return { sinCambio: true };
  if (typeof modo_precio !== "string" || !MODOS.includes(modo_precio as ModoPrecioViaje)) {
    return { error: "La forma de cobro debe ser fijo, tramos o km" };
  }
  if (modo_precio === "fijo") return { pedido: { modo: "fijo" } };
  if (modo_precio === "tramos") {
    const lista = Array.isArray(paradas) ? paradas.filter((p): p is string => typeof p === "string" && p.trim().length > 0).map((p) => p.trim()) : [];
    if (lista.length < 2 || lista.length > 10 || lista.some((p) => p.length > 120)) return { error: "Por tramos: indica origen, paradas y destino (hasta 10 puntos)" };
    return { pedido: { modo: "tramos", paradas: lista } };
  }
  const km = Number(distancia_km);
  if (distancia_km === null || distancia_km === undefined || distancia_km === "" || !Number.isFinite(km) || km < 0 || km > 99_999) {
    return { error: "Por km: indica los kilómetros" };
  }
  return { pedido: { modo: "km", distanciaKm: Math.round(km * 10) / 10 } };
}

export type CamposPrecio = {
  modo_precio: ModoPrecioViaje;
  tramos_detalle: TramoPrecio[] | null;
  distancia_km: number | null;
  precio_km: number | null;
  origen?: string;
  destino?: string;
};

export async function camposPrecio(empresaId: string, clienteId: string | null, pedido: PedidoPrecio): Promise<CamposPrecio | { error: string }> {
  if (pedido.modo === "fijo") return { modo_precio: "fijo", tramos_detalle: null, distancia_km: null, precio_km: null };
  if (pedido.modo === "tramos") {
    const { data: tarifas, error } = await supabase
      .from("tarifas_tramo")
      .select("par_a, par_b, cliente_id, precio, activo")
      .eq("empresa_id", empresaId)
      .eq("activo", true);
    if (error) return { error: error.message };
    const calculo = calcularPorTramos(pedido.paradas, tarifas ?? [], clienteId);
    if (calculo.tramos.length === 0) return { error: "Por tramos: el origen y el destino deben ser distintos" };
    return {
      modo_precio: "tramos",
      tramos_detalle: calculo.tramos,
      distancia_km: null,
      precio_km: null,
      // El viaje va del primer punto al último.
      origen: calculo.tramos[0]!.origen,
      destino: calculo.tramos[calculo.tramos.length - 1]!.destino,
    };
  }
  const precioKm = await tarifaKmDe(empresaId, clienteId);
  if (precioKm === null) return { error: "No hay precio por km definido en Viajes › Tarifas" };
  return { modo_precio: "km", tramos_detalle: null, distancia_km: pedido.distanciaKm, precio_km: precioKm };
}

// Recorrido guardado en un viaje por tramos: origen + destinos de cada tramo.
export function paradasDelViaje(v: { origen: string; destino: string; tramos_detalle: TramoPrecio[] | null }): string[] {
  if (v.tramos_detalle && v.tramos_detalle.length) return [v.tramos_detalle[0]!.origen, ...v.tramos_detalle.map((t) => t.destino)];
  return [v.origen, v.destino];
}

// ¿El formulario manda la misma forma de cobro que ya tiene el viaje? Si es
// igual (misma forma, mismas paradas, mismos km), no se recalcula: el detalle
// queda fijo en el viaje aunque después cambien las tarifas (propuesta §2.4).
export function mismaFormaDeCobro(
  v: { modo_precio: ModoPrecioViaje; origen: string; destino: string; distancia_km: number | string | null; tramos_detalle: TramoPrecio[] | null },
  pedido: PedidoPrecio
): boolean {
  if (pedido.modo !== v.modo_precio) return false;
  if (pedido.modo === "fijo") return true;
  if (pedido.modo === "km") return Number(v.distancia_km) === pedido.distanciaKm;
  const actuales = paradasDelViaje(v).map((p) => p.trim().toLowerCase());
  return actuales.length === pedido.paradas.length && pedido.paradas.every((p, i) => p.trim().toLowerCase() === actuales[i]);
}

// Las tarifas y el detalle del cálculo (tramos con su precio, precio por km)
// solo los ven Admin y Supervisor (decisión de la usuaria): a cualquier otro
// rol, incluso uno personalizado con el módulo, se le quitan.
export function sinCostos<T extends Record<string, unknown>>(req: RequestConEmpresa, v: T): T {
  if (ROLES_SUPERVISION.includes(req.rol ?? "")) return v;
  const { precio_km: _pk, tramos_detalle: _td, ...resto } = v as T & { precio_km?: unknown; tramos_detalle?: unknown };
  return resto as T;
}
