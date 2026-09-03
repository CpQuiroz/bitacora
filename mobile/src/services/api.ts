import { supabase } from "../lib/supabase";

const FALLBACK = "http://localhost:8080";
export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? FALLBACK;

// Aviso temprano si el build salió sin la URL real — sin esto todo
// falla con "Sin conexión" y no se sabe por qué.
if (API_URL === FALLBACK && !__DEV__) {
  console.warn("[api] EXPO_PUBLIC_API_URL no está configurada — usando localhost");
}

const TIMEOUT_MS = 15000;

export type ResultadoApi<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; status: number; tipo: "red" | "timeout" | "servidor" };

/** fetch crudo con el bearer token y timeout. Para multipart (fotos) o casos especiales. */
export async function apiFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;

  const headers = new Headers(options.headers);
  if (!(options.body instanceof FormData)) headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    return await fetch(`${API_URL}${path}`, { ...options, headers, signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
  }
}

/** Igual que apiFetch pero parsea JSON y clasifica el error. */
export async function apiJson<T>(path: string, options: RequestInit = {}): Promise<ResultadoApi<T>> {
  let res: Response;
  try {
    res = await apiFetch(path, options);
  } catch (e) {
    const abortado = e instanceof Error && e.name === "AbortError";
    return abortado
      ? { ok: false, error: "La conexión está muy lenta. Intenta de nuevo.", status: 0, tipo: "timeout" }
      : { ok: false, error: "Sin conexión", status: 0, tipo: "red" };
  }
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    return {
      ok: false,
      error: (body as { error?: string }).error ?? `Error ${res.status}`,
      status: res.status,
      tipo: "servidor",
    };
  }
  return { ok: true, data: body as T };
}
