import { supabase } from "./supabase";
import { obtenerImpersonacion } from "./impersonacion";

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";

export async function apiFetch(path: string, options: RequestInit = {}) {
  // Si hay una sesión de impersonación activa (Super-Admin viendo como
  // un usuario), TODO el dashboard usa ese token en vez del de Supabase.
  const imp = obtenerImpersonacion();
  const token = imp
    ? imp.token
    : (await supabase.auth.getSession()).data.session?.access_token;

  const headers = new Headers(options.headers);
  // FormData (subida de archivos) necesita que el navegador calcule su
  // propio Content-Type con el boundary del multipart — si lo pisamos
  // acá con "application/json", el body llega sin boundary y el
  // multer/body-parser del backend no logra parsearlo.
  if (!(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }
  if (token) headers.set("Authorization", `Bearer ${token}`);

  return fetch(`${API_URL}${path}`, { ...options, headers });
}
