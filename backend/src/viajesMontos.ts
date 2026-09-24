// IVA por viaje — una sola definición, compartida entre la ruta REST
// (routes/viajes.ts, formulario web) y el bot de WhatsApp
// (whatsappFlujoViaje.ts). Redondeo a peso entero, igual que el resto
// del módulo Cobros.
export const IVA_TASA = 0.19;

export function calcularMontos(subtotalNum: number, aplicaIva: boolean) {
  const iva = aplicaIva ? Math.round(subtotalNum * IVA_TASA) : 0;
  return { subtotal: Math.round(subtotalNum), iva, total: Math.round(subtotalNum) + iva };
}

// ============================================================
// Cambio de monto de un viaje (tarea 132, 24-sep-2026): solo Admin y
// Supervisor, nunca sobre un viaje ya cobrado, y cada cambio queda en
// auditoria_empresa. Lo usan /api/viajes (web) y /api/mis-viajes (app).
// ============================================================
export const ROLES_EDITAN_MONTO_VIAJE: readonly string[] = ["admin", "supervisor"];

export type MontosViaje = { subtotal: number; aplica_iva: boolean; iva: number; total: number };

// Nuevos montos si el pedido trae subtotal/aplica_iva; null si no cambia
// nada (mismo subtotal y mismo IVA — así la app del chofer, que manda el
// formulario completo, puede seguir editando lo demás sin tocar el monto).
export function nuevosMontosViaje(
  existente: { subtotal: number | string | null; aplica_iva: boolean; iva?: number | string | null; total?: number | string | null },
  subtotal: unknown,
  aplicaIva: unknown
): { error: string } | { cambio: null } | { cambio: { anterior: MontosViaje; nuevo: MontosViaje } } {
  if (subtotal === undefined && aplicaIva === undefined) return { cambio: null };
  const subtotalNum = subtotal !== undefined ? Number(subtotal) : Number(existente.subtotal);
  if (!Number.isFinite(subtotalNum) || subtotalNum < 0) return { error: "Monto inválido" };
  const aplicaIvaBool = aplicaIva !== undefined ? aplicaIva !== false && aplicaIva !== "false" : existente.aplica_iva;
  const m = calcularMontos(subtotalNum, aplicaIvaBool);
  const nuevo: MontosViaje = { subtotal: m.subtotal, aplica_iva: aplicaIvaBool, iva: m.iva, total: m.total };
  const anterior: MontosViaje = {
    subtotal: Number(existente.subtotal ?? 0),
    aplica_iva: existente.aplica_iva,
    iva: Number(existente.iva ?? 0),
    total: Number(existente.total ?? 0),
  };
  if (anterior.subtotal === nuevo.subtotal && anterior.aplica_iva === nuevo.aplica_iva) return { cambio: null };
  return { cambio: { anterior, nuevo } };
}

// "HH:MM" o "HH:MM:SS" → "HH:MM:SS"; vacío → null; otro → error.
export function normalizarHora(hora: unknown): { hora: string | null } | { error: string } {
  if (hora === undefined || hora === null || hora === "") return { hora: null };
  if (typeof hora !== "string" || !/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/.test(hora)) return { error: "Hora inválida (usa HH:MM)" };
  return { hora: hora.length === 5 ? `${hora}:00` : hora };
}
