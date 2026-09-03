import { supabase } from "./supabase";
import { obtenerImpersonacion } from "./impersonacion";

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";

// El backend vive en Render (plan gratis): si estuvo inactivo ~15 min se
// duerme y la primera petición tarda 30-60s en despertarlo, o falla en
// seco mientras arranca. apiFetch reintenta ante error de red / timeout
// / 5xx antes de rendirse (AUDITORIA_RESILIENCIA.md R1). En un fallo
// total devuelve una Response sintética 503 con un mensaje claro — así
// los callers (que hacen `if (!res.ok)`) no necesitan try/catch.
const TIMEOUT_MS = 20_000;
const TIMEOUT_REINTENTO_MS = 30_000;
const REINTENTOS = 2;
const ESPERA_BASE_MS = 1_500;

const dormir = (ms: number) => new Promise((r) => setTimeout(r, ms));

function respuestaError(mensaje: string): Response {
  return new Response(JSON.stringify({ error: mensaje }), {
    status: 503,
    headers: { "Content-Type": "application/json" },
  });
}

export async function apiFetch(path: string, options: RequestInit = {}) {
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

  // Solo se reintenta GET (idempotente). Un POST/PATCH/DELETE que se
  // corta podría haber llegado al server — reintentarlo duplicaría
  // (crear cobro, etc.). Esos fallan de una y el usuario reintenta.
  const metodo = (options.method ?? "GET").toUpperCase();
  const reintentos = metodo === "GET" || metodo === "HEAD" ? REINTENTOS : 0;
  let ultimoFalloRed = false;

  for (let intento = 0; intento <= reintentos; intento++) {
    if (intento > 0) await dormir(ESPERA_BASE_MS * intento);

    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), intento === 0 ? TIMEOUT_MS : TIMEOUT_REINTENTO_MS);
    try {
      const res = await fetch(`${API_URL}${path}`, { ...options, headers, signal: ctrl.signal });
      clearTimeout(timer);
      // 5xx: puede ser un server a medio arrancar — reintentar (solo GET).
      if (res.status >= 500 && intento < reintentos) {
        ultimoFalloRed = false;
        continue;
      }
      return res;
    } catch {
      clearTimeout(timer);
      ultimoFalloRed = true;
      // AbortError o error de red → reintentar.
    }
  }

  return respuestaError(
    ultimoFalloRed
      ? "El servidor está iniciando o hay un problema de conexión. Reintenta en unos segundos."
      : "El servidor no está respondiendo bien. Reintenta en unos segundos."
  );
}
