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
  PERMISOS_POR_ROL,
  ROL_EXIGE_2FA,
  type Accion,
  type Modulo,
} from "@bitacora/shared";
import { supabase } from "./supabase";

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

let cache: { roles: Map<string, RolConfig>; restriccion: Map<string, Set<string>>; en: number } | null = null;
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
  const [{ data: roles }, { data: restr }] = await Promise.all([
    supabase.from("roles").select("*").order("orden"),
    supabase.from("rol_empresas").select("rol_slug, empresa_id"),
  ]);
  const mapaRoles = new Map<string, RolConfig>((roles ?? []).map((r) => [r.slug, r as RolConfig]));
  const mapaRestr = new Map<string, Set<string>>();
  for (const f of restr ?? []) {
    if (!mapaRestr.has(f.rol_slug)) mapaRestr.set(f.rol_slug, new Set());
    mapaRestr.get(f.rol_slug)!.add(f.empresa_id);
  }
  cache = { roles: mapaRoles, restriccion: mapaRestr, en: Date.now() };
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

export async function rolPuedeVerModulo(slug: string, modulo: Modulo): Promise<boolean> {
  if (esAdmin(slug)) return true;
  const r = await rolConfig(slug);
  return Boolean(r?.modulos.includes(modulo));
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

/** Módulos que el ROL puede ver (sin cruzar todavía con lo contratado por la empresa). */
export async function modulosDeRol(slug: string): Promise<string[]> {
  if (esAdmin(slug)) return [...MODULOS];
  const r = await rolConfig(slug);
  return r?.modulos ?? [];
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
