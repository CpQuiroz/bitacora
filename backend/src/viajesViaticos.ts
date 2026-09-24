// ============================================================
// Viáticos por viaje (tarea 137, 24-sep-2026). El viático es siempre del
// chofer asignado al viaje y se registra como un gasto de categoría
// "Viáticos" (gastos.es_viatico, gastos.viaje_id), pendiente hasta que
// se le paga al chofer. Un viaje tiene a lo más un gasto de viático
// (índice único idx_gastos_viatico_viaje). Solo Admin y Supervisor lo
// definen; no sale en el cobro ni en su PDF.
//
// Una vez pagado, el viático queda congelado: no se cambia su monto/tipo
// ni el chofer del viaje, ni se borra el viaje. Para corregirlo se marca
// el gasto como pendiente en Gastos.
// ============================================================
import type { AgruparViaticos, FilaResumenViaticos, TipoViatico } from "@bitacora/shared";
import { formatearFolio } from "@bitacora/shared";
import { supabase } from "./supabase";
import { siguienteFolioGasto } from "./folios";

export const CATEGORIA_VIATICOS = "Viáticos";
const TIPOS: TipoViatico[] = ["local", "interregional"];

export type Viatico = { tipo: TipoViatico; monto: number } | null;

// Lee viatico_tipo/viatico_monto del body. Ambos ausentes = no se toca;
// tipo vacío o null = quitar el viático.
export function leerViatico(tipo: unknown, monto: unknown): { sinCambio: true } | { viatico: Viatico } | { error: string } {
  if (tipo === undefined && monto === undefined) return { sinCambio: true };
  if (tipo === null || tipo === "" || tipo === "ninguno") return { viatico: null };
  if (typeof tipo !== "string" || !TIPOS.includes(tipo as TipoViatico)) {
    return { error: "El viático debe ser local o interregional" };
  }
  const n = Number(monto);
  if (monto === null || monto === undefined || monto === "" || !Number.isFinite(n) || n < 0) {
    return { error: "Monto de viático inválido" };
  }
  return { viatico: { tipo: tipo as TipoViatico, monto: Math.round(n) } };
}

export function mismoViatico(a: Viatico, b: Viatico): boolean {
  if (!a || !b) return a === b;
  return a.tipo === b.tipo && Number(a.monto) === Number(b.monto);
}

export function viaticoDeViaje(v: { viatico_tipo: TipoViatico | null; viatico_monto: number | null }): Viatico {
  return v.viatico_tipo ? { tipo: v.viatico_tipo, monto: Number(v.viatico_monto ?? 0) } : null;
}

export type GastoViatico = { id: string; estado: "pagado" | "pendiente"; folio: number | null };

export async function gastoViaticoDe(empresaId: string, viajeId: string): Promise<GastoViatico | null> {
  const { data } = await supabase
    .from("gastos")
    .select("id, estado, folio")
    .eq("empresa_id", empresaId)
    .eq("viaje_id", viajeId)
    .eq("es_viatico", true)
    .maybeSingle();
  return (data as GastoViatico | null) ?? null;
}

export function errorViaticoPagado(gasto: GastoViatico): string {
  const folio = formatearFolio("GTO", gasto.folio);
  return `El viático de este viaje ya se pagó al chofer${folio ? ` (${folio})` : ""}. Para cambiarlo, márcalo como pendiente en Gastos.`;
}

async function categoriaViaticos(empresaId: string): Promise<{ id: string; nombre: string } | null> {
  const buscar = () =>
    supabase.from("categorias_gasto").select("id, nombre").eq("empresa_id", empresaId).eq("nombre", CATEGORIA_VIATICOS).maybeSingle();
  const { data } = await buscar();
  if (data) return data;
  const { data: creada } = await supabase
    .from("categorias_gasto")
    .insert({ empresa_id: empresaId, nombre: CATEGORIA_VIATICOS })
    .select("id, nombre")
    .maybeSingle();
  if (creada) return creada;
  // Otra petición la creó a la vez (índice único empresa+nombre).
  const { data: otra } = await buscar();
  return otra ?? null;
}

// chofer viene del embed chofer:usuarios(id, nombre); el tipo generado
// de la BD no conoce la relación, por eso se lee con cuidado.
type ViajeParaViatico = {
  id: string;
  fecha: string;
  numero_guia: string;
  chofer?: unknown;
};

function nombreChofer(chofer: unknown): string | null {
  const nombre = chofer && typeof chofer === "object" && "nombre" in chofer ? (chofer as { nombre: unknown }).nombre : null;
  return typeof nombre === "string" && nombre ? nombre : null;
}

// Deja el gasto de viático del viaje igual al viático indicado: lo crea,
// lo actualiza o (si viatico es null) lo borra. Nunca toca un gasto
// pagado: las rutas lo bloquean antes con errorViaticoPagado, y si se
// pagó justo entre ese chequeo y este paso (carrera con "Marcar pagado")
// devuelve { pagado } para que la ruta deshaga el cambio del viaje.
export type ResultadoSync = { ok: true } | { error: string } | { pagado: GastoViatico };

