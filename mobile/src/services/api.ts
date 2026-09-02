import { supabase } from "../lib/supabase";

export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:8080";

export type ResultadoApi<T> = { ok: true; data: T } | { ok: false; error: string; status: number };

/** fetch crudo con el bearer token — para multipart (fotos) o casos especiales. */
export async function apiFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;

  const headers = new Headers(options.headers);
  if (!(options.body instanceof FormData)) headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);

  return fetch(`${API_URL}${path}`, { ...options, headers });
}

/** Igual que apiFetch pero parsea JSON y normaliza errores/timeouts. */
export async function apiJson<T>(path: string, options: RequestInit = {}): Promise<ResultadoApi<T>> {
  try {
    const res = await apiFetch(path, options);
    const body = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, error: (body as { error?: string }).error ?? `Error ${res.status}`, status: res.status };
    return { ok: true, data: body as T };
  } catch {
    return { ok: false, error: "Sin conexión", status: 0 };
  }
}
