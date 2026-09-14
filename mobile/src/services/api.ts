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

// Timeout compartido para subidas multipart (fotos, registro de
// mantención con fotos, firma) — cold start de Render (30-60s) + subir
// una o más fotos por una conexión mala fácilmente supera 60s. Bug real
// (2026-09-11): con 60s, una subida lenta pero real terminaba
// timeouteando del lado del cliente antes de completar, encolándose
// para reintento — y como el fetch de FormData NO se puede abortar de
// verdad en RN (ver comentario más abajo), el intento original seguía
// viajando en paralelo con el reintento, saturando la conexión y
// haciendo que NINGUNO de los dos llegara a terminar nunca ("se quedó
// sincronizando" sin crear el registro). Subir el timeout reduce cuánto
// se dispara este ciclo; el guard de `ultimoIntentoEn` en
// services/sync/queue.ts evita que se apilen intentos concurrentes de
// la MISMA acción.
export const TIMEOUT_MULTIPART_MS = 90000;

const dormir = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Bug real (14-sep-2026, #20 — el mismo "reintentar ahora no hace nada,
// sin ningún error" reportado y NO resuelto por dos intentos previos —
// isInternetReachable y el watchdog de `procesando` en queue.ts):
// `supabase.auth.getSession()` corría SIN NINGÚN timeout, antes de toda
// la lógica de abort/timeout de acá abajo. Si el access token está
// vencido, getSession() dispara un refresh contra el servidor de auth
// de Supabase — un fetch más, sin AbortController ni timeout propio. En
// una conexión de datos móviles real y mala, ese refresh se puede
// colgar indefinidamente (nunca resuelve NI rechaza), y como pasa ANTES
// del resto de apiFetch, ninguno de los timeouts de más abajo llega a
// correr nunca: la función entera queda colgada para siempre, sin
// ningún request de negocio saliendo jamás del teléfono (coincide con
// "cero rastro en los logs" de Render) y sin que "Reintentar ahora"
// tenga ningún efecto visible, sin importar cuánto se espere o cuántas
// veces se reintente — porque cada intento nuevo vuelve a colgarse en
// el mismo lugar. Fix: correr getSession() contra el mismo tipo de
// timeout manual que ya usa la rama multipart más abajo — así, si se
// cuelga, apiFetch SÍ rechaza (con AbortError, el mismo nombre que ya
// reconoce todo el código de reintento existente) en vez de colgarse
// para siempre.
const TIMEOUT_SESION_MS = 8000;

async function tokenConTimeout(): Promise<string | undefined> {
  const sesion = supabase.auth.getSession();
  const timeout = new Promise<never>((_, reject) => {
    setTimeout(() => {
      const err = new Error("No se pudo confirmar la sesión a tiempo");
      err.name = "AbortError";
      reject(err);
    }, TIMEOUT_SESION_MS);
  });
  const { data } = await Promise.race([sesion, timeout]);
  return data.session?.access_token;
}

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
  const token = await tokenConTimeout();

  const esMultipart = options.body instanceof FormData;

  const headers = new Headers(options.headers);
  // FormData: el fetch de RN calcula solo el Content-Type con el boundary
  // del multipart. Si lo forzamos a "application/json" la subida llega sin
  // boundary y el backend no la puede parsear.
  if (!esMultipart) headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);

  // En React Native, adjuntar el signal de un AbortController a un fetch
  // con body FormData NO interrumpe la subida si se traba: la promesa
  // nunca resuelve ni rechaza y el upload "se cuelga sin error". Para
  // multipart NO pasamos signal y corremos la petición contra un timeout
  // manual que rechaza, así el caller igual recibe un error. Para JSON el
  // AbortController sí corta la petición de verdad, se mantiene.
  if (esMultipart) {
    const req = fetch(`${API_URL}${path}`, { ...options, headers });
    const timeout = new Promise<never>((_, reject) => {
      setTimeout(() => {
        const err = new Error("La subida tardó demasiado");
        err.name = "AbortError";
        reject(err);
      }, timeoutMs);
    });
    return Promise.race([req, timeout]);
  }

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
