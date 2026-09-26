// Instrumentación del navegador (tarea 153): Sentry (errores) y PostHog
// (producto). Ambos se apagan solos sin sus variables de entorno
// (NEXT_PUBLIC_SENTRY_DSN, NEXT_PUBLIC_POSTHOG_KEY), que se cargan en
// Vercel — nunca en el repo.
import * as Sentry from "@sentry/nextjs";
import { iniciarAnalytics } from "@/lib/analytics";

const DSN = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (DSN) {
  try {
    Sentry.init({
      dsn: DSN,
      environment: process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT ?? process.env.NODE_ENV,
      // Solo errores (sin tracing ni replay): barato y sin grabar pantallas.
      tracesSampleRate: 0,
      // Sin datos personales (Ley 21.719): v11 recoge todo por defecto.
      dataCollection: { userInfo: false, cookies: false, httpHeaders: false, httpBodies: [], urlQueryParams: false },
    });
  } catch (e) {
    console.warn("[sentry] no se pudo iniciar", e);
  }
}

iniciarAnalytics();

export const onRouterTransitionStart = DSN ? Sentry.captureRouterTransitionStart : undefined;
