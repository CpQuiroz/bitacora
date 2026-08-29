import { apiFetch } from "./api";

// El endpoint del PDF vive detrás de requiereAuth (Bearer token), así
// que no se puede enlazar directo con <a href> — se pide con
// apiFetch (que agrega el token) y se abre el blob resultante.
export async function abrirPdfOS(trabajoId: string): Promise<boolean> {
  const res = await apiFetch(`/api/trabajos/${trabajoId}/pdf`);
  if (!res.ok) return false;
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  window.open(url, "_blank");
  return true;
}

export async function abrirPdfCotizacion(cotizacionId: string): Promise<boolean> {
  const res = await apiFetch(`/api/cotizaciones/${cotizacionId}/pdf`);
  if (!res.ok) return false;
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  window.open(url, "_blank");
  return true;
}

export async function abrirPdfInforme(informeId: string): Promise<boolean> {
  const res = await apiFetch(`/api/informe/historial/${informeId}/pdf`);
  if (!res.ok) return false;
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  window.open(url, "_blank");
  return true;
}
