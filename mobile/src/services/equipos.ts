import type { Documento, Equipo, EquipoAsignadoConDocumentos, EstadoDocumento, PlanMantencion, TipoDocumento, Usuario } from "@bitacora/shared";
import { apiFetch, apiJson, TIMEOUT_MULTIPART_MS } from "./api";
import { guardarCache, leerCache } from "./sync/cache";

// Equipos en mobile (tarea 146): lista, ficha, editar (no crear), plan de
// mantención, asignación y documentos de vehículos. Mismos endpoints que la
// web; el backend decide los permisos (flota/equipos; el chofer, solo los
// documentos de su vehículo asignado).

export type AsignacionVigente = { colaborador_id: string; colaborador_nombre: string } | null;
export type EquipoConAsignacion = Equipo & { asignacion_vigente: AsignacionVigente };
export type OsDeEquipo = {
  id: string;
  fecha: string;
  descripcion: string | null;
  estado: string;
  orden: { folio: number | null; estado_os: string | null } | null;
};
export type EquipoDetalle = EquipoConAsignacion & { historico_mantenciones: OsDeEquipo[] };
export type DocumentoConTipo = Documento & { tipo: { nombre: string } | null; estado: EstadoDocumento | null };

// Mismo criterio que el backend (equipos.ts): categoría Vehículo o con patente.
export function esVehiculo(e: Pick<Equipo, "categoria" | "patente">): boolean {
  return e.categoria === "Vehículo" || Boolean(e.patente?.trim());
}

export async function listarEquipos(): Promise<{ equipos: EquipoConAsignacion[]; desdeCache: boolean }> {
  const res = await apiJson<EquipoConAsignacion[]>("/api/equipos");
  if (res.ok) {
    await guardarCache("equipos:lista", res.data);
    return { equipos: res.data, desdeCache: false };
  }
  const cache = await leerCache<EquipoConAsignacion[]>("equipos:lista");
  if (!cache) throw new Error(res.error);
  return { equipos: cache.datos, desdeCache: true };
}

export async function obtenerEquipo(id: string): Promise<EquipoDetalle> {
  const res = await apiJson<EquipoDetalle>(`/api/equipos/${id}`);
  if (!res.ok) throw new Error(res.error);
  return res.data;
}

// El vehículo asignado hoy al usuario (chofer sin el módulo Flota).
export async function miVehiculo(): Promise<EquipoAsignadoConDocumentos | null> {
  const res = await apiJson<EquipoAsignadoConDocumentos | null>("/api/usuarios/me/vehiculo");
  if (!res.ok) throw new Error(res.error);
  return res.data;
}

export type CambiosEquipo = Partial<
  Pick<Equipo, "nombre" | "categoria" | "marca" | "modelo" | "numero_serie" | "patente" | "tipo_vehiculo" | "capacidad_carga" | "anio" | "garantia_vencimiento" | "notas">
>;

export async function actualizarEquipo(id: string, cambios: CambiosEquipo): Promise<{ ok: true } | { ok: false; error: string }> {
  const res = await apiJson<Equipo>(`/api/equipos/${id}`, { method: "PATCH", body: JSON.stringify(cambios) });
  return res.ok ? { ok: true } : { ok: false, error: res.error };
}

// Estado de documentos de toda la flota (solo con el módulo Flota): para
// marcar en la lista los vehículos con documentos vencidos o por vencer.
export async function alertasDocumentos(): Promise<Map<string, EstadoDocumento>> {
  const res = await apiJson<{ entidad_tipo: string; entidad_id: string; estado: EstadoDocumento | null }[]>("/api/documentos/por-vencer");
  const mapa = new Map<string, EstadoDocumento>();
  if (!res.ok) return mapa;
  for (const d of res.data) {
    if (d.entidad_tipo !== "vehiculo" || !d.estado || d.estado === "vigente") continue;
    if (mapa.get(d.entidad_id) !== "vencido") mapa.set(d.entidad_id, d.estado);
  }
  return mapa;
}

// ── Documentos del vehículo ──
export async function listarDocumentosVehiculo(equipoId: string): Promise<DocumentoConTipo[]> {
  const res = await apiJson<DocumentoConTipo[]>(`/api/documentos?entidad_tipo=vehiculo&entidad_id=${encodeURIComponent(equipoId)}`);
  if (!res.ok) throw new Error(res.error);
  return res.data;
}

export async function tiposDocumentoVehiculo(): Promise<TipoDocumento[]> {
  const res = await apiJson<TipoDocumento[]>("/api/tipos-documento");
  if (!res.ok) return [];
  return res.data.filter((t) => t.activo && (t.aplica_a === "vehiculo" || t.aplica_a === "ambos"));
}

