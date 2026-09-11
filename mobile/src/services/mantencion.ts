import type {
  Equipo,
  ItemChecklistMantencion,
  RespuestaChecklistMantencion,
  TipoRegistroMantencion,
} from "@bitacora/shared";
import { apiFetch, apiJson, TIMEOUT_MULTIPART_MS } from "./api";
import { encolar } from "./sync/queue";
import { guardarCache, leerCache } from "./sync/cache";

export type PlantillaMantencion = {
  nombre: string;
  secciones: { nombre: string; preguntas: { texto: string; obligatorio: boolean }[] }[];
};

export type MantencionResumen = {
  id: string;
  folio: number | null;
  fecha: string;
  tipo: TipoRegistroMantencion;
  origen: "interno" | "externo";
  kilometraje: number | null;
  horas_motor: number | null;
  creado_en: string;
  realizado_por_nombre?: string | null;
  con_novedades: boolean;
};

export type MantencionInicio = {
  vehiculo: Equipo | null;
  registros: MantencionResumen[];
};

const PLANTILLA_FALLBACK: PlantillaMantencion = {
  nombre: "Mantención de flota",
  secciones: [
    { nombre: "Motor y filtros", preguntas: ["Aceite de motor", "Filtro de aceite del motor", "Filtro de combustible", "Filtro de aire", "Filtro decantador de agua", "Correa de accesorios"] },
    { nombre: "Niveles y fluidos", preguntas: ["Refrigerante de motor", "Aceite de dirección", "Aceite de diferenciales", "Aceite de mazas ejes direccional", "Aceite de mazas ejes traseros", "Aceite de transmisión", "Líquido limpiaparabrisas"] },
    { nombre: "Embrague y transmisión", preguntas: ["Ajuste de embrague", "Engrasado de embrague", "Rodamiento de embrague", "Collarín del embrague"] },
    { nombre: "Dirección y suspensión", preguntas: ["Terminal de dirección", "Rótulas de brazo viajero", "Rótulas de barra estabilizadora", "Pernos de muelle", "Cruceta flecha de dirección", "Crucetas de flecha intereje", "Flechas deslizables"] },
    { nombre: "Frenos", preguntas: ["Ajustadores de freno delantero", "Ajustadores de frenos traseros", "Sistema de frenos de aire / válvulas"] },
    { nombre: "Neumáticos y eléctrico", preguntas: ["Presión de neumáticos", "Profundidad banda de rodado", "Estado llanta de repuesto", "Batería y terminales", "Luces y señalización"] },
    { nombre: "Seguridad y documentación", preguntas: ["Extintor vigente", "Botiquín / kit de emergencia", "Triángulos y conos de seguridad"] },
  ].map((s) => ({ nombre: s.nombre, preguntas: s.preguntas.map((texto) => ({ texto, obligatorio: true })) })),
};

export async function obtenerPlantillaMantencion(): Promise<PlantillaMantencion> {
  const res = await apiJson<PlantillaMantencion>("/api/equipos/registros-mantencion/plantilla");
  if (res.ok && res.data?.secciones?.length) {
    await guardarCache("mantencion:plantilla", res.data);
    return res.data;
  }
  return (await leerCache<PlantillaMantencion>("mantencion:plantilla"))?.datos ?? PLANTILLA_FALLBACK;
}

export async function obtenerMantencionInicio(
  limite = 4
): Promise<{ datos: MantencionInicio; desdeCache: boolean }> {
  const res = await apiJson<MantencionInicio>(`/api/usuarios/me/vehiculo/registros-mantencion?limite=${limite}`);
  if (res.ok) {
    await guardarCache("mantencion:inicio", res.data);
    return { datos: res.data, desdeCache: false };
  }
  const cache = await leerCache<MantencionInicio>("mantencion:inicio");
  return { datos: cache?.datos ?? { vehiculo: null, registros: [] }, desdeCache: true };
}

// Historial completo de un vehículo — para "Ver todas" y para cuando un
// admin/supervisor cambia de camión (el endpoint /me/... solo trae el
// asignado). Requiere gestionar Flota.
export async function obtenerHistorialEquipo(
  equipoId: string
): Promise<{ registros: MantencionResumen[]; error: string | null }> {
  const res = await apiJson<
    (MantencionResumen & { checklist?: { respuesta?: string }[]; proveedor?: { nombre: string } | null; responsable?: { nombre: string } | null })[]
  >(`/api/equipos/${equipoId}/registros-mantencion`);
  if (!res.ok) return { registros: [], error: res.error ?? "No se pudo cargar el historial" };
  const registros = res.data.map((r) => ({
    id: r.id,
    folio: r.folio ?? null,
    fecha: r.fecha,
    tipo: r.tipo,
    origen: r.origen,
    kilometraje: r.kilometraje,
    horas_motor: r.horas_motor,
    creado_en: r.creado_en,
    realizado_por_nombre: r.origen === "externo" ? (r.proveedor?.nombre ?? null) : (r.responsable?.nombre ?? null),
    con_novedades: Array.isArray(r.checklist) && r.checklist.some((i) => i?.respuesta === "no"),
  }));
  return { registros, error: null };
}

