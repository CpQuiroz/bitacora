import type { CategoriaGasto, CentroCosto, EstadoGasto, Gasto, Proveedor } from "@bitacora/shared";
import { apiFetch, apiJson } from "./api";
import { encolar } from "./sync/queue";
import { guardarCache, leerCache } from "./sync/cache";

// Mismos endpoints que ya usa la web (web/src/app/dashboard/gastos) —
// acá solo se consumen, sin duplicar ninguna agregación.

export async function listarCategoriasGasto(): Promise<CategoriaGasto[]> {
  const res = await apiJson<CategoriaGasto[]>("/api/categorias-gasto");
  if (res.ok) {
    await guardarCache("gastos:categorias", res.data);
    return res.data;
  }
  return (await leerCache<CategoriaGasto[]>("gastos:categorias"))?.datos ?? [];
}

export async function listarCentrosCosto(): Promise<CentroCosto[]> {
  const res = await apiJson<CentroCosto[]>("/api/centros-costo");
  if (res.ok) {
    await guardarCache("gastos:centros-costo", res.data);
    return res.data;
  }
  return (await leerCache<CentroCosto[]>("gastos:centros-costo"))?.datos ?? [];
}

export async function listarProveedores(): Promise<Proveedor[]> {
  const res = await apiJson<Proveedor[]>("/api/proveedores");
  if (res.ok) {
    await guardarCache("gastos:proveedores", res.data);
    return res.data;
  }
  return (await leerCache<Proveedor[]>("gastos:proveedores"))?.datos ?? [];
}

export type Foto = { uri: string; name: string; type: string };

export type BorradorGasto = {
  descripcion: string;
  monto: string; // solo dígitos (InputMonto)
  categoria_gasto_id: string;
  centro_costo_id: string;
  proveedor_id: string;
  trabajo_id: string;
  fecha: string;
  estado: EstadoGasto;
  fecha_pago: string;
};

function cuerpoGasto(b: BorradorGasto) {
  return {
    descripcion: b.descripcion.trim() || undefined,
    monto: Number(b.monto || 0),
    categoria_gasto_id: b.categoria_gasto_id || undefined,
    centro_costo_id: b.centro_costo_id || undefined,
    proveedor_id: b.proveedor_id || undefined,
    trabajo_id: b.trabajo_id || undefined,
    fecha: b.fecha,
    estado: b.estado,
    fecha_pago: b.estado === "pagado" ? b.fecha_pago || b.fecha : undefined,
  };
}

export type ResultadoCrearGasto =
  | { ok: true; gasto: Gasto; comprobantePendiente: boolean }
  | { ok: false; error: string; reintentable: boolean };

/**
 * Crea el gasto (JSON, con reintentos) y, si hay foto del comprobante,
 * la sube aparte contra el gasto ya creado — mismo patrón que
 * services/viajes.ts (crearViaje + subirFotoGuia): el gasto nunca se
 * pierde aunque la foto falle.
 */
export async function crearGasto(b: BorradorGasto, foto?: Foto): Promise<ResultadoCrearGasto> {
  const res = await apiJson<Gasto>("/api/gastos", { method: "POST", body: JSON.stringify(cuerpoGasto(b)) });

  if (!res.ok) {
    if (res.status === 401) {
      return { ok: false, error: "Tu sesión venció. Sal y vuelve a entrar para registrar el gasto.", reintentable: false };
    }
    const reintentable = res.status === 0 || res.status >= 500;
    return { ok: false, error: res.error, reintentable };
  }

  let comprobantePendiente = false;
  if (foto) {
    const okFoto = await subirComprobante(res.data.id, foto);
    if (!okFoto) {
      await encolarComprobante(res.data.id, foto);
      comprobantePendiente = true;
    }
  }
  return { ok: true, gasto: res.data, comprobantePendiente };
}

/** Sube el comprobante a un gasto ya creado. `true` si quedó guardado. */
export async function subirComprobante(gastoId: string, foto: Foto): Promise<boolean> {
  const fd = new FormData();
  fd.append("comprobante", { uri: foto.uri, name: foto.name, type: foto.type } as unknown as Blob);
  try {
    const res = await apiFetch(`/api/gastos/${gastoId}`, { method: "PATCH", body: fd }, 45000);
    return res.ok;
  } catch {
    return false;
  }
}

export function encolarComprobante(gastoId: string, foto: Foto) {
  return encolar({
    etiqueta: "Comprobante de gasto",
    recurso: "gastos",
    path: `/api/gastos/${gastoId}`,
    method: "PATCH",
    body: {},
    archivo: { ...foto, campo: "comprobante" },
  });
}

/** Respaldo: encola la creación completa (JSON, + comprobante si hay). */
export function encolarGasto(b: BorradorGasto, foto?: Foto) {
  return encolar({
    etiqueta: "Registrar gasto",
    recurso: "gastos",
    path: "/api/gastos",
    method: "POST",
    body: cuerpoGasto(b),
    archivo: foto ? { ...foto, campo: "comprobante" } : undefined,
  });
}
