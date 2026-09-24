// ============================================================
// Límites de uso por plan (ver LIMITES_POR_PLAN en packages/shared) —
// único punto que los hace cumplir de verdad. Cada verificarLimiteX
// tira LimiteAlcanzadoError si corresponde bloquear; el handler
// global de errores (server.ts) la traduce a 403 sin loguearla en
// errores_backend (no es un bug, es un freno esperado del negocio).
// ============================================================
import type { Modulo, Plan } from "@bitacora/shared";
import { ETIQUETA_PLAN, LIMITES_POR_PLAN, MODULOS_CONTABLES, cuentaParaTope, moduloActivadoPorDefecto, modulosContablesActivos, modulosSobrantesParaPlan, planPermiteIACompleta } from "@bitacora/shared";
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

// Un cambio de plan que dejaría más módulos activos que el tope del plan
// nuevo (tarea 124): 409, hay que apagar módulos antes de cambiar.
export class ModulosExcedenPlanError extends Error {
  status = 409;
  code = "MODULOS_EXCEDEN_PLAN";
  constructor(mensaje: string) {
    super(mensaje);
    this.name = "ModulosExcedenPlanError";
  }
}

export async function obtenerPlan(empresaId: string): Promise<Plan> {
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

// Asistente y análisis de fotos con IA: solo planes con IA completa
// (prueba, Pro, Empresa). Mismo 403 LIMITE_PLAN que el resto de los topes.
export async function verificarPlanIACompleta(empresaId: string): Promise<void> {
  if (!planPermiteIACompleta(await obtenerPlan(empresaId))) {
    throw new LimiteAlcanzadoError("Esta función de IA está disponible en el plan Pro.");
  }
}

// Tope de informes con IA (tarea 124): por mes, o en toda la prueba
// gratis. Cuenta las llamadas registradas en ia_uso de las features de
// informe (ia_uso solo guarda llamadas exitosas). "prueba" cuenta todo
// el historial de la empresa: si el Super-Admin devuelve a prueba una
// empresa que ya usó IA, arranca con ese cupo gastado (caso raro, a
// propósito: la prueba es una sola).
export const FEATURES_INFORME_IA = ["informe_os", "informe_libre", "informe_estructurado", "informe_personalizado"] as const;

export async function verificarLimiteInformesIA(empresaId: string): Promise<void> {
  const plan = await obtenerPlan(empresaId);
  const tope = LIMITES_POR_PLAN[plan].informesIA;
  if (tope == null) return;
  let query = supabase
    .from("ia_uso")
    .select("id", { count: "exact", head: true })
    .eq("empresa_id", empresaId)
    .in("feature", [...FEATURES_INFORME_IA]);
  if (tope.periodo === "mes") {
    const inicioMes = new Date();
    inicioMes.setDate(1);
    query = query.gte("creado_en", inicioMes.toISOString().slice(0, 10));
  }
  const { count, error } = await query;
  if (error) throw new Error(`No se pudo revisar el tope de informes con IA: ${error.message}`);
  if ((count ?? 0) >= tope.tope) {
    throw new LimiteAlcanzadoError(
      tope.periodo === "prueba"
        ? `Usaste los ${tope.tope} informes con IA de la prueba gratis — elige un plan para seguir generándolos.`
        : `Llegaste a los ${tope.tope} informes con IA de este mes en el plan ${ETIQUETA_PLAN[plan]} — pasa a un plan superior para generar más.`
    );
  }
}

// Módulos activos que cuentan para el tope del plan. Sin fila en
// empresa_modulos rige el default del código (igual que permisos.ts).
export async function modulosActivosContables(empresaId: string): Promise<Modulo[]> {
  const { data, error } = await supabase.from("empresa_modulos").select("modulo, activado").eq("empresa_id", empresaId).limit(200);
  if (error) throw new Error(`No se pudieron leer los módulos de la empresa: ${error.message}`);
  return modulosContablesActivos(data ?? []);
}

// Antes de cambiar a `plan`: los módulos activos tienen que caber en su
// tope. Se llama ANTES de tocar Flow, para no cobrar un plan que después
// no se puede aplicar. 409 (conflicto con el estado actual de la
// empresa), a diferencia del 403 LIMITE_PLAN de activar un módulo de
// más: acá no se choca con el plan vigente sino con el que se elige.
// El mensaje le dice a cada uno dónde apagar módulos: el Super-Admin en
// el panel, la empresa en Configuración › Módulos (etapa 3).
export async function verificarModulosCabenEnPlan(empresaId: string, plan: Plan, quien: "empresa" | "super_admin"): Promise<void> {
  const tope = LIMITES_POR_PLAN[plan].modulosMax;
  if (tope == null) return;
  const activos = (await modulosActivosContables(empresaId)).length;
  const sobran = modulosSobrantesParaPlan(plan, activos);
  if (sobran > 0) {
    throw new ModulosExcedenPlanError(
      quien === "super_admin"
        ? `El plan ${ETIQUETA_PLAN[plan]} permite hasta ${tope} módulos y la empresa tiene ${activos} activos. Apaga ${sobran} en Módulos antes de cambiar el plan.`
        : `Tienes ${activos} módulos activos y el plan ${ETIQUETA_PLAN[plan]} permite ${tope}. Apaga ${sobran} en Configuración › Módulos y vuelve a intentarlo.`
    );
  }
}

// Prende/apaga un módulo de la empresa respetando el tope de su plan
// (tarea 124, etapa 3). El chequeo y el guardado ocurren juntos en la
// base (RPC cambiar_modulo_empresa, migración 133, con la empresa
// bloqueada), así dos pedidos simultáneos no pueden pasar el tope.
// Tope alcanzado → 403 LIMITE_PLAN. Devuelve los activos que cuentan.
export async function cambiarModuloEmpresa(empresaId: string, modulo: Modulo, activado: boolean): Promise<number> {
  const plan = await obtenerPlan(empresaId);
  const tope = LIMITES_POR_PLAN[plan].modulosMax;
  const { data, error } = await supabase.rpc("cambiar_modulo_empresa", {
    p_empresa_id: empresaId,
    p_modulo: modulo,
    p_activado: activado,
    p_contables: [...MODULOS_CONTABLES],
    p_default_activos: MODULOS_CONTABLES.filter((m) => moduloActivadoPorDefecto(m)),
    p_tope: tope,
  });
  if (error) {
    if (error.message.includes("TOPE_MODULOS")) {
      throw new LimiteAlcanzadoError(
        `El plan ${ETIQUETA_PLAN[plan]} permite hasta ${tope} módulos activos y ya están los ${tope}. Apaga uno o pasa a un plan superior.`
      );
    }
    throw new Error(`No se pudo cambiar el módulo: ${error.message}`);
  }
  return data as number;
}

