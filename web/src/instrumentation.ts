// Instrumentación del servidor de Next (tarea 153): Sentry para errores de
// render/route handlers. Sin NEXT_PUBLIC_SENTRY_DSN no hace nada.
import * as Sentry from "@sentry/nextjs";

const DSN = process.env.NEXT_PUBLIC_SENTRY_DSN;

export function register() {
  if (!DSN) return;
  Sentry.init({
    dsn: DSN,
    environment: process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT ?? process.env.NODE_ENV,
    tracesSampleRate: 0,
    // Sin datos personales (Ley 21.719): v11 recoge todo por defecto.
    dataCollection: { userInfo: false, cookies: false, httpHeaders: false, httpBodies: [], urlQueryParams: false },
  });
}

export const onRequestError = Sentry.captureRequestError;
