// Sesión del Panel de Super-Admin — identidad completamente aparte de
// Supabase Auth y del resto de la app (ver backend/src/superadmin/).
// El token vive en su propia clave de localStorage, nunca se mezcla
// con la sesión interna ni con la del Portal de Cliente.
const CLAVE_TOKEN = "bitacora:superadmin-token";
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";

export function guardarTokenSuperAdmin(token: string) {
  window.localStorage.setItem(CLAVE_TOKEN, token);
}

export function obtenerTokenSuperAdmin(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(CLAVE_TOKEN);
}

export function cerrarSesionSuperAdmin() {
  window.localStorage.removeItem(CLAVE_TOKEN);
}

export async function superadminFetch(path: string, options: RequestInit = {}) {
  const token = obtenerTokenSuperAdmin();
  const headers = new Headers(options.headers);
  headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);
  return fetch(`${API_URL}${path}`, { ...options, headers });
}
