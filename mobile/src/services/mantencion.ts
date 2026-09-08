import type {
  Equipo,
  ItemChecklistMantencion,
  RespuestaChecklistMantencion,
  TipoRegistroMantencion,
} from "@bitacora/shared";
import { apiJson } from "./api";
import { encolar } from "./sync/queue";
import { guardarCache, leerCache } from "./sync/cache";

export type PlantillaMantencion = {
  nombre: string;
  secciones: { nombre: string; preguntas: { texto: string; obligatorio: boolean }[] }[];
};

export type MantencionResumen = {
  id: string;
  tipo: TipoRegistroMantencion;
  origen: "interno" | "externo";
  kilometraje: number | null;
  horas_motor: number | null;
  creado_en: string;
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

export async function obtenerMantencionInicio(): Promise<{ datos: MantencionInicio; desdeCache: boolean }> {
  const res = await apiJson<MantencionInicio>("/api/usuarios/me/vehiculo/registros-mantencion");
  if (res.ok) {
    await guardarCache("mantencion:inicio", res.data);
    return { datos: res.data, desdeCache: false };
  }
  const cache = await leerCache<MantencionInicio>("mantencion:inicio");
  return { datos: cache?.datos ?? { vehiculo: null, registros: [] }, desdeCache: true };
}

export type BorradorMantencion = {
  equipoId: string;
  tipo: TipoRegistroMantencion;
  checklist: ItemChecklistMantencion[];
  kilometraje: string; // solo dígitos
  horas_motor: string;
  observaciones: string;
  proveedor_id?: string;
  firma_base64?: string | null;
  fotos_base64?: string[];
};

function cuerpo(b: BorradorMantencion) {
  return {
    tipo: b.tipo,
    checklist: b.checklist,
    kilometraje: b.kilometraje.trim() === "" ? null : Number(b.kilometraje),
    horas_motor: b.horas_motor.trim() === "" ? null : Number(b.horas_motor),
    observaciones: b.observaciones.trim() || null,
    proveedor_id: b.tipo === "programa" ? b.proveedor_id : undefined,
    firma_base64: b.tipo === "programa" ? b.firma_base64 ?? undefined : undefined,
    fotos_base64: b.fotos_base64 && b.fotos_base64.length ? b.fotos_base64 : undefined,
  };
}

// Registro completo en UNA acción de la cola offline (checklist + firma +
// fotos van en el body JSON, así no dependemos del id del servidor). El
// backend igual acepta fotos por multipart aparte, que usa el web.
export async function crearRegistroMantencion(
  b: BorradorMantencion
): Promise<{ ok: true } | { ok: false; error: string; reintentable: boolean }> {
  const res = await apiJson(`/api/equipos/${b.equipoId}/registros-mantencion`, {
    method: "POST",
    body: JSON.stringify(cuerpo(b)),
  });
  if (res.ok) return { ok: true };
  return { ok: false, error: res.error ?? "No se pudo guardar", reintentable: res.status >= 500 || res.status === 0 };
}

export async function encolarRegistroMantencion(b: BorradorMantencion): Promise<void> {
  await encolar({
    etiqueta: "Registro de mantención",
    recurso: `mantencion:${b.equipoId}`,
    path: `/api/equipos/${b.equipoId}/registros-mantencion`,
    method: "POST",
    body: cuerpo(b),
  });
}

export const respuestaTexto: Record<RespuestaChecklistMantencion, string> = { si: "Sí", no: "No", na: "N/A" };
