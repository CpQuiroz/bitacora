// Sentry — se importa PRIMERO en server.ts (antes que express y las
// rutas) para que la auto-instrumentación enganche. Sin SENTRY_DSN, init
// es un no-op: no envía nada. El logueo a `errores_backend` (Panel de
// Super-Admin) sigue funcionando aparte; Sentry solo agrega alertas.
import * as Sentry from "@sentry/node";
import { env } from "./env";

if (env.SENTRY_DSN) {
  Sentry.init({
    dsn: env.SENTRY_DSN,
    environment: env.SENTRY_ENVIRONMENT,
    // Sin performance tracing (solo errores) — barato y suficiente para
    // el piloto. Subir si hace falta.
    tracesSampleRate: 0,
    // No mandar PII por defecto.
    sendDefaultPii: false,
  });
  console.log(`[sentry] activo (${env.SENTRY_ENVIRONMENT})`);
}

export { Sentry };
