// ============================================================
// BITÁCORA — Módulo Levantamientos, lado mobile (técnico/chofer).
// El técnico solo completa en terreno (descripción + materiales + fotos)
// — cotizar y aprobar/rechazar es exclusivo de la web (Admin).
//
// CON cola offline (agregada 2026-09-12, corrigiendo una simplificación
// apurada del alta original): un levantamiento se llena exactamente en
// el mismo tipo de terreno donde ya falla la señal para OS/viajes/
// mantención — no había ninguna razón real para tratarlo distinto.
// Mismo patrón: intento directo primero; si falla o no hay señal, se
// encola (services/sync/queue.ts) y se reintenta solo.
// ============================================================
import type { CatalogoItem, EstadoLevantamiento } from "@bitacora/shared";
import { apiFetch, apiJson, TIMEOUT_MULTIPART_MS } from "./api";
import { encolar } from "./sync/queue";

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

export type DatosCompletar = { descripcion_tecnico: string; materiales: { catalogo_item_id: string; cantidad: number }[] };

// Reemplaza descripción + materiales completos (no incremental) y pasa
// el levantamiento a "completado_tecnico". Intento directo — si falla
// por red/servidor, el caller decide encolar (ver encolarCompletar).
export async function completarLevantamiento(
  id: string,
  datos: DatosCompletar
): Promise<{ ok: true } | { ok: false; error: string; reintentable: boolean }> {
  const res = await apiJson(`/api/levantamientos/${id}/completar`, { method: "PATCH", body: JSON.stringify(datos) });
  if (!res.ok) return { ok: false, error: res.error ?? "No se pudo guardar", reintentable: res.status >= 500 || res.status === 0 };
  return { ok: true };
}

// Sin señal (o la subida directa falló): la acción es un PATCH sin
// archivo, se reintenta sola sin apilar nada especial — no hay riesgo
// de duplicar un registro (a diferencia de "crear"), es solo un update.
export function encolarCompletarLevantamiento(id: string, datos: DatosCompletar): Promise<void> {
  return encolar({
    etiqueta: "Levantamiento completado",
    recurso: `levantamiento:${id}`,
    path: `/api/levantamientos/${id}/completar`,
    method: "PATCH",
    body: datos,
  });
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

// "Foto de levantamiento" — sumada a ES_SUBIDA_DE_FOTO en queue.ts para
// que se procese al final del lote (nunca bloquea check-in/firma/etc).
export function encolarFotoLevantamiento(id: string, foto: { uri: string; name?: string; type?: string }): Promise<void> {
  return encolar({
    etiqueta: "Foto de levantamiento",
    recurso: `levantamiento:${id}`,
    path: `/api/levantamientos/${id}/fotos`,
    method: "POST",
    archivo: { uri: foto.uri, name: foto.name ?? "foto.jpg", type: foto.type ?? "image/jpeg", campo: "foto" },
  });
}
