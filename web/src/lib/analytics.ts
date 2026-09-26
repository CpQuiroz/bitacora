// Analytics de producto (tarea 153). Envoltorio propio sobre PostHog para
// no acoplar las pantallas a la librería. Sin NEXT_PUBLIC_POSTHOG_KEY no
// hace nada (desarrollo, pruebas, previews). Nunca mandar datos personales
// ni montos (ver packages/shared/src/eventos.ts).
import posthog from "posthog-js";
import type { NombreEvento, PropiedadesEvento } from "@bitacora/shared";

const CLAVE = process.env.NEXT_PUBLIC_POSTHOG_KEY;
let iniciado = false;

export function iniciarAnalytics(): void {
  if (!CLAVE || iniciado || typeof window === "undefined") return;
  try {
    posthog.init(CLAVE, {
      api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com",
      // Solo personas identificadas (usuarios logueados), páginas por
      // navegación del App Router, sin grabación de sesión ni captura
      // automática de clics (evita capturar textos con datos personales).
      person_profiles: "identified_only",
      capture_pageview: "history_change",
      autocapture: false,
      disable_session_recording: true,
      respect_dnt: true,
    });
    iniciado = true;
  } catch (e) {
    console.warn("[analytics] no se pudo iniciar PostHog", e);
  }
}

// Usuario y empresa (grupo) por id técnico: sin nombre ni correo.
export function identificarUsuario(usuarioId: string, empresaId: string, rol: string): void {
  if (!iniciado) return;
  try {
    posthog.identify(usuarioId, { rol });
    posthog.group("empresa", empresaId);
  } catch {
    // analytics nunca debe romper la app
  }
}

export function registrarEvento(nombre: NombreEvento, propiedades: PropiedadesEvento = {}): void {
  if (!iniciado) return;
  try {
    posthog.capture(nombre, propiedades);
  } catch {
    // analytics nunca debe romper la app
  }
}

export function olvidarUsuario(): void {
  if (!iniciado) return;
  try {
    posthog.reset();
  } catch {
    // idem
  }
}
