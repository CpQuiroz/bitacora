// IVA por viaje — una sola definición, compartida entre la ruta REST
// (routes/viajes.ts, formulario web) y el bot de WhatsApp
// (whatsappFlujoViaje.ts). Redondeo a peso entero, igual que el resto
// del módulo Cobros.
export const IVA_TASA = 0.19;

export function calcularMontos(subtotalNum: number, aplicaIva: boolean) {
  const iva = aplicaIva ? Math.round(subtotalNum * IVA_TASA) : 0;
  return { subtotal: Math.round(subtotalNum), iva, total: Math.round(subtotalNum) + iva };
}
