import "dotenv/config";

function requerido(nombre: string): string {
  const valor = process.env[nombre];
  if (!valor) {
    throw new Error(`Falta la variable de entorno ${nombre} (ver .env.example)`);
  }
  return valor;
}

export const env = {
  PORT: Number(process.env.PORT ?? 8080),
  // A dónde redirige el link del correo de invitación (Settings → Auth →
  // URL Configuration → Redirect URLs debe incluir esta URL en Supabase).
  WEB_URL: process.env.WEB_URL ?? "http://localhost:3000",
  SUPABASE_URL: requerido("SUPABASE_URL"),
  // Service role key: solo en backend, nunca en web/mobile — bypassa RLS.
  SUPABASE_SERVICE_ROLE_KEY: requerido("SUPABASE_SERVICE_ROLE_KEY"),
  STORAGE_ENDPOINT: requerido("STORAGE_ENDPOINT"),
  STORAGE_REGION: process.env.STORAGE_REGION ?? "auto",
  STORAGE_ACCESS_KEY: requerido("STORAGE_ACCESS_KEY"),
  STORAGE_SECRET_KEY: requerido("STORAGE_SECRET_KEY"),
  STORAGE_BUCKET: requerido("STORAGE_BUCKET"),
  ANTHROPIC_API_KEY: requerido("ANTHROPIC_API_KEY"),
  // Llave maestra para cifrar credenciales de Integraciones (AES-256-GCM,
  // ver crypto.ts). Generar con: openssl rand -base64 32 — nunca commitear.
  INTEGRACIONES_ENCRYPTION_KEY: requerido("INTEGRACIONES_ENCRYPTION_KEY"),
  // Llave para firmar los tokens de sesión del Portal de Cliente
  // (HMAC-SHA256, ver portalAuth.ts) — identidad separada de Supabase
  // Auth. Generar con: openssl rand -base64 32.
  PORTAL_TOKEN_SECRET: requerido("PORTAL_TOKEN_SECRET"),
  // Panel de Super-Admin — identidad de plataforma, separada de todo lo
  // demás (ver backend/src/superadmin/). SUPERADMIN_TOKEN_SECRET firma
  // los tokens de sesión (HMAC-SHA256); SUPERADMIN_ENCRYPTION_KEY cifra
  // el secreto TOTP en reposo (AES-256-GCM, ver crypto.ts) — deliberadamente
  // distinta de INTEGRACIONES_ENCRYPTION_KEY para que una fuga no
  // comprometa ambas cosas. Generar cada una con: openssl rand -base64 32.
  SUPERADMIN_TOKEN_SECRET: requerido("SUPERADMIN_TOKEN_SECRET"),
  SUPERADMIN_ENCRYPTION_KEY: requerido("SUPERADMIN_ENCRYPTION_KEY"),
  // Opcionales: sin esto, el envío de la encuesta de satisfacción se
  // omite silenciosamente (no bloquea el resto del backend).
  RESEND_API_KEY: process.env.RESEND_API_KEY ?? null,
  RESEND_FROM_EMAIL: process.env.RESEND_FROM_EMAIL ?? null,
  // Opcionales: bot de WhatsApp (Cloud API de Meta). Sin esto, el
  // webhook responde 200 pero no procesa nada — no bloquea el resto
  // del backend. Ver .env.example para cómo se obtienen.
  WHATSAPP_ACCESS_TOKEN: process.env.WHATSAPP_ACCESS_TOKEN ?? null,
  WHATSAPP_PHONE_NUMBER_ID: process.env.WHATSAPP_PHONE_NUMBER_ID ?? null,
  WHATSAPP_VERIFY_TOKEN: process.env.WHATSAPP_VERIFY_TOKEN ?? null,
  WHATSAPP_APP_SECRET: process.env.WHATSAPP_APP_SECRET ?? null,
};
