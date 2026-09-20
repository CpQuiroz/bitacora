import type { CategoriaGasto, CentroCosto, EstadoGasto, Gasto, Proveedor } from "@bitacora/shared";
import { apiJson } from "./api";
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

// "Crear al vuelo" desde Nuevo gasto (20-sep-2026) — necesita conexión
// (no tiene sentido encolar la creación de un proveedor/categoría
// offline: el picker necesita el id real para poder elegirlo ya
// mismo). Proveedor: sin restricción de módulo en el backend, cualquier
// rol puede crear uno. Categoría SÍ está gateada a `requiereModulo
// ("configuracion")` — por diseño, ver packages/shared/src/permisos.ts
// (excluido a propósito de MODULOS_DELEGABLES_POR_EMPRESA) — por eso
// NuevoGastoScreen solo ofrece "crear categoría" cuando
// modulosVisibles la incluye, para no mostrarle a un colaborador un
// botón que le va a dar 403.
export async function crearProveedor(nombre: string): Promise<{ ok: true; proveedor: Proveedor } | { ok: false; error: string }> {
  const res = await apiJson<Proveedor>("/api/proveedores", { method: "POST", body: JSON.stringify({ nombre }) });
  if (res.ok) return { ok: true, proveedor: res.data };
  return { ok: false, error: res.error };
}

export async function crearCategoriaGasto(nombre: string): Promise<{ ok: true; categoria: CategoriaGasto } | { ok: false; error: string }> {
  const res = await apiJson<CategoriaGasto>("/api/categorias-gasto", { method: "POST", body: JSON.stringify({ nombre }) });
  if (res.ok) return { ok: true, categoria: res.data };
  return { ok: false, error: res.error };
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
 * la encola aparte contra el gasto ya creado — el gasto nunca se pierde
 * aunque la foto falle o no haya señal.
 *
 * El comprobante SIEMPRE va por la cola (`comprobantePendiente` siempre
 * `true` si hay foto), nunca se intenta subir inline. Mismo bug real
 * (14-sep-2026) encontrado y corregido en services/viajes.ts
 * (crearViaje): había un intento inline (`subirComprobante`, eliminado)
 * antes de encolar como respaldo — un multipart que "timeoutea" en el
 * celular NO se puede cancelar de verdad en RN (ver TIMEOUT_MULTIPART_MS
 * en api.ts), así que si ese intento fallaba y encolábamos la foto como
 * respaldo, quedaban DOS subidas del MISMO comprobante viajando a la vez
 * por la conexión real del celular — en señal mala ninguna termina
 * nunca. Ver el comentario largo en crearViaje (viajes.ts) para el
 * detalle completo.
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
    await encolarComprobante(res.data.id, foto);
    comprobantePendiente = true;
  }
  return { ok: true, gasto: res.data, comprobantePendiente };
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