export async function sincronizarGastoViatico(empresaId: string, viaje: ViajeParaViatico, viatico: Viatico): Promise<ResultadoSync> {
  const existente = await gastoViaticoDe(empresaId, viaje.id);
  if (existente?.estado === "pagado") return { pagado: existente };

  if (!viatico) {
    if (!existente) return { ok: true };
    const { data, error } = await supabase
      .from("gastos")
      .delete()
      .eq("empresa_id", empresaId)
      .eq("id", existente.id)
      .eq("estado", "pendiente")
      .select("id");
    if (error) return { error: error.message };
    return data?.length ? { ok: true } : { pagado: { ...existente, estado: "pagado" } };
  }

  const chofer = nombreChofer(viaje.chofer);
  const descripcion = `Viático ${viatico.tipo} · Guía ${viaje.numero_guia}${chofer ? ` · ${chofer}` : ""}`;
  const actualizar = async (gasto: GastoViatico): Promise<ResultadoSync> => {
    const { data, error } = await supabase
      .from("gastos")
      .update({ monto: viatico.monto, fecha: viaje.fecha, descripcion })
      .eq("empresa_id", empresaId)
      .eq("id", gasto.id)
      .eq("estado", "pendiente")
      .select("id");
    if (error) return { error: error.message };
    return data?.length ? { ok: true } : { pagado: { ...gasto, estado: "pagado" } };
  };
  if (existente) return actualizar(existente);

  const categoria = await categoriaViaticos(empresaId);
  if (!categoria) return { error: "No se pudo crear la categoría Viáticos" };
  const folio = await siguienteFolioGasto(empresaId);
  const { error } = await supabase.from("gastos").insert({
    empresa_id: empresaId,
    categoria: categoria.nombre,
    categoria_gasto_id: categoria.id,
    descripcion,
    monto: viatico.monto,
    fecha: viaje.fecha,
    estado: "pendiente",
    viaje_id: viaje.id,
    es_viatico: true,
    folio,
  });
  if (!error) return { ok: true };
  if (error.code !== "23505") return { error: error.message };
  // 23505: otro guardado simultáneo ya creó el gasto de este viaje — se
  // le aplica este viático (gana el último guardado, igual que el viaje).
  const otro = await gastoViaticoDe(empresaId, viaje.id);
  if (!otro) return { error: "No se pudo registrar el viático" };
  return otro.estado === "pagado" ? { pagado: otro } : actualizar(otro);
}

// Borra un viaje junto con su viático pendiente, sin dejar gastos
// sueltos: primero el gasto (solo si sigue pendiente), después el viaje;
// si el viaje no se pudo borrar, el gasto se vuelve a crear. Un viático
// ya pagado impide borrar el viaje (409).
export async function borrarViajeConViatico(
  empresaId: string,
  viajeId: string
): Promise<{ ok: true } | { status: 409 | 500; error: string }> {
  const gasto = await gastoViaticoDe(empresaId, viajeId);
  const bloqueo = (g: GastoViatico) => ({ status: 409 as const, error: `${errorViaticoPagado(g).split(".")[0]}: no se puede eliminar el viaje.` });
  if (gasto?.estado === "pagado") return bloqueo(gasto);
  if (gasto) {
    const { data, error } = await supabase
      .from("gastos")
      .delete()
      .eq("empresa_id", empresaId)
      .eq("id", gasto.id)
      .eq("estado", "pendiente")
      .select("id");
    if (error) return { status: 500, error: error.message };
    if (!data?.length) return bloqueo({ ...gasto, estado: "pagado" });
  }
  const { error } = await supabase.from("viajes").delete().eq("empresa_id", empresaId).eq("id", viajeId);
  if (error) {
    if (gasto) {
      const { data: viaje } = await supabase
        .from("viajes")
        .select("id, fecha, numero_guia, viatico_tipo, viatico_monto, chofer:usuarios(nombre)")
        .eq("empresa_id", empresaId)
        .eq("id", viajeId)
        .maybeSingle();
      if (viaje) await sincronizarGastoViatico(empresaId, viaje, viaticoDeViaje(viaje));
    }
    return { status: 500, error: error.message };
  }
  return { ok: true };
}

// ---------- Resumen por chofer y período (Gastos › Viáticos) ----------

// Lunes de la semana (ISO) o primer día del mes de una fecha YYYY-MM-DD.
export function periodoDe(fecha: string, agrupar: AgruparViaticos): string {
  if (agrupar === "mes") return `${fecha.slice(0, 7)}-01`;
  const d = new Date(`${fecha}T00:00:00Z`);
  const dia = d.getUTCDay(); // 0 = domingo
  d.setUTCDate(d.getUTCDate() - (dia === 0 ? 6 : dia - 1));
  return d.toISOString().slice(0, 10);
}

export type GastoViaticoConChofer = {
  monto: number | string;
  estado: "pagado" | "pendiente";
  fecha: string;
  chofer_id: string | null;
  chofer: string | null;
};

export function resumirViaticos(gastos: GastoViaticoConChofer[], agrupar: AgruparViaticos): FilaResumenViaticos[] {
  const filas = new Map<string, FilaResumenViaticos>();
  for (const g of gastos) {
    const periodo = periodoDe(g.fecha, agrupar);
    const clave = `${periodo}|${g.chofer_id ?? ""}`;
    let f = filas.get(clave);
    if (!f) {
      f = { periodo, chofer_id: g.chofer_id, chofer: g.chofer ?? "Sin chofer", cantidad: 0, total: 0, pendiente: 0, pagado: 0 };
      filas.set(clave, f);
    }
    const monto = Number(g.monto) || 0;
    f.cantidad += 1;
    f.total += monto;
    if (g.estado === "pagado") f.pagado += monto;
    else f.pendiente += monto;
  }
  return [...filas.values()].sort((a, b) => b.periodo.localeCompare(a.periodo) || a.chofer.localeCompare(b.chofer, "es"));
}
