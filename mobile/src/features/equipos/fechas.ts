// Fechas YYYY-MM-DD de Equipos (tarea 146): se manejan como fecha local,
// sin zona horaria (una fecha de vencimiento no tiene hora).
const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

export function fechaLegible(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return y && m && d ? `${d} ${MESES[m - 1]} ${y}` : iso;
}

export function aFecha(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return y && m && d ? new Date(y, m - 1, d) : null;
}

export function aIso(fecha: Date | null): string | null {
  if (!fecha) return null;
  const mm = String(fecha.getMonth() + 1).padStart(2, "0");
  const dd = String(fecha.getDate()).padStart(2, "0");
  return `${fecha.getFullYear()}-${mm}-${dd}`;
}
