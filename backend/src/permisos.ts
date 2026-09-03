// ============================================================
// BITÁCORA — Guards de permisos reutilizables.
//
// Dos ejes:
//  1. El ROL decide qué VE y qué ACCIONES sensibles puede ejecutar cada
//     persona. Desde la migración 71 los roles son filas editables
//     (Panel de Super-Admin) — se resuelven vía backend/src/roles.ts.
//  2. empresa_modulos: qué está CONTRATADO por esa empresa. requiereModulo
//     valida los dos.
//
// requiereModulo: protege un módulo entero.
// requiereAccion: protege una acción sensible delegable (facturar,
//   gestionar_plan, …) — reemplaza a requiereRol, que queda solo para
//   compatibilidad puntual.
// ============================================================
import type { Accion, Modulo, Rol } from "@bitacora/shared";
import { MODULOS, moduloActivadoPorDefecto } from "@bitacora/shared";
import { supabase } from "./supabase";
import type { RequestConEmpresa } from "./empresa";
import { ah } from "./asyncHandler";
import { modulosDeRol, rolPuedeVerModulo, rolTieneAccion } from "./roles";

export async function empresaTieneModulo(empresaId: string, modulo: Modulo): Promise<boolean> {
  const { data } = await supabase
    .from("empresa_modulos")
    .select("activado")
    .eq("empresa_id", empresaId)
    .eq("modulo", modulo)
    .maybeSingle();
  if (!data) return moduloActivadoPorDefecto(modulo);
  return data.activado;
}

// Para /api/me — solo las EXCEPCIONES al default (la mayoría de las
// empresas nunca tocan esto).
export async function modulosDeshabilitadosDeEmpresa(empresaId: string): Promise<Modulo[]> {
  const { data } = await supabase.from("empresa_modulos").select("modulo, activado").eq("empresa_id", empresaId);
  const filas = new Map((data ?? []).map((f) => [f.modulo, f.activado]));
  return MODULOS.filter((m) => (filas.has(m) ? !filas.get(m) : !moduloActivadoPorDefecto(m)));
}

// Módulos que este usuario realmente ve: los de su rol ∩ los contratados
// (y activos) por su empresa. Lo consume /api/me → el frontend filtra la
// navegación con esto y ya no depende de la matriz hardcodeada.
export async function modulosVisiblesDeUsuario(rol: string, empresaId: string): Promise<Modulo[]> {
  const delRol = new Set(await modulosDeRol(rol, empresaId));
  const deshabilitados = new Set(await modulosDeshabilitadosDeEmpresa(empresaId));
  return MODULOS.filter((m) => delRol.has(m) && !deshabilitados.has(m));
}

export async function featureFlagsDeEmpresa(empresaId: string): Promise<string[]> {
  const { data } = await supabase
    .from("empresa_feature_flags")
    .select("flag")
    .eq("empresa_id", empresaId)
    .eq("activado", true);
  return (data ?? []).map((f) => f.flag);
}

export function requiereModulo(modulo: Modulo) {
  return ah<RequestConEmpresa>(async (req, res, next) => {
    if (!(await rolPuedeVerModulo(req.rol ?? "colaborador", modulo, req.empresaId))) {
      res.status(403).json({ error: "No tienes permiso para acceder a este módulo" });
      return;
    }
    if (!(await empresaTieneModulo(req.empresaId!, modulo))) {
      res.status(403).json({ error: "Este módulo no está disponible para tu empresa" });
      return;
    }
    next();
  });
}

export function requiereAccion(accion: Accion) {
  return ah<RequestConEmpresa>(async (req, res, next) => {
    if (!(await rolTieneAccion(req.rol ?? "colaborador", accion))) {
      res.status(403).json({ error: "No tienes permiso para realizar esta acción" });
      return;
    }
    next();
  });
}

// Compatibilidad: chequeo literal de slug de rol. Nuevo código usa
// requiereAccion. Solo queda por si algún endpoint necesita exigir un
// rol de sistema puntual.
export function requiereRol(...roles: Rol[]) {
  return ah<RequestConEmpresa>(async (req, res, next) => {
    if (!roles.includes((req.rol ?? "colaborador") as Rol)) {
      res.status(403).json({ error: "No tienes permiso para realizar esta acción" });
      return;
    }
    next();
  });
}
