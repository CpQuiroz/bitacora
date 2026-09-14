// Sesión del Portal de Cliente — identidad completamente aparte de
// Supabase Auth (ver backend/src/portalAuth.ts). El token vive en su
// propia clave de localStorage, nunca se mezcla con la sesión interna.
const CLAVE_TOKEN = "bitacora:portal-token";
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";

export function guardarTokenPortal(token: string) {
  window.localStorage.setItem(CLAVE_TOKEN, token);
}

export function obtenerTokenPortal(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(CLAVE_TOKEN);
}

export function cerrarSesionPortal() {
  window.localStorage.removeItem(CLAVE_TOKEN);
}

export async function portalFetch(path: string, options: RequestInit = {}) {
  const token = obtenerTokenPortal();
  const headers = new Headers(options.headers);
  if (!(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }
  if (token) headers.set("Authorization", `Bearer ${token}`);
  return fetch(`${API_URL}${path}`, { ...options, headers });
}

// Qué secciones dejó visibles la empresa (migración 93) + su marca
// (color_primario/color_secundario) — mismo endpoint, para no duplicar
// la ida y vuelta. Se cachea a nivel de módulo para no re-pedirlo en
// cada pantalla del portal.
export type SeccionPortal = "ordenes" | "citas" | "cotizaciones" | "cobros";
export type ConfigPortal = Record<SeccionPortal, boolean>;
export type MarcaPortal = { color_primario: string | null; color_primario_foreground: string | null; color_secundario: string | null };
export type RespuestaConfigPortal = { secciones: ConfigPortal; marca: MarcaPortal };

const TODO_VISIBLE: ConfigPortal = { ordenes: true, citas: true, cotizaciones: true, cobros: true };
const SIN_MARCA: MarcaPortal = { color_primario: null, color_primario_foreground: null, color_secundario: null };
let configCache: RespuestaConfigPortal | null = null;

export async function obtenerConfigPortal(): Promise<RespuestaConfigPortal> {
  if (configCache) return configCache;
  try {
    const res = await portalFetch("/api/portal/config");
    if (!res.ok) return { secciones: TODO_VISIBLE, marca: SIN_MARCA };
    configCache = (await res.json()) as RespuestaConfigPortal;
    return configCache;
  } catch {
    return { secciones: TODO_VISIBLE, marca: SIN_MARCA };
  }
}
