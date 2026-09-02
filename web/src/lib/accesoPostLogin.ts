import { supabase } from "./supabase";
import { apiFetch } from "./api";

// Decide a dónde mandar a una cuenta recién autenticada, consultando
// /api/me. Unifica el camino de login por contraseña y el de Google
// (ver migración 72 / backend accesosAutorizados.ts).
//
//   { destino: "/dashboard" }              → tiene empresa
//   { destino: "/onboarding" }             → se autorregistró, puede crear empresa
//   { error: "..." }                       → acceso denegado (ya cerró sesión) o fallo
export type ResultadoPostLogin = { destino: string } | { error: string };

const MENSAJE_DENEGADO =
  "Tu correo no está habilitado en ninguna empresa de Bitácora. Pídele a un administrador que te invite o autorice tu correo.";
const MENSAJE_MULTIPLE =
  "Tu correo está autorizado en más de una empresa. Pídele a la empresa correcta que te invite directamente.";

export async function resolverDestinoPostLogin(): Promise<ResultadoPostLogin> {
  const res = await apiFetch("/api/me");
  if (!res.ok) return { error: "No se pudo verificar la cuenta. Intenta de nuevo." };

  const body = await res.json().catch(() => ({}));
  if (body.usuario) return { destino: "/dashboard" };

  if (body.acceso === "onboarding") return { destino: "/onboarding" };

  // "denegado" | "multiple" | cualquier otra cosa sin usuario: no puede
  // entrar. Cerramos la sesión para que no quede a medias.
  await supabase.auth.signOut();
  return { error: body.acceso === "multiple" ? MENSAJE_MULTIPLE : MENSAJE_DENEGADO };
}
