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

// URL firmada temporal (7 días) del PDF de una cotización, para compartir
// fuera de la app — a diferencia de abrirPdfCotizacion, esta URL sí se
// puede pegar en un link (ej. WhatsApp) porque no exige el header
// Authorization: ya viene firmada por S3.
export async function urlCompartirPdfCotizacion(cotizacionId: string): Promise<string | null> {
  const res = await apiFetch(`/api/cotizaciones/${cotizacionId}/pdf/compartir`);
  if (!res.ok) return null;
  const { url } = await res.json();
  return url ?? null;
}

export async function abrirPdfInforme(informeId: string): Promise<boolean> {
  const res = await apiFetch(`/api/informe/historial/${informeId}/pdf`);
  if (!res.ok) return false;
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  window.open(url, "_blank");
  return true;
}
