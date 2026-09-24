// Fecha de hoy en Chile (YYYY-MM-DD). El servidor corre en UTC: después
// de las ~20-21 h de Chile, new Date().toISOString() ya es "mañana".
export function hoyChile(ahora: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Santiago" }).format(ahora);
}
