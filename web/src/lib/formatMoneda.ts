const LOCALE_POR_MONEDA: Record<string, string> = {
  CLP: "es-CL",
  USD: "en-US",
  EUR: "de-DE",
  PEN: "es-PE",
  COP: "es-CO",
  MXN: "es-MX",
  ARS: "es-AR",
};

export function formatMoneda(monto: number, moneda = "CLP"): string {
  const locale = LOCALE_POR_MONEDA[moneda] ?? "es-CL";
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: moneda,
    maximumFractionDigits: 0,
  }).format(monto);
}