export type ArchivoDocumento = { uri: string; name: string; type: string };
export type BorradorDocumento = {
  id?: string;
  equipoId: string;
  tipoDocumentoId: string;
  numero: string;
  fechaEmision: string | null;
  fechaVencimiento: string | null;
  archivo: ArchivoDocumento | null;
};

// Con conexión (archivo pesado): no pasa por la cola offline.
export async function guardarDocumento(b: BorradorDocumento): Promise<{ ok: true } | { ok: false; error: string }> {
  const fd = new FormData();
  if (!b.id) {
    fd.append("entidad_tipo", "vehiculo");
    fd.append("entidad_id", b.equipoId);
  }
  fd.append("tipo_documento_id", b.tipoDocumentoId);
  fd.append("numero", b.numero.trim());
  fd.append("fecha_emision", b.fechaEmision ?? "");
  fd.append("fecha_vencimiento", b.fechaVencimiento ?? "");
  // RN acepta { uri, name, type } como archivo del multipart.
  if (b.archivo) fd.append("archivo", b.archivo as unknown as Blob);
  try {
    const res = await apiFetch(b.id ? `/api/documentos/${b.id}` : "/api/documentos", { method: b.id ? "PATCH" : "POST", body: fd }, TIMEOUT_MULTIPART_MS);
    if (res.ok) return { ok: true };
    const body = await res.json().catch(() => ({}));
    return { ok: false, error: (body as { error?: string }).error ?? `Error ${res.status}` };
  } catch {
    return { ok: false, error: "No se pudo conectar. Para subir documentos necesitas conexión." };
  }
}

export async function borrarDocumento(id: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const res = await apiJson<null>(`/api/documentos/${id}`, { method: "DELETE" });
  return res.ok ? { ok: true } : { ok: false, error: res.error };
}

// URL firmada y temporal del archivo (la abre el navegador del teléfono).
export async function urlArchivoDocumento(id: string): Promise<string> {
  const res = await apiJson<{ url: string }>(`/api/documentos/${id}/archivo`);
  if (!res.ok) throw new Error(res.error);
  return res.data.url;
}

// ── Plan de mantención preventiva ──
export async function planesDeEquipo(equipoId: string): Promise<PlanMantencion[]> {
  const res = await apiJson<PlanMantencion[]>(`/api/planes-mantencion?equipo_id=${encodeURIComponent(equipoId)}`);
  return res.ok ? res.data : [];
}

export type BorradorPlan = { frecuencia_dias: number; proxima_fecha: string; notas: string };

export async function guardarPlan(equipoId: string, b: BorradorPlan, planId?: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const res = planId
    ? await apiJson<PlanMantencion>(`/api/planes-mantencion/${planId}`, { method: "PATCH", body: JSON.stringify(b) })
    : await apiJson<PlanMantencion>("/api/planes-mantencion", { method: "POST", body: JSON.stringify({ equipo_id: equipoId, ...b }) });
  return res.ok ? { ok: true } : { ok: false, error: res.error };
}

export async function cambiarEstadoPlan(planId: string, activo: boolean): Promise<{ ok: true } | { ok: false; error: string }> {
  const res = await apiJson<PlanMantencion>(`/api/planes-mantencion/${planId}`, { method: "PATCH", body: JSON.stringify({ activo }) });
  return res.ok ? { ok: true } : { ok: false, error: res.error };
}

export async function borrarPlan(planId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const res = await apiJson<null>(`/api/planes-mantencion/${planId}`, { method: "DELETE" });
  return res.ok ? { ok: true } : { ok: false, error: res.error };
}

// ── Asignación del vehículo (módulo Flota) ──
export async function colaboradoresAsignables(): Promise<Usuario[]> {
  const res = await apiJson<Usuario[]>("/api/usuarios");
  if (!res.ok) return [];
  return res.data.filter((u) => u.activo && u.rol === "colaborador");
}

export async function asignarVehiculo(equipoId: string, colaboradorId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const res = await apiJson<unknown>(`/api/equipos/${equipoId}/asignar`, { method: "POST", body: JSON.stringify({ colaborador_id: colaboradorId }) });
  return res.ok ? { ok: true } : { ok: false, error: res.error };
}

export async function desasignarVehiculo(equipoId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const res = await apiJson<unknown>(`/api/equipos/${equipoId}/desasignar`, { method: "POST" });
  return res.ok ? { ok: true } : { ok: false, error: res.error };
}
