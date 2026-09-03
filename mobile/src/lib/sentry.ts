import * as Sentry from "@sentry/react-native";

// Reporte de crashes/errores. Sin EXPO_PUBLIC_SENTRY_DSN el SDK queda
// deshabilitado (no envía nada). El DSN se inyecta en el build vía
// eas.json (env del perfil).
const DSN = process.env.EXPO_PUBLIC_SENTRY_DSN;

export function iniciarSentry() {
  Sentry.init({
    dsn: DSN,
    enabled: Boolean(DSN),
    environment: __DEV__ ? "development" : "production",
    // Solo errores, sin performance tracing (barato para el piloto).
    tracesSampleRate: 0,
    // No adjuntar PII automáticamente.
    sendDefaultPii: false,
  });
}

export { Sentry };
