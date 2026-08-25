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
};
