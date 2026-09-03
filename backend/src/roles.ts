// ============================================================
// BITÁCORA — Resolución de roles (tabla `roles`, migración 71).
//
// Los roles son filas editables desde el Panel de Super-Admin. Este
// módulo los resuelve con una CACHÉ EN MEMORIA (TTL corto) para no
// pegarle a la DB en cada request — el middleware de empresa.ts corre
// en todas las rutas autenticadas.
//
// Al escribir un rol desde el Panel se llama invalidarCacheRoles().
// ============================================================
import {
  ACCIONES_POR_ROL,
  ETIQUETA_ROL_SISTEMA,
  MODULOS,
  MODULOS_DELEGABLES_POR_EMPRESA,
  PERMISOS_POR_ROL,
  ROL_EXIGE_2FA,
  type Accion,
  type Modulo,
} from "@bitacora/shared";
import { supabase } from "./supabase";

const DELEGABLES = new Set<string>(MODULOS_DELEGABLES_POR_EMPRESA);
const claveOverride = (empresaId: string, slug: string) => `${empresaId}:${slug}`;

export type RolConfig = {
  slug: string;
  nombre: string;
  modulos: string[];
  acciones: string[];
  requiere_2fa: boolean;
  es_sistema: boolean;
  orden: number;
};

const ROLES_SISTEMA = ["admin", "supervisor", "contador", "colaborador"] as const;
const TTL_MS = 60_000;

// overrides: clave `${empresaId}:${slug}` → (módulo → activado). Ajustes
// por empresa sobre la plantilla global del rol (tabla empresa_rol_modulos,
// migración 75).
let cache:
  | {
      roles: Map<string, RolConfig>;
      restriccion: Map<string, Set<string>>;
      overrides: Map<string, Map<string, boolean>>;
      en: number;
    }
  | null = null;
let sembrando: Promise<void> | null = null;

async function asegurarSeed(): Promise<void> {
  if (sembrando) return sembrando;
  sembrando = (async () => {
    const { count } = await supabase.from("roles").select("slug", { count: "exact", head: true });
    if ((count ?? 0) > 0) return;
    const filas = ROLES_SISTEMA.map((slug, i) => ({
      slug,
      nombre: ETIQUETA_ROL_SISTEMA[slug],
      modulos: slug === "admin" ? [...MODULOS] : PERMISOS_POR_ROL[slug],
      acciones: ACCIONES_POR_ROL[slug],
      requiere_2fa: ROL_EXIGE_2FA[slug],
      es_sistema: true,
      orden: (i + 1) * 10,
    }));
    const { error } = await supabase.from("roles").insert(filas);
    if (error && !error.message.includes("duplicate")) console.error("Error sembrando roles de sistema:", error);
  })();
  try {
    await sembrando;
  } finally {
    sembrando = null;
  }
}

async function cargar(): Promise<NonNullable<typeof cache>> {
  if (cache && Date.now() - cache.en < TTL_MS) return cache;
  await asegurarSeed();
  const [{ data: roles }, { data: restr }, { data: ov }] = await Promise.all([
    supabase.from("roles").select("*").order("orden"),
    supabase.from("rol_empresas").select("rol_slug, empresa_id"),
    supabase.from("empresa_rol_modulos").select("empresa_id, rol_slug, modulo, activado"),
  ]);
  const mapaRoles = new Map<string, RolConfig>((roles ?? []).map((r) => [r.slug, r as RolConfig]));
  const mapaRestr = new Map<string, Set<string>>();
  for (const f of restr ?? []) {
    if (!mapaRestr.has(f.rol_slug)) mapaRestr.set(f.rol_slug, new Set());
    mapaRestr.get(f.rol_slug)!.add(f.empresa_id);
  }
  const mapaOv = new Map<string, Map<string, boolean>>();
  for (const f of ov ?? []) {
    const k = claveOverride(f.empresa_id, f.rol_slug);
    if (!mapaOv.has(k)) mapaOv.set(k, new Map());
    mapaOv.get(k)!.set(f.modulo, f.activado);
  }
  cache = { roles: mapaRoles, restriccion: mapaRestr, overrides: mapaOv, en: Date.now() };
  return cache;
}

export function invalidarCacheRoles(): void {
  cache = null;
}

export async function rolConfig(slug: string): Promise<RolConfig | null> {
  const c = await cargar();
  return c.roles.get(slug) ?? null;
}

const esAdmin = (slug: string) => slug === "admin";

/**
 * Aplica los overrides de una empresa sobre la lista de módulos de la
 * plantilla del rol. Solo los módulos delegables pueden cambiar.
 */
function aplicarOverrides(base: string[], ov: Map<string, boolean> | undefined): string[] {
  if (!ov || ov.size === 0) return base;
  const set = new Set(base);
  for (const [modulo, activado] of ov) {
    if (!DELEGABLES.has(modulo)) continue;
    if (activado) set.add(modulo);
    else set.delete(modulo);
  }
  return [...set];
}

