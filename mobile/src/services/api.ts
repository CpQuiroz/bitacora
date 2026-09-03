import { supabase } from "../lib/supabase";

const FALLBACK = "http://localhost:8080";
export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? FALLBACK;

// Aviso temprano si el build salió sin la URL real — sin esto todo
// falla con "Sin conexión" y no se sabe por qué.
if (API_URL === FALLBACK && !__DEV__) {
  console.warn("[api] EXPO_PUBLIC_API_URL no está configurada — usando localhost");
}

// El backend vive en Render (plan gratis): si estuvo inactivo ~15 min se
// duerme y la primera petición tarda 30–60s en despertarlo, o falla en
// seco mientras arranca. Por eso apiJson reintenta ante errores de red /
// timeout / 5xx antes de rendirse. Ver .github/workflows/keep-warm.yml,
// que además le pega cada 10 min para que rara vez esté dormido.
const TIMEOUT_MS = 15000;
const TIMEOUT_REINTENTO_MS = 25000;
const REINTENTOS = 2;
const ESPERA_BASE_MS = 2000;

const dormir = (ms: number) => new Promise((r) => setTimeout(r, ms));

export type TipoErrorApi = "red" | "timeout" | "servidor";

export type ResultadoApi<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; status: number; tipo: TipoErrorApi };

/** fetch crudo con el bearer token y timeout. Para multipart (fotos) o casos especiales. */
export async function apiFetch(
  path: string,
  options: RequestInit = {},
  timeoutMs: number = TIMEOUT_MS
): Promise<Response> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;

  const headers = new Headers(options.headers);
  if (!(options.body instanceof FormData)) headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(`${API_URL}${path}`, { ...options, headers, signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Igual que apiFetch pero parsea JSON, clasifica el error y reintenta
 * ante fallos transitorios (red, timeout, 5xx) — típico de un backend en
 * Render recién despertando. Un 4xx (credenciales malas, validación) no
 * se reintenta: se devuelve al toque.
 */
export async function apiJson<T>(path: string, options: RequestInit = {}): Promise<ResultadoApi<T>> {
  let ultimoTipo: TipoErrorApi = "red";

  for (let intento = 0; intento <= REINTENTOS; intento++) {
    if (intento > 0) await dormir(ESPERA_BASE_MS * intento);

    let res: Response;
    try {
      res = await apiFetch(path, options, intento === 0 ? TIMEOUT_MS : TIMEOUT_REINTENTO_MS);
    } catch (e) {
      ultimoTipo = e instanceof Error && e.name === "AbortError" ? "timeout" : "red";
      continue;
    }

    const body = await res.json().catch(() => ({}));

    if (!res.ok) {
      // 5xx puede ser un server a medio arrancar — vale la pena reintentar.
      if (res.status >= 500 && intento < REINTENTOS) {
        ultimoTipo = "servidor";
        continue;
      }
      return {
        ok: false,
        error: (body as { error?: string }).error ?? `Error ${res.status}`,
        status: res.status,
        tipo: "servidor",
      };
    }

    return { ok: true, data: body as T };
  }

  return ultimoTipo === "red"
    ? {
        ok: false,
        error: "No se pudo conectar. Revisa tu internet e intenta de nuevo.",
        status: 0,
        tipo: "red",
      }
    : {
        ok: false,
        error: "El servidor está tardando en responder. Si estuvo inactivo puede demorar un poco — intenta de nuevo en unos segundos.",
        status: 0,
        tipo: "timeout",
      };
}
