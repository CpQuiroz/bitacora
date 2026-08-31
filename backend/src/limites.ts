// ============================================================
// Límites de uso por plan (ver LIMITES_POR_PLAN en packages/shared) —
// único punto que los hace cumplir de verdad. Cada verificarLimiteX
// tira LimiteAlcanzadoError si corresponde bloquear; el handler
// global de errores (server.ts) la traduce a 403 sin loguearla en
// errores_backend (no es un bug, es un freno esperado del negocio).
// ============================================================
import type { Plan } from "@bitacora/shared";
import { LIMITES_POR_PLAN } from "@bitacora/shared";
import { supabase } from "./supabase";

export class LimiteAlcanzadoError extends Error {
  status = 403;
  constructor(mensaje: string) {
    super(mensaje);
    this.name = "LimiteAlcanzadoError";
  }
}

async function obtenerPlan(empresaId: string): Promise<Plan> {
  const { data } = await supabase.from("empresas").select("plan").eq("id", empresaId).maybeSingle();
  return (data?.plan as Plan | undefined) ?? "trial";
}

export async function verificarLimiteUsuarios(empresaId: string): Promise<void> {
  const limite = LIMITES_POR_PLAN[await obtenerPlan(empresaId)].usuarios;
  const { count } = await supabase
    .from("usuarios")
    .select("id", { count: "exact", head: true })
    .eq("empresa_id", empresaId)
    .eq("activo", true);
  if ((count ?? 0) >= limite) {
    throw new LimiteAlcanzadoError(
      `Llegaste al límite de usuarios de tu plan (${limite}) — pasa a un plan superior para invitar a más gente.`
    );
  }
}

export async function verificarLimiteOS(empresaId: string): Promise<void> {
  const limite = LIMITES_POR_PLAN[await obtenerPlan(empresaId)].osPorMes;
  if (limite == null) return; // Pro: ilimitado
  const inicioMes = new Date();
  inicioMes.setDate(1);
  const { count } = await supabase
    .from("trabajos")
    .select("id", { count: "exact", head: true })
    .eq("empresa_id", empresaId)
    .gte("creado_en", inicioMes.toISOString().slice(0, 10));
  if ((count ?? 0) >= limite) {
    throw new LimiteAlcanzadoError(
      `Llegaste al límite de órdenes de servicio de este mes en tu plan (${limite}) — pasa a un plan superior para seguir.`
    );
  }
}

export async function verificarLimiteStorage(empresaId: string, bytesNuevos: number): Promise<void> {
  const plan = await obtenerPlan(empresaId);
  const limiteBytes = LIMITES_POR_PLAN[plan].storageGB * 1024 ** 3;
  const { data } = await supabase.from("empresas").select("storage_bytes_usado").eq("id", empresaId).maybeSingle();
  if ((data?.storage_bytes_usado ?? 0) + bytesNuevos > limiteBytes) {
    throw new LimiteAlcanzadoError(
      `Llegaste al límite de almacenamiento de tu plan (${LIMITES_POR_PLAN[plan].storageGB} GB) — pasa a un plan superior o libera espacio.`
    );
  }
}

// No se espera esta escritura — es solo un contador aproximado (ver
// migración 56), no debe agregar latencia a la subida real.
export function incrementarStorageUsado(empresaId: string, bytes: number): void {
  void supabase.rpc("incrementar_storage_usado", { p_empresa_id: empresaId, p_bytes: bytes }).then(({ error }) => {
    if (error) console.error("Error incrementando storage_bytes_usado:", error);
  });
}

export async function verificarLimiteIA(empresaId: string): Promise<void> {
  const limite = LIMITES_POR_PLAN[await obtenerPlan(empresaId)].iaTokensPorMes;
  const inicioMes = new Date();
  inicioMes.setDate(1);
  const { data } = await supabase
    .from("ia_uso")
    .select("tokens_entrada, tokens_salida")
    .eq("empresa_id", empresaId)
    .gte("creado_en", inicioMes.toISOString().slice(0, 10));
  const usados = (data ?? []).reduce((acc, r) => acc + r.tokens_entrada + r.tokens_salida, 0);
  if (usados >= limite) {
    throw new LimiteAlcanzadoError(
      `Llegaste al límite de uso de IA de este mes en tu plan (${limite.toLocaleString("es-CL")} tokens) — pasa a un plan superior para seguir.`
    );
  }
}
