import { supabase } from "./supabase";
import { obtenerImpersonacion } from "./impersonacion";

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";

// El backend vive en Render (Starter pago desde sep-2026: ya no se duerme
// por inactividad, pero sí se reinicia en cada deploy y puede fallar en
// seco unos segundos mientras arranca). apiFetch reintenta ante error de red / timeout
// / 5xx antes de rendirse (AUDITORIA_RESILIENCIA.md R1). En un fallo
// total devuelve una Response sintética 503 con un mensaje claro — así
// los callers (que hacen `if (!res.ok)`) no necesitan try/catch.
const TIMEOUT_MS = 20_000;
const TIMEOUT_REINTENTO_MS = 30_000;
const REINTENTOS = 2;
const ESPERA_BASE_MS = 1_500;

const dormir = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ------------------------------------------------------------
// Bug real (23-sep-2026, reportado: "Marcar cotizado externamente" en
// Levantamientos SIEMPRE mostraba "El servidor está iniciando..." aunque
// el endpoint funcionaba bien). Causa raíz, 2 partes — ambas acá,
// extraídas a funciones puras para poder testearlas sin mockear
// fetch/Supabase/Next:
//
// 1. `seguroReintentar` solo cubría GET/HEAD/idempotencyKey. Un PATCH
//    sin key (como /cotizado) tenía CERO reintentos y el timeout corto
//    (20s) de un solo intento — insuficiente para un cold start de
//    Render (30-60s, ver comentario arriba). Como "Marcar cotizado" es
//    una acción de Admin poco frecuente, el backend muy seguido ya
//    estaba dormido de nuevo cuando la usaba — de ahí el "siempre".
//    Fix: PATCH/DELETE son idempotentes por convención en esta app
//    (fijan un valor absoluto o borran; repetir la misma llamada 2
//    veces == 1 vez) — se suman al set seguro de reintentar, igual
//    que ya hace mobile (services/api.ts) para TODOS los métodos.
// 2. Con 0 reintentos, la ÚNICA forma de llegar al `return res` final
//    era agotar reintentos con puro throw (nunca con una respuesta 5xx
//    real, que siempre retorna antes) — el mensaje "El servidor no
//    está respondiendo bien" (rama `!ultimoFalloRed`) era código
//    muerto, inalcanzable. Se reemplaza por una clasificación de 2
//    tipos que sí ocurren en la práctica (red vs. timeout), mismo
//    criterio que ya usa mobile (services/api.ts, tipo "red"/"timeout").
// ------------------------------------------------------------

/**
 * PATCH/DELETE son idempotentes por convención en este backend (fijan
 * un valor absoluto o borran una fila — nunca "incrementan" ni crean
 * un recurso nuevo). Un POST sin Idempotency-Key sí puede duplicar un
 * recurso si el request llegó a destino y solo se perdió la
 * respuesta — por eso sigue excluido salvo que traiga la key.
 */
export function esSeguroReintentar(metodo: string, idempotencyKey?: string): boolean {
  const m = metodo.toUpperCase();
  return m === "GET" || m === "HEAD" || m === "PATCH" || m === "DELETE" || Boolean(idempotencyKey);
}

export type TipoFalloRed = "red" | "timeout";

/** Mensaje distinto para cada causa real de fallo — nunca el mismo texto para todo. */
export function mensajeFalloRed(tipo: TipoFalloRed): string {
  return tipo === "timeout"
    ? "El servidor está iniciando o tardó demasiado en responder. Reintenta en unos segundos."
    : "No se pudo conectar con el servidor. Revisa tu conexión a internet e intenta de nuevo.";
}

function respuestaError(mensaje: string): Response {
  return new Response(JSON.stringify({ error: mensaje }), {
    status: 503,
    headers: { "Content-Type": "application/json" },
  });
}

export async function apiFetch(
  path: string,
  options: RequestInit & { idempotencyKey?: string } = {}
) {
  const { idempotencyKey, ...fetchOptions } = options;
  options = fetchOptions;
  // Si hay una sesión de impersonación activa (Super-Admin viendo como
  // un usuario), TODO el dashboard usa ese token en vez del de Supabase.
  const imp = obtenerImpersonacion();
  const token = imp
    ? imp.token
    : (await supabase.auth.getSession()).data.session?.access_token;

  const headers = new Headers(options.headers);
  // FormData (subida de archivos) necesita que el navegador calcule su
  // propio Content-Type con el boundary del multipart — si lo pisamos
  // acá con "application/json", el body llega sin boundary y el
  // multer/body-parser del backend no logra parsearlo.
  if (!(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (idempotencyKey) headers.set("Idempotency-Key", idempotencyKey);

  const metodo = (options.method ?? "GET").toUpperCase();
  const reintentos = esSeguroReintentar(metodo, idempotencyKey) ? REINTENTOS : 0;
  let ultimoTipo: TipoFalloRed = "red";

  for (let intento = 0; intento <= reintentos; intento++) {
    if (intento > 0) await dormir(ESPERA_BASE_MS * intento);

    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), intento === 0 ? TIMEOUT_MS : TIMEOUT_REINTENTO_MS);
    try {
      const res = await fetch(`${API_URL}${path}`, { ...options, headers, signal: ctrl.signal });
      clearTimeout(timer);
      // 5xx: puede ser un server a medio arrancar — reintentar. Un 4xx
      // real (validación, permisos) nunca llega acá: se retorna tal
      // cual, con el mensaje real del backend.
      const reintentable = res.status >= 500 || (res.status === 409 && Boolean(idempotencyKey));
      if (reintentable && intento < reintentos) continue;
      return res;
    } catch (e) {
      clearTimeout(timer);
      ultimoTipo = e instanceof Error && e.name === "AbortError" ? "timeout" : "red";
      // AbortError o error de red → reintentar si el método lo permite.
    }
  }

  return respuestaError(mensajeFalloRed(ultimoTipo));
}
