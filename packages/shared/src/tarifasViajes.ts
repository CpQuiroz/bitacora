// Precio de viajes por tramos y por km (tarea 135). Funciones puras que usan
// el backend (cálculo real) y la web (vista previa). Montos netos, sin IVA.
import type { TarifaTramo, TramoPrecio } from "./types";
import { normalizarLugar } from "./regionMetropolitana";

// Un tramo vale lo mismo en ambos sentidos: el par se guarda ordenado.
export function parTramo(origen: string, destino: string): { par_a: string; par_b: string } {
  const a = normalizarLugar(origen);
  const b = normalizarLugar(destino);
  return a <= b ? { par_a: a, par_b: b } : { par_a: b, par_b: a };
}

// Paradas en orden (origen, intermedias, destino) → tramos consecutivos.
// Se ignoran paradas vacías y repeticiones seguidas del mismo lugar.
export function armarTramos(paradas: string[]): { origen: string; destino: string }[] {
  const limpias: string[] = [];
  for (const p of paradas.map((x) => x.trim()).filter(Boolean)) {
    if (limpias.length === 0 || normalizarLugar(limpias[limpias.length - 1]!) !== normalizarLugar(p)) limpias.push(p);
  }
  const tramos: { origen: string; destino: string }[] = [];
  for (let i = 0; i < limpias.length - 1; i++) tramos.push({ origen: limpias[i]!, destino: limpias[i + 1]! });
  return tramos;
}

// La tarifa del cliente gana sobre la general; solo tarifas activas.
export function elegirTarifaTramo(
  tarifas: Pick<TarifaTramo, "par_a" | "par_b" | "cliente_id" | "precio" | "activo">[],
  origen: string,
  destino: string,
  clienteId: string | null
): number | null {
  const { par_a, par_b } = parTramo(origen, destino);
  const delPar = tarifas.filter((t) => t.activo && t.par_a === par_a && t.par_b === par_b);
  const propia = clienteId ? delPar.find((t) => t.cliente_id === clienteId) : undefined;
  const general = delPar.find((t) => t.cliente_id === null);
  const t = propia ?? general;
  return t ? Number(t.precio) : null;
}

export type CalculoTramos = { tramos: TramoPrecio[]; subtotal: number; faltantes: { origen: string; destino: string }[] };

export function calcularPorTramos(
  paradas: string[],
  tarifas: Pick<TarifaTramo, "par_a" | "par_b" | "cliente_id" | "precio" | "activo">[],
  clienteId: string | null
): CalculoTramos {
  const tramos = armarTramos(paradas).map((t) => ({ ...t, precio: elegirTarifaTramo(tarifas, t.origen, t.destino, clienteId) }));
  const faltantes = tramos.filter((t) => t.precio === null).map(({ origen, destino }) => ({ origen, destino }));
  const subtotal = Math.round(tramos.reduce((s, t) => s + (t.precio ?? 0), 0));
  return { tramos, subtotal, faltantes };
}

// Precio por km: redondeado a peso entero.
export function calcularPorKm(km: number, precioKm: number): number {
  if (!(km >= 0) || !(precioKm >= 0)) return 0;
  return Math.round(km * precioKm);
}
