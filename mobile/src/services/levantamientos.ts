// ============================================================
// BITÁCORA — Módulo Levantamientos, lado mobile (técnico/chofer).
// El técnico solo completa en terreno (descripción + materiales + fotos)
// — cotizar y aprobar/rechazar es exclusivo de la web (Admin). Sin cola
// offline a propósito (a diferencia de OS/viajes/mantención): el técnico
// completa un levantamiento en una sola sesión con señal, no es un
// formulario que se llena en el momento del check-in en terreno sin
// conexión — simplificación aceptada, ver progress/current.md.
// ============================================================
import type { CatalogoItem, EstadoLevantamiento } from "@bitacora/shared";
import { apiFetch, apiJson, TIMEOUT_MULTIPART_MS } from "./api";

// Sin filtro de tipo: el técnico puede indicar tanto productos como
// servicios como material del levantamiento.
export async function listarCatalogo(): Promise<CatalogoItem[]> {
  const res = await apiJson<CatalogoItem[]>("/api/catalogo");
  return res.ok ? res.data.filter((i) => i.activo) : [];
}

export type LevantamientoResumen = {
  id: string;
  estado: EstadoLevantamiento;
  descripcion_requerimiento: string | null;
  creado_en: string;
  cliente: { id: string; nombre: string } | null;
  tecnico: { id: string; nombre: string } | null;
};

export type MaterialLevantamiento = {
  id: string;
  catalogo_item_id: string;
  cantidad: number;
  catalogo_item: { id: string; nombre: string; precio_base: number; unidad: string } | null;
};

export type FotoLevantamiento = { id: string; url: string; creado_en: string };

export type DetalleLevantamiento = LevantamientoResumen & {
  descripcion_tecnico: string | null;
  referencia_externa: string | null;
  trabajo_id: string | null;
  folio_os: number | null;
  materiales: MaterialLevantamiento[];
  fotos: FotoLevantamiento[];
};

export async function listarMisLevantamientos(): Promise<LevantamientoResumen[]> {
  const res = await apiJson<LevantamientoResumen[]>("/api/levantamientos");
  return res.ok ? res.data : [];
}

export async function obtenerDetalleLevantamiento(id: string): Promise<{ detalle: DetalleLevantamiento | null; error: string | null }> {
  const res = await apiJson<DetalleLevantamiento>(`/api/levantamientos/${id}`);
  if (!res.ok) return { detalle: null, error: res.error ?? "No se pudo cargar el detalle" };
  return { detalle: res.data, error: null };
}

// Reemplaza descripción + materiales completos (no incremental) y pasa
// el levantamiento a "completado_tecnico".
export async function completarLevantamiento(
  id: string,
  datos: { descripcion_tecnico: string; materiales: { catalogo_item_id: string; cantidad: number }[] }
): Promise<{ ok: true } | { ok: false; error: string }> {
  const res = await apiJson(`/api/levantamientos/${id}/completar`, { method: "PATCH", body: JSON.stringify(datos) });
  if (!res.ok) return { ok: false, error: res.error ?? "No se pudo guardar" };
  return { ok: true };
}

export async function subirFotoLevantamiento(
  id: string,
  foto: { uri: string; name?: string; type?: string }
): Promise<{ ok: true; foto: FotoLevantamiento } | { ok: false; error: string }> {
  const fd = new FormData();
  fd.append("foto", { uri: foto.uri, name: foto.name ?? "foto.jpg", type: foto.type ?? "image/jpeg" } as unknown as Blob);
  try {
    const res = await apiFetch(`/api/levantamientos/${id}/fotos`, { method: "POST", body: fd }, TIMEOUT_MULTIPART_MS);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      return { ok: false, error: (body as { error?: string }).error ?? `Error ${res.status}` };
    }
    return { ok: true, foto: await res.json() };
  } catch {
    return { ok: false, error: "Sin conexión" };
  }
}
