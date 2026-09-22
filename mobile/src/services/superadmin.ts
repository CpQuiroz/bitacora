// Fase 1 del panel de Super-Admin en mobile (22-sep-2026) — pedido de
// la usuaria: "ver los recursos y gestionar clientes" desde el
// celular, con las mismas buenas prácticas del resto de la app. Es una
// identidad COMPLETAMENTE separada de un usuario de empresa: login
// propio (correo + password + código TOTP, igual que la web), token
// propio (JWT de backend/src/superadmin/auth.ts, no una sesión de
// Supabase) guardado en SecureStore (cifrado en el dispositivo — este
// token da acceso a TODOS los clientes, no es un token cualquiera).
//
// A propósito NO se reusa apiJson/apiFetch (services/api.ts): esos
// siempre firman con el token de Supabase del usuario de empresa. Este
// archivo es su equivalente mínimo para el token de super-admin.
import * as SecureStore from "expo-secure-store";
import type { EstadoEmpresa, Modulo, Plan } from "@bitacora/shared";

const FALLBACK = "http://localhost:8080";
const API_URL = process.env.EXPO_PUBLIC_API_URL ?? FALLBACK;
const CLAVE_TOKEN = "superadmin_token";

// Mismo criterio que api.ts: Render puede tardar si estuvo inactivo.
const TIMEOUT_MS = 15000;

export async function obtenerTokenSuperAdmin(): Promise<string | null> {
  return SecureStore.getItemAsync(CLAVE_TOKEN);
}

async function guardarToken(token: string): Promise<void> {
  await SecureStore.setItemAsync(CLAVE_TOKEN, token);
}

export async function cerrarSesionSuperAdmin(): Promise<void> {
  await SecureStore.deleteItemAsync(CLAVE_TOKEN);
}

type ResultadoSA<T> = { ok: true; data: T } | { ok: false; error: string; status: number };

async function apiSuperAdmin<T>(path: string, options: RequestInit = {}): Promise<ResultadoSA<T>> {
  const token = await obtenerTokenSuperAdmin();
  const headers = new Headers(options.headers);
  headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, { ...options, headers, signal: ctrl.signal });
  } catch (e) {
    clearTimeout(timer);
    const timeout = e instanceof Error && e.name === "AbortError";
    return {
      ok: false,
      status: 0,
      error: timeout
        ? "El servidor está tardando en responder. Si estuvo inactivo puede demorar un poco — intenta de nuevo."
        : "No se pudo conectar. Revisa tu internet e intenta de nuevo.",
    };
  }
  clearTimeout(timer);

  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    return { ok: false, status: res.status, error: (body as { error?: string }).error ?? `Error ${res.status}` };
  }
  return { ok: true, data: body as T };
}

export async function loginSuperAdmin(
  correo: string,
  password: string,
  codigo: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const r = await apiSuperAdmin<{ token: string; nombre: string }>("/api/superadmin/login", {
    method: "POST",
    body: JSON.stringify({ correo, password, codigo }),
  });
  if (!r.ok) return { ok: false, error: r.error };
  await guardarToken(r.data.token);
  return { ok: true };
}

export type SuperAdminYo = { correo: string; nombre: string; ultimo_login_en: string | null; creado_en: string };

export async function obtenerSuperAdminYo(): Promise<{ ok: true; yo: SuperAdminYo } | { ok: false; error: string; status: number }> {
  const r = await apiSuperAdmin<SuperAdminYo>("/api/superadmin/me");
  if (!r.ok) return { ok: false, error: r.error, status: r.status };
  return { ok: true, yo: r.data };
}

export type EmpresaSuperAdmin = {
  id: string;
  nombre: string;
  plan: Plan;
  estado: EstadoEmpresa;
  creado_en: string;
  cantidad_usuarios: number;
};

export async function listarEmpresasSuperAdmin(busqueda?: string): Promise<EmpresaSuperAdmin[]> {
  const qs = busqueda?.trim() ? `?busqueda=${encodeURIComponent(busqueda.trim())}` : "";
  const r = await apiSuperAdmin<EmpresaSuperAdmin[]>(`/api/superadmin/empresas${qs}`);
  return r.ok ? r.data : [];
}

export async function cambiarEstadoEmpresa(id: string, estado: EstadoEmpresa): Promise<{ ok: true } | { ok: false; error: string }> {
  const r = await apiSuperAdmin(`/api/superadmin/empresas/${id}/estado`, { method: "PATCH", body: JSON.stringify({ estado }) });
  return r.ok ? { ok: true } : { ok: false, error: r.error };
}

export async function cambiarPlanEmpresa(id: string, plan: Plan): Promise<{ ok: true } | { ok: false; error: string }> {
  const r = await apiSuperAdmin(`/api/superadmin/empresas/${id}/plan`, { method: "PATCH", body: JSON.stringify({ plan }) });
  return r.ok ? { ok: true } : { ok: false, error: r.error };
}

export type ModuloEstado = { modulo: Modulo; activado: boolean };

export async function obtenerModulosEmpresa(id: string): Promise<ModuloEstado[]> {
  const r = await apiSuperAdmin<ModuloEstado[]>(`/api/superadmin/empresas/${id}/modulos`);
  return r.ok ? r.data : [];
}

export async function cambiarModuloEmpresa(id: string, modulo: Modulo, activado: boolean): Promise<{ ok: true } | { ok: false; error: string }> {
  const r = await apiSuperAdmin(`/api/superadmin/empresas/${id}/modulos`, { method: "PATCH", body: JSON.stringify({ modulo, activado }) });
  return r.ok ? { ok: true } : { ok: false, error: r.error };
}
