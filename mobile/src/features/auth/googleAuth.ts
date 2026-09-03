import * as WebBrowser from "expo-web-browser";
import * as AuthSession from "expo-auth-session";
import { supabase } from "../../lib/supabase";

// Login con Google en nativo:
//  1. Supabase arma la URL de OAuth (skipBrowserRedirect: no navega solo).
//  2. Abrimos esa URL en una pestaña de auth del sistema.
//  3. Google redirige a `bitacora://` con un `?code=...`.
//  4. Cambiamos ese code por una sesión (flujo PKCE, ver lib/supabase.ts).
//  5. El AuthContext detecta la sesión nueva vía onAuthStateChange.
//
// Requiere config del lado servidor (una sola vez):
//  - Google Cloud: OAuth Client Web para Supabase + redirect
//    `https://<ref>.supabase.co/auth/v1/callback`.
//  - Supabase → Auth → Providers → Google (Client ID/Secret) y en URL
//    Configuration agregar el scheme `bitacora://` a Redirect URLs.

WebBrowser.maybeCompleteAuthSession();

export type ResultadoGoogle = { ok: true } | { ok: false; error: string };

export async function entrarConGoogle(): Promise<ResultadoGoogle> {
  const redirectTo = AuthSession.makeRedirectUri({ scheme: "bitacora", path: "auth-callback" });

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo, skipBrowserRedirect: true },
  });
  if (error || !data?.url) {
    return { ok: false, error: error?.message ?? "No se pudo iniciar el login con Google" };
  }

  const res = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (res.type !== "success" || !res.url) {
    return { ok: false, error: "cancelado" };
  }

  const url = new URL(res.url);
  const code = url.searchParams.get("code");
  const errDescr = url.searchParams.get("error_description");
  if (errDescr) return { ok: false, error: errDescr };
  if (!code) return { ok: false, error: "No llegó el código de Google" };

  const { error: errCambio } = await supabase.auth.exchangeCodeForSession(code);
  if (errCambio) return { ok: false, error: errCambio.message };

  return { ok: true };
}
