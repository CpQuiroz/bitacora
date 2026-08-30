// ============================================================
// Rate limiting para rutas sensibles a fuerza bruta / abuso — límites
// conservadores para empezar, fáciles de ajustar acá en un solo lugar.
// Ver checklist de seguridad pre-lanzamiento.
// ============================================================
import rateLimit from "express-rate-limit";

const VENTANA_15_MIN = 15 * 60 * 1000;

// Login (contraseña + verificación de 2FA) — 10 intentos cada 15 min
// por IP. Cubre tanto adivinar contraseñas como fuerza bruta del
// código de 6 dígitos (que además tiene su propio límite de intentos
// por ticket, ver authLogin.ts — esto es la capa de IP encima).
export const limitarLogin = rateLimit({
  windowMs: VENTANA_15_MIN,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Demasiados intentos de inicio de sesión — espera unos minutos y vuelve a intentar." },
});

// Invitación de colaboradores — evita que una cuenta comprometida (o
// un bug del frontend) dispare cientos de invitaciones/correos.
export const limitarInvitacion = rateLimit({
  windowMs: VENTANA_15_MIN,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Demasiadas invitaciones enviadas — espera unos minutos y vuelve a intentar." },
});

// Encuesta post-servicio (pública, sin auth) — el link vive en un
// correo, pero igual queda expuesto a scraping/abuso automatizado.
export const limitarEncuestaPublica = rateLimit({
  windowMs: VENTANA_15_MIN,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Demasiados intentos — espera unos minutos y vuelve a intentar." },
});
