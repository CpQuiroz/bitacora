import { formatearCLP } from "@bitacora/shared";

const LOCALE_POR_MONEDA: Record<string, string> = {
  CLP: "es-CL",
  USD: "en-US",
  EUR: "de-DE",
  PEN: "es-PE",
  COP: "es-CO",
  MXN: "es-MX",
  ARS: "es-AR",
};

// CLP: fuente única en @bitacora/shared (mismo resultado que el
// Intl.NumberFormat de acá, así que no cambia nada visible — ver
// packages/shared/src/dinero.test.ts). El resto de monedas sigue con
// Intl porque necesita el símbolo/formato real de cada una.
export function formatMoneda(monto: number, moneda = "CLP"): string {
  if (!moneda || moneda === "CLP") return formatearCLP(monto);
  const locale = LOCALE_POR_MONEDA[moneda] ?? "es-CL";
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: moneda,
    maximumFractionDigits: 0,
  }).format(monto);
}

/** Símbolo de la moneda ("$", "€", …) para ponerlo como prefijo del input. */
export function simboloMoneda(moneda = "CLP"): string {
  const locale = LOCALE_POR_MONEDA[moneda] ?? "es-CL";
  const parts = new Intl.NumberFormat(locale, { style: "currency", currency: moneda, maximumFractionDigits: 0 }).formatToParts(0);
  return parts.find((p) => p.type === "currency")?.value ?? "$";
}

// --- Helpers para el input de dinero en vivo (mismo criterio que
// mobile/src/lib/plata.ts: sin decimales, separador de miles del locale) ---

/** Deja solo los dígitos de un texto ("$ 1.250" → "1250"). */
export function soloDigitos(s: string): string {
  return (s ?? "").replace(/\D/g, "");
}

/** Agrupa de a miles según el locale de la moneda ("1250000" → "1.250.000"). */
export function agruparMiles(digitos: string, moneda = "CLP"): string {
  const limpio = soloDigitos(digitos).replace(/^0+(?=\d)/, "");
  if (!limpio) return "";
  const locale = LOCALE_POR_MONEDA[moneda] ?? "es-CL";
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(Number(limpio));
}
