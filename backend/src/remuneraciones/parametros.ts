// ============================================================
// BITÁCORA — Módulo Remuneraciones: parámetros previsionales del período.
//
// UF y UTM se traen de mindicador.cl (gratis, sin key). El ingreso
// mínimo, los topes imponibles y la tabla de impuesto único NO están en
// mindicador — se siembran con los valores vigentes y el admin/contador
// los edita cuando la ley cambia (~1 vez al año).
//
// Patrón "sin cron" del proyecto: `asegurarParametros(periodo)` se llama
// al entrar al módulo y al generar liquidaciones; si falta la fila del
// período, la crea.
// ============================================================
import { AFP_CHILE, TRAMOS_IMPUESTO_UNICO_BASE } from "@bitacora/shared";
import type { ParametroPrevisional } from "@bitacora/shared";
import { supabase } from "../supabase";

// Valores vigentes a sembrar cuando se crea un período nuevo. Editables
// después desde la pantalla de Parámetros. REVISAR contra la ley al
// poner el módulo en producción.
const SEED = {
  ingresoMinimo: 529000,
  topeImponibleUf: 87.8,
  topeAfcUf: 131.9,
  tasaSis: 0.0188,
  tasaMutualBase: 0.009,
};

// Comisión de cada AFP (sobre la base imponible). REVISAR — cambian
// ocasionalmente (Superintendencia de Pensiones).
const COMISION_AFP: Record<string, number> = {
  capital: 0.0144,
  cuprum: 0.0144,
  habitat: 0.0127,
  modelo: 0.0058,
  planvital: 0.0116,
  provida: 0.0145,
  uno: 0.0049,
};

async function traerUfUtm(): Promise<{ uf: number; utm: number } | null> {
  try {
    const res = await fetch("https://mindicador.cl/api", { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    const d = (await res.json()) as { uf?: { valor: number }; utm?: { valor: number } };
    if (typeof d.uf?.valor !== "number" || typeof d.utm?.valor !== "number") return null;
    return { uf: d.uf.valor, utm: d.utm.valor };
  } catch {
    return null;
  }
}

export async function obtenerParametros(periodo: string): Promise<ParametroPrevisional | null> {
  const { data } = await supabase.from("parametros_previsionales").select("*").eq("periodo", periodo).maybeSingle();
  return data as ParametroPrevisional | null;
}

/**
 * Devuelve los parámetros del período, creándolos con los valores
 * vigentes si no existen. Si mindicador.cl no responde y no hay fila
 * previa, devuelve null (el llamador avisa "carga la UF/UTM a mano").
 */
export async function asegurarParametros(periodo: string): Promise<ParametroPrevisional | null> {
  const existente = await obtenerParametros(periodo);
  if (existente) return existente;

  const indicadores = await traerUfUtm();
  if (!indicadores) return null;

  const topeGratificacion = Math.round((4.75 * SEED.ingresoMinimo) / 12);

  const { data, error } = await supabase
    .from("parametros_previsionales")
    .insert({
      periodo,
      uf: indicadores.uf,
      utm: indicadores.utm,
      ingreso_minimo: SEED.ingresoMinimo,
      tope_imponible_uf: SEED.topeImponibleUf,
      tope_afc_uf: SEED.topeAfcUf,
      tope_gratificacion_mensual: topeGratificacion,
      tasa_sis: SEED.tasaSis,
      tasa_mutual_base: SEED.tasaMutualBase,
      tramos_impuesto: TRAMOS_IMPUESTO_UNICO_BASE,
      fuente: "mindicador",
    })
    .select("*")
    .single();
  if (error) {
    console.error("Error creando parametros_previsionales:", error);
    return null;
  }

  // Siembra las AFP para el período (si otra request ya las creó, el
  // upsert no rompe).
  await supabase.from("afp_parametros").upsert(
    AFP_CHILE.map((a) => ({
      periodo,
      afp: a.afp,
      nombre: a.nombre,
      codigo_previred: a.codigoPrevired,
      tasa_comision: COMISION_AFP[a.afp] ?? 0.01,
    }))
  );

  return data as ParametroPrevisional;
}

export async function comisionDeAfp(periodo: string, afp: string | null): Promise<number> {
  if (!afp) return 0;
  const { data } = await supabase
    .from("afp_parametros")
    .select("tasa_comision")
    .eq("periodo", periodo)
    .eq("afp", afp)
    .maybeSingle();
  return data?.tasa_comision ?? COMISION_AFP[afp] ?? 0.01;
}