export async function rolPuedeVerModulo(slug: string, modulo: Modulo, empresaId?: string): Promise<boolean> {
  if (esAdmin(slug)) return true;
  return (await modulosDeRol(slug, empresaId)).includes(modulo);
}

export async function rolTieneAccion(slug: string, accion: Accion): Promise<boolean> {
  if (esAdmin(slug)) return true;
  const r = await rolConfig(slug);
  return Boolean(r?.acciones.includes(accion));
}

export async function rolExigeMfa(slug: string): Promise<boolean> {
  if (esAdmin(slug)) return true;
  const r = await rolConfig(slug);
  return Boolean(r?.requiere_2fa);
}

/**
 * Módulos que el ROL puede ver (sin cruzar todavía con lo contratado por
 * la empresa). Con `empresaId`, aplica los ajustes por empresa
 * (empresa_rol_modulos, migración 75).
 */
export async function modulosDeRol(slug: string, empresaId?: string): Promise<string[]> {
  if (esAdmin(slug)) return [...MODULOS];
  const c = await cargar();
  const base = c.roles.get(slug)?.modulos ?? [];
  if (!empresaId) return base;
  return aplicarOverrides(base, c.overrides.get(claveOverride(empresaId, slug)));
}

/**
 * Ajustes de módulos por rol para una empresa: para cada rol usable,
 * su lista efectiva de módulos y el detalle de qué está overrideado.
 * Lo consume el endpoint que ve el Admin.
 */
export async function modulosPorRolDeEmpresa(
  empresaId: string
): Promise<{ slug: string; nombre: string; es_sistema: boolean; orden: number; modulos: string[]; base: string[] }[]> {
  const c = await cargar();
  const roles = await rolesDeEmpresa(empresaId);
  return roles.map((r) => {
    const base = r.slug === "admin" ? [...MODULOS] : r.modulos;
    return {
      slug: r.slug,
      nombre: r.nombre,
      es_sistema: r.es_sistema,
      orden: r.orden,
      base,
      modulos: r.slug === "admin" ? base : aplicarOverrides(base, c.overrides.get(claveOverride(empresaId, r.slug))),
    };
  });
}

/**
 * Fija qué módulos delegables ve `slug` en `empresaId`. Guarda solo las
 * diferencias contra la plantilla global (fila activado=true para sumar,
 * activado=false para quitar) y borra las que vuelven a coincidir.
 */
export async function fijarModulosDeRolEnEmpresa(
  empresaId: string,
  slug: string,
  modulosDeseados: string[]
): Promise<void> {
  const c = await cargar();
  const rol = c.roles.get(slug);
  if (!rol) throw new Error("rol inexistente");
  const base = new Set(rol.modulos);
  const deseados = new Set(modulosDeseados.filter((m) => DELEGABLES.has(m)));

  const filas: { empresa_id: string; rol_slug: string; modulo: string; activado: boolean; actualizado_en: string }[] = [];
  const ahora = new Date().toISOString();
  for (const modulo of DELEGABLES) {
    const enBase = base.has(modulo);
    const quiere = deseados.has(modulo);
    if (enBase !== quiere) {
      filas.push({ empresa_id: empresaId, rol_slug: slug, modulo, activado: quiere, actualizado_en: ahora });
    }
  }

  // Reemplazo total de los overrides de este (empresa, rol).
  const { error: errDel } = await supabase
    .from("empresa_rol_modulos")
    .delete()
    .eq("empresa_id", empresaId)
    .eq("rol_slug", slug);
  if (errDel) throw new Error(errDel.message);
  if (filas.length > 0) {
    const { error: errIns } = await supabase.from("empresa_rol_modulos").insert(filas as never);
    if (errIns) throw new Error(errIns.message);
  }
  invalidarCacheRoles();
}

export async function accionesDeRol(slug: string): Promise<string[]> {
  if (esAdmin(slug)) return [...ACCIONES_POR_ROL.admin];
  const r = await rolConfig(slug);
  return r?.acciones ?? [];
}

/** Roles que una empresa puede usar: los globales + los restringidos a ella. */
export async function rolesDeEmpresa(empresaId: string): Promise<RolConfig[]> {
  const c = await cargar();
  return [...c.roles.values()].filter((r) => {
    const restr = c.restriccion.get(r.slug);
    return !restr || restr.size === 0 || restr.has(empresaId);
  });
}

export async function empresaPuedeUsarRol(slug: string, empresaId: string): Promise<boolean> {
  const c = await cargar();
  if (!c.roles.has(slug)) return false;
  const restr = c.restriccion.get(slug);
  return !restr || restr.size === 0 || restr.has(empresaId);
}

export async function todosLosRoles(): Promise<{ rol: RolConfig; empresas: string[] }[]> {
  const c = await cargar();
  return [...c.roles.values()].map((rol) => ({ rol, empresas: [...(c.restriccion.get(rol.slug) ?? [])] }));
}