export async function listarVehiculos(): Promise<Equipo[]> {
  const res = await apiJson<Equipo[]>("/api/equipos");
  const lista = res.ok ? res.data : ((await leerCache<Equipo[]>("mantencion:vehiculos"))?.datos ?? []);
  if (res.ok) await guardarCache("mantencion:vehiculos", res.data);
  return lista.filter((e) => e.categoria === "Vehículo" && e.activo);
}

// La foto es un archivo en el teléfono (uri), NUNCA base64 en el body.
export type FotoMantencion = { item: string | null; uri: string; name?: string; type?: string };

export type BorradorMantencion = {
  equipoId: string;
  tipo: TipoRegistroMantencion;
  fecha: string; // YYYY-MM-DD
  checklist: ItemChecklistMantencion[];
  kilometraje: string; // solo dígitos
  horas_motor: string;
  observaciones: string;
  proveedor_id?: string;
  firma_base64?: string | null;
  fotos?: FotoMantencion[];
};

// Campos de texto del registro (sin fotos) — sirve tanto para el body
// JSON (sin fotos) como para los campos de texto del multipart (con fotos).
function camposTexto(b: BorradorMantencion) {
  return {
    tipo: b.tipo,
    fecha: b.fecha,
    checklist: JSON.stringify(b.checklist),
    kilometraje: b.kilometraje.trim() === "" ? "" : String(Number(b.kilometraje)),
    horas_motor: b.horas_motor.trim() === "" ? "" : String(Number(b.horas_motor)),
    observaciones: b.observaciones.trim() || "",
    proveedor_id: b.tipo === "programa" ? (b.proveedor_id ?? "") : "",
    firma_base64: b.tipo === "programa" ? (b.firma_base64 ?? "") : "",
  };
}

function archivosDe(b: BorradorMantencion) {
  return (b.fotos ?? []).map((f, i) => ({
    campo: "fotos",
    uri: f.uri,
    name: f.name ?? `mantencion-${i}.jpg`,
    type: f.type ?? "image/jpeg",
  }));
}

function formDataDe(b: BorradorMantencion): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(camposTexto(b))) if (v !== "") fd.append(k, v);
  fd.append("fotos_items", JSON.stringify((b.fotos ?? []).map((f) => f.item)));
  for (const a of archivosDe(b)) {
    fd.append("fotos", { uri: a.uri, name: a.name, type: a.type } as unknown as Blob);
  }
  return fd;
}

// PASO 0 — hallazgo del bug 413 "request entity too large" al guardar
// "Chequeo diario" CON foto:
//   · Pantalla: mobile/src/features/mantencion/ChecklistMantencionScreen.tsx
//     — hoy lee cada foto a base64 y la mete en `fotos:[{item,base64}]`.
//   · Este servicio: `cuerpo()` arma ese JSON; crearRegistroMantencion lo
//     manda con apiJson (Content-Type: application/json).
//   · Endpoint: POST /api/equipos/:equipoId/registros-mantencion
//     (backend/src/routes/registrosMantencion.ts) — handler JSON puro.
//   · Tabla: registros_mantencion_equipo + registro_mantencion_fotos
//     (migración 96/97). `registro_mantencion_fotos.foto_url` guarda la
//     KEY de Storage — la foto NO debe ir en la fila ni en el JSON.
//   · Causa: server.ts monta `express.json()` sin `limit` → default 100 kb.
//     Una foto (aunque comprimida) en base64 supera eso → 413 antes de
//     llegar al handler. Sin foto (< 100 kb) guarda bien.
//   · Puede haber varias fotos por chequeo (una por ítem en "no" + generales).
// Fix: la foto viaja por multipart/form-data como archivo (patrón de
// trabajos.ts), NO en el JSON. Ver crearRegistroMantencion abajo.
export async function crearRegistroMantencion(
  b: BorradorMantencion
): Promise<{ ok: true } | { ok: false; error: string; reintentable: boolean }> {
  const path = `/api/equipos/${b.equipoId}/registros-mantencion`;
  const conFotos = Boolean(b.fotos && b.fotos.length);

  if (conFotos) {
    // multipart: la foto viaja como archivo, nunca en el body.
    try {
      const res = await apiFetch(path, { method: "POST", body: formDataDe(b) }, TIMEOUT_MULTIPART_MS);
      if (res.ok) return { ok: true };
      const cuerpoErr = await res.json().catch(() => ({}));
      return {
        ok: false,
        error: (cuerpoErr as { error?: string }).error ?? `Error ${res.status}`,
        reintentable: res.status >= 500,
      };
    } catch {
      return { ok: false, error: "Sin conexión", reintentable: true };
    }
  }

  const res = await apiJson(path, {
    method: "POST",
    body: JSON.stringify({ ...camposTexto(b), checklist: b.checklist }),
  });
  if (res.ok) return { ok: true };
  return { ok: false, error: res.error ?? "No se pudo guardar", reintentable: res.status >= 500 || res.status === 0 };
}

