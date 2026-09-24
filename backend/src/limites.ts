// ============================================================
// Límites de uso por plan (ver LIMITES_POR_PLAN en packages/shared) —
// único punto que los hace cumplir de verdad. Cada verificarLimiteX
// tira LimiteAlcanzadoError si corresponde bloquear; el handler
// global de errores (server.ts) la traduce a 403 sin loguearla en
// errores_backend (no es un bug, es un freno esperado del negocio).
// ============================================================
import type { Plan } from "@bitacora/shared";
import { LIMITES_POR_PLAN, planPermiteAnalisisFotosIA } from "@bitacora/shared";
import { supabase } from "./supabase";

export class LimiteAlcanzadoError extends Error {
  status = 403;
  // Viaja en el JSON de error (handler global de server.ts) para que los
  // clientes distingan "tope del plan" de "sin permiso" (ambos son 403).
  code = "LIMITE_PLAN";
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

// `medirReal` (opcional) mide el uso REAL del bucket. El contador de
// empresas.storage_bytes_usado es aproximado (se suma sin esperar, no
// cuenta firmas/logos/PDFs y solo baja al borrar fotos de OS), así que
// antes de bloquear una subida se recalibra contra el bucket: si el uso
// real deja espacio, se corrige el contador y la subida pasa. Solo se
// mide al llegar al tope — el camino normal sigue siendo una lectura.
export async function verificarLimiteStorage(
  empresaId: string,
  bytesNuevos: number,
  medirReal?: () => Promise<number | null>
): Promise<void> {
  const plan = await obtenerPlan(empresaId);
  const limiteBytes = LIMITES_POR_PLAN[plan].storageGB * 1024 ** 3;
  const { data } = await supabase.from("empresas").select("storage_bytes_usado").eq("id", empresaId).maybeSingle();
  if ((data?.storage_bytes_usado ?? 0) + bytesNuevos <= limiteBytes) return;

  const real = medirReal ? await medirReal().catch(() => null) : null;
  if (real != null) {
    await supabase.from("empresas").update({ storage_bytes_usado: real }).eq("id", empresaId);
    if (real + bytesNuevos <= limiteBytes) return;
  }
  throw new LimiteAlcanzadoError(
    `Llegaste al límite de almacenamiento de tu plan (${LIMITES_POR_PLAN[plan].storageGB} GB) — pasa a un plan superior o libera espacio.`
  );
}

// No se espera esta escritura — es solo un contador aproximado (ver
// migración 56), no debe agregar latencia a la subida real.
export function incrementarStorageUsado(empresaId: string, bytes: number): void {
  void supabase.rpc("incrementar_storage_usado", { p_empresa_id: empresaId, p_bytes: bytes }).then(({ error }) => {
    if (error) console.error("Error incrementando storage_bytes_usado:", error);
  });
}

// Contraparte de incrementarStorageUsado al borrar un objeto. Misma RPC
// con bytes negativos; si el contador quedara por debajo de lo real, la
// recalibración de verificarLimiteStorage lo corrige al llegar al tope.
export function descontarStorageUsado(empresaId: string, bytes: number): void {
  if (bytes <= 0) return;
  void supabase.rpc("incrementar_storage_usado", { p_empresa_id: empresaId, p_bytes: -bytes }).then(({ error }) => {
    if (error) console.error("Error descontando storage_bytes_usado:", error);
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

// Análisis de fotos con IA a pedido (tarea 122) — solo en los planes de
// PLANES_CON_ANALISIS_FOTOS_IA. Mismo 403 LIMITE_PLAN que el resto de los
// topes: los clientes lo muestran como "pasa a un plan superior".
export async function verificarPlanAnalisisFotosIA(empresaId: string): Promise<void> {
  if (!planPermiteAnalisisFotosIA(await obtenerPlan(empresaId))) {
    throw new LimiteAlcanzadoError("El análisis de fotos con IA está disponible solo en el plan Pro.");
  }
}

// Tope de informes con IA por mes (hoy solo Operación: 20, tarea 124).
// Cuenta las llamadas registradas en ia_uso de las features de informe.
export const FEATURES_INFORME_IA = ["informe_os", "informe_libre", "informe_estructurado", "informe_personalizado"] as const;

export async function verificarLimiteInformesIA(empresaId: string): Promise<void> {
  const plan = await obtenerPlan(empresaId);
  const tope = LIMITES_POR_PLAN[plan].informesIAPorMes;
  if (tope == null) return;
  const inicioMes = new Date();
  inicioMes.setDate(1);
  const { count } = await supabase
    .from("ia_uso")
    .select("id", { count: "exact", head: true })
    .eq("empresa_id", empresaId)
    .in("feature", [...FEATURES_INFORME_IA])
    .gte("creado_en", inicioMes.toISOString().slice(0, 10));
  if ((count ?? 0) >= tope) {
    throw new LimiteAlcanzadoError(
      `Llegaste a los ${tope} informes con IA de este mes en tu plan — pasa a Pro para generar sin tope.`
    );
  }
}
