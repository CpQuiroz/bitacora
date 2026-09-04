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
