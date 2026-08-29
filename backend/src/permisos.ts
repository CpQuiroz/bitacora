// ============================================================
// BITÁCORA — Guards de permisos reutilizables. Usan la misma matriz
// centralizada de @bitacora/shared (packages/shared/src/permisos.ts)
// que también consume el frontend para ocultar navegación — nunca
// hay que repetir la regla de "quién ve qué" en dos lugares.
//
// requiereModulo: para proteger un módulo entero (ej. todo Financiero).
// requiereRol: para una acción puntual más fina dentro de un módulo
// que Supervisor sí puede ver pero no ejecutar (ej. "Facturar").
// ============================================================
import type { Modulo, Rol } from "@bitacora/shared";
import { MODULOS, moduloActivadoPorDefecto, puedeVerModulo } from "@bitacora/shared";
import { supabase } from "./supabase";
import type { RequestConEmpresa } from "./empresa";
import { ah } from "./asyncHandler";

// Eje 1: el rol decide qué VE cada persona dentro de una empresa.
// Eje 2 (empresa_modulos): qué está CONTRATADO por esa empresa en
// primer lugar — Etapa 5. Sin fila = el default de moduloActivadoPorDefecto.
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
// empresas nunca tocan esto, así que devolver la lista completa cada
// vez sería ruido).
export async function modulosDeshabilitadosDeEmpresa(empresaId: string): Promise<Modulo[]> {
  const { data } = await supabase.from("empresa_modulos").select("modulo, activado").eq("empresa_id", empresaId);
  const filas = new Map((data ?? []).map((f) => [f.modulo, f.activado]));
  return MODULOS.filter((m) => (filas.has(m) ? !filas.get(m) : !moduloActivadoPorDefecto(m)));
}

export function requiereModulo(modulo: Modulo) {
  return ah<RequestConEmpresa>(async (req, res, next) => {
    if (!puedeVerModulo((req.rol ?? "colaborador") as Rol, modulo)) {
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

export function requiereRol(...roles: Rol[]) {
  return ah<RequestConEmpresa>(async (req, res, next) => {
    if (!roles.includes((req.rol ?? "colaborador") as Rol)) {
      res.status(403).json({ error: "No tienes permiso para realizar esta acción" });
      return;
    }
    next();
  });
}
