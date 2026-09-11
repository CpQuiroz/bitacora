/**
 * Formato de plata en pesos chilenos: sin decimales, separador de miles
 * con punto ("$1.250.000"). Fuente única — antes duplicado en
 * `web/src/lib/formatMoneda.ts` (vía Intl.NumberFormat, mismo resultado
 * para CLP) y `mobile/src/lib/plata.ts`. Ambos delegan acá ahora.
 */
export function formatearCLP(monto: number): string {
  return `$${Math.round(monto || 0).toLocaleString("es-CL")}`;
}
