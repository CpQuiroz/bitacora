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
// encola (services/sync/queue.ts) y se reintenta solo. Excepción: las
// fotos (ver más abajo) van SIEMPRE directo a la cola, nunca con un
// intento directo antes — un multipart no se puede cancelar de verdad
// en RN, así que un intento directo + un respaldo encolado de la MISMA
// foto pueden competir entre sí y no terminar nunca (bug real,
// 14-sep-2026, ver detalle en crearViaje de services/viajes.ts).
// ============================================================
import type { CatalogoItem, DetalleLevantamiento, LevantamientoResumen } from "@bitacora/shared";
import { apiJson } from "./api";
import { encolar } from "./sync/queue";

// Sin filtro de tipo: el técnico puede indicar tanto productos como
// servicios como material del levantamiento.
export async function listarCatalogo(): Promise<CatalogoItem[]> {
  const res = await apiJson<CatalogoItem[]>("/api/catalogo");
  return res.ok ? res.data.filter((i) => i.activo) : [];
}

// LevantamientoResumen/DetalleLevantamiento vivían acá, redeclarados a
// mano (mismo shape que el backend y que web/levantamientos/page.tsx
// volvían a escribir cada uno por su lado) — única fuente de verdad
// ahora en @bitacora/shared, esto solo re-exporta para no tocar los
// imports de las pantallas que ya los usaban desde este archivo.
export type { LevantamientoResumen, DetalleLevantamiento };

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

// (No hay intento inline de subida — la foto de levantamiento siempre va
// directo a la cola. Bug real, 14-sep-2026: había un intento inline
// aquí, `subirFotoLevantamiento`, eliminado — ver el comentario largo
// en crearViaje, services/viajes.ts, para el detalle completo de por
// qué un intento inline + un respaldo encolado de la MISMA foto podían
// dejar dos subidas viajando a la vez sin que ninguna terminara nunca.)
// "Foto de levantamiento" — sumada a ES_SUBIDA_DE_FOTO en queue.ts para
// que se procese al final del lote (nunca bloquea check-in/firma/etc).
// descripcion (23-sep-2026, pedido explícito) — texto opcional que el
// técnico agrega al elegir la foto (ver LevantamientoDetalleScreen).
// La cola ya manda `body` como campos de texto adicionales del MISMO
// multipart cuando hay un archivo (ver sync/queue.ts) — no hace falta
// ningún cambio ahí, solo pasarlo acá.
export function encolarFotoLevantamiento(id: string, foto: { uri: string; name?: string; type?: string }, descripcion?: string): Promise<void> {
  return encolar({
    etiqueta: "Foto de levantamiento",
    recurso: `levantamiento:${id}`,
    path: `/api/levantamientos/${id}/fotos`,
    method: "POST",
    body: descripcion?.trim() ? { descripcion: descripcion.trim() } : {},
    archivo: { uri: foto.uri, name: foto.name ?? "foto.jpg", type: foto.type ?? "image/jpeg", campo: "foto" },
  });
}
