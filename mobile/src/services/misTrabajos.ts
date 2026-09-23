import { apiJson } from "./api";

// Fase 5.3 — "Mis trabajos": historial de levantamientos/OS
// terminados (ver GET /api/mis-trabajos en el backend). Solo lectura.
export type ItemHistorialTrabajo = {
  tipo: "os" | "levantamiento";
  id: string;
  folio: number | null;
  fecha: string;
  cliente_nombre: string;
  estado: string;
};

export type RespuestaHistorial = { items: ItemHistorialTrabajo[]; total: number; pagina: number; limite: number };

export async function listarMisTrabajos(opts: {
  dias: 30 | 90;
  tipo?: "os" | "levantamiento";
  q?: string;
  pagina?: number;
  limite?: number;
}): Promise<RespuestaHistorial> {
  const params = new URLSearchParams({ dias: String(opts.dias), pagina: String(opts.pagina ?? 1), limite: String(opts.limite ?? 20) });
  if (opts.tipo) params.set("tipo", opts.tipo);
  if (opts.q?.trim()) params.set("q", opts.q.trim());
  const res = await apiJson<RespuestaHistorial>(`/api/mis-trabajos?${params.toString()}`);
  return res.ok ? res.data : { items: [], total: 0, pagina: 1, limite: opts.limite ?? 20 };
}

// El PDF de una OS exige el header de auth — se resuelve a una URL ya
// firmada (Storage) vía pdf-versiones, mismo criterio que la web.
export async function obtenerUrlPdfTrabajo(trabajoId: string): Promise<string | null> {
  const res = await apiJson<{ url: string }[]>(`/api/trabajos/${trabajoId}/pdf-versiones`);
  if (!res.ok || !res.data[0]) return null;
  return res.data[0].url;
}
