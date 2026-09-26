// Analytics de producto en la app (tarea 153). Envoltorio propio sobre
// PostHog, igual que la web (web/src/lib/analytics.ts). Sin
// EXPO_PUBLIC_POSTHOG_KEY no hace nada. Nunca datos personales ni montos
// (ver packages/shared/src/eventos.ts). Sentry mobile sigue bloqueado: Expo
// SDK 57 fija @sentry/react-native ~7.11.0, que rompía el build de Gradle.
import PostHog from "posthog-react-native";
import type { NombreEvento, PropiedadesEvento } from "@bitacora/shared";

const CLAVE = process.env.EXPO_PUBLIC_POSTHOG_KEY;
let cliente: PostHog | null = null;

function obtenerCliente(): PostHog | null {
  if (!CLAVE) return null;
  if (cliente) return cliente;
  try {
    cliente = new PostHog(CLAVE, {
      host: process.env.EXPO_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com",
      personProfiles: "identified_only",
      // Sin captura automática de toques ni grabación de sesión.
      captureAppLifecycleEvents: true,
      enableSessionReplay: false,
    });
  } catch (e) {
    console.warn("[analytics] no se pudo iniciar PostHog", e);
    cliente = null;
  }
  return cliente;
}

export function identificarUsuario(usuarioId: string, empresaId: string, rol: string, funcion: string | null): void {
  const c = obtenerCliente();
  if (!c) return;
  try {
    c.identify(usuarioId, { rol, funcion: funcion ?? "" });
    c.group("empresa", empresaId);
  } catch {
    // analytics nunca debe romper la app
  }
}

export function registrarEvento(nombre: NombreEvento, propiedades: PropiedadesEvento = {}): void {
  const c = obtenerCliente();
  if (!c) return;
  try {
    c.capture(nombre, { ...propiedades, plataforma: "mobile" });
  } catch {
    // analytics nunca debe romper la app
  }
}

export function olvidarUsuario(): void {
  const c = obtenerCliente();
  if (!c) return;
  try {
    c.reset();
  } catch {
    // idem
  }
}
