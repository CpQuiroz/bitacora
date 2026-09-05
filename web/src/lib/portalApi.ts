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

// Qué secciones dejó visibles la empresa (migración 93). Se cachea a
// nivel de módulo para no re-pedirlo en cada pantalla del portal.
export type SeccionPortal = "ordenes" | "citas" | "cotizaciones" | "cobros";
export type ConfigPortal = Record<SeccionPortal, boolean>;

const TODO_VISIBLE: ConfigPortal = { ordenes: true, citas: true, cotizaciones: true, cobros: true };
let configCache: ConfigPortal | null = null;

export async function obtenerConfigPortal(): Promise<ConfigPortal> {
  if (configCache) return configCache;
  try {
    const res = await portalFetch("/api/portal/config");
    if (!res.ok) return TODO_VISIBLE;
    configCache = (await res.json()) as ConfigPortal;
    return configCache;
  } catch {
    return TODO_VISIBLE;
  }
}
