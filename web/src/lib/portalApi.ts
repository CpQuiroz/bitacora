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