export async function encolarRegistroMantencion(b: BorradorMantencion): Promise<void> {
  const comun = {
    etiqueta: "Registro de mantención",
    recurso: `mantencion:${b.equipoId}`,
    path: `/api/equipos/${b.equipoId}/registros-mantencion`,
    method: "POST" as const,
  };
  if (b.fotos && b.fotos.length) {
    // Con fotos: se encola como multipart — los campos de texto + el
    // fotos_items en `body`, los archivos en `archivos`.
    await encolar({
      ...comun,
      body: { ...camposTexto(b), fotos_items: JSON.stringify(b.fotos.map((f) => f.item)) },
      archivos: archivosDe(b),
    });
    return;
  }
  await encolar({ ...comun, body: { ...camposTexto(b), checklist: b.checklist } });
}

export const respuestaTexto: Record<RespuestaChecklistMantencion, string> = { si: "Sí", no: "No", na: "N/A" };

// ============================================================
// Detalle de un registro ya creado — checklist + fotos (agregar/
// eliminar). El registro en sí sigue inmutable; solo las fotos de
// respaldo se pueden completar/corregir después (2026-09-11).
// ============================================================
export type FotoRegistro = { id: string; url: string; item: string | null; creado_en: string };
export type DetalleMantencion = {
  id: string;
  fecha: string;
  folio: number | null;
  tipo: TipoRegistroMantencion;
  origen: "interno" | "externo";
  kilometraje: number | null;
  horas_motor: number | null;
  observaciones: string | null;
  checklist: ItemChecklistMantencion[];
  proveedor: { nombre: string } | null;
  responsable: { nombre: string } | null;
  fotos: FotoRegistro[];
};

export async function obtenerDetalleRegistro(
  equipoId: string,
  registroId: string
): Promise<{ detalle: DetalleMantencion | null; error: string | null }> {
  const res = await apiJson<DetalleMantencion>(`/api/equipos/${equipoId}/registros-mantencion/${registroId}`);
  if (!res.ok) return { detalle: null, error: res.error ?? "No se pudo cargar el detalle" };
  return { detalle: res.data, error: null };
}

export async function subirFotoARegistro(
  equipoId: string,
  registroId: string,
  foto: { uri: string; name?: string; type?: string },
  item: string | null
): Promise<{ ok: true; foto: FotoRegistro } | { ok: false; error: string }> {
  const fd = new FormData();
  if (item) fd.append("item", item);
  fd.append("foto", { uri: foto.uri, name: foto.name ?? "foto.jpg", type: foto.type ?? "image/jpeg" } as unknown as Blob);
  try {
    const res = await apiFetch(`/api/equipos/${equipoId}/registros-mantencion/${registroId}/fotos`, { method: "POST", body: fd }, TIMEOUT_MULTIPART_MS);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      return { ok: false, error: (body as { error?: string }).error ?? `Error ${res.status}` };
    }
    return { ok: true, foto: await res.json() };
  } catch {
    return { ok: false, error: "Sin conexión" };
  }
}

export async function eliminarFotoDeRegistro(
  equipoId: string,
  registroId: string,
  fotoId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const res = await apiFetch(`/api/equipos/${equipoId}/registros-mantencion/${registroId}/fotos/${fotoId}`, { method: "DELETE" });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      return { ok: false, error: (body as { error?: string }).error ?? `Error ${res.status}` };
    }
    return { ok: true };
  } catch {
    return { ok: false, error: "Sin conexión" };
  }
}
