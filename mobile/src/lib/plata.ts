// Formato de plata para Chile: peso sin decimales, separador de miles con punto.

/** Deja solo los dígitos de un texto ("$ 1.250" → "1250"). */
export function soloDigitos(s: string): string {
  return (s ?? "").replace(/\D/g, "");
}

/** Agrupa de a miles con punto ("1250000" → "1.250.000"). */
export function agruparMiles(digitos: string): string {
  const limpio = soloDigitos(digitos).replace(/^0+(?=\d)/, "");
  return limpio.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

/** Monto en pesos con signo ("$1.250.000"). */
export function pesos(n: number): string {
  return `$${Math.round(n || 0).toLocaleString("es-CL")}`;
}

/**
 * Monto en la moneda de la empresa. La mayoría son CLP (usa `pesos`);
 * para otras monedas antepone el código en vez de usar
 * Intl.NumberFormat con `currency` (no probado en Hermes/RN todavía —
 * la web sí lo usa vía formatMoneda, acá se prefiere el camino ya
 * probado en el resto de la app).
 */
export function formatearMoneda(n: number, moneda = "CLP"): string {
  const monto = Math.round(n || 0).toLocaleString("es-CL");
  return !moneda || moneda === "CLP" ? `$${monto}` : `${moneda} ${monto}`;
}
