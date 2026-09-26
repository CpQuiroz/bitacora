// ============================================================
// Valor de la UF del día (tarea 151). Para mostrar el precio de los planes
// en CLP. Una sola consulta a mindicador.cl por día: primero memoria,
// luego la tabla uf_diaria (migración 145) y recién después la API. Si la
// API no responde, se usa el último valor guardado (y se informa su fecha).
// ============================================================
import { supabase } from "./supabase";
import { hoyChile } from "./fechaChile";

export type ValorUf = { valor: number; fecha: string; delDia: boolean };

let enMemoria: ValorUf | null = null;
// Evita que varias consultas simultáneas llamen a mindicador a la vez.
let enCurso: Promise<ValorUf | null> | null = null;

// "2026-09-26" → "26-09-2026" (formato de mindicador).
function fechaMindicador(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}-${m}-${y}`;
}

async function consultarMindicador(hoy: string): Promise<number | null> {
  try {
    const res = await fetch(`https://mindicador.cl/api/uf/${fechaMindicador(hoy)}`, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    const cuerpo = (await res.json()) as { serie?: { valor?: number }[] };
    const valor = Number(cuerpo.serie?.[0]?.valor);
    return Number.isFinite(valor) && valor > 0 ? valor : null;
  } catch {
    return null;
  }
}

export async function valorUfDelDia(): Promise<ValorUf | null> {
  if (enMemoria?.fecha === hoyChile()) return enMemoria;
  enCurso ??= buscarValorUf().finally(() => {
    enCurso = null;
  });
  return enCurso;
}

async function buscarValorUf(): Promise<ValorUf | null> {
  const hoy = hoyChile();

  const { data: guardado } = await supabase.from("uf_diaria").select("fecha, valor").eq("fecha", hoy).maybeSingle();
  if (guardado) {
    enMemoria = { valor: Number(guardado.valor), fecha: guardado.fecha, delDia: true };
    return enMemoria;
  }

  const valor = await consultarMindicador(hoy);
  if (valor != null) {
    const { error } = await supabase.from("uf_diaria").upsert({ fecha: hoy, valor, fuente: "mindicador" });
    if (error) console.error("No se pudo guardar la UF del día:", error.message);
    enMemoria = { valor, fecha: hoy, delDia: true };
    return enMemoria;
  }

  // Sin API: el último valor conocido (no se guarda en memoria como "del
  // día", así se reintenta en la próxima consulta).
  const { data: ultimo } = await supabase.from("uf_diaria").select("fecha, valor").order("fecha", { ascending: false }).limit(1).maybeSingle();
  return ultimo ? { valor: Number(ultimo.valor), fecha: ultimo.fecha, delDia: false } : null;
}

// Precio en CLP redondeado al peso.
export function ufAClp(uf: number, valorUf: number): number {
  return Math.round(uf * valorUf);
}
