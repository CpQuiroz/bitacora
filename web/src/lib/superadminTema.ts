import type { Empresa } from "@bitacora/shared";

// Estilo visual propio del Super-Admin (super_admins.tema, migración 127).
// La fuente de verdad es su cuenta (GET/PATCH /api/superadmin/me[/tema]);
// esta copia en localStorage solo evita el parpadeo al cargar cada
// página del panel, y el evento avisa a SuperAdminShell cuando
// "Mi cuenta" lo cambia sin recargar.
export type TemaSuperAdmin = Empresa["tema"];

const CLAVE = "superadmin_tema";
const EVENTO = "superadmin-tema";

export function leerTemaSuperAdmin(): TemaSuperAdmin {
  try {
    const v = window.localStorage.getItem(CLAVE);
    return v === "taller" || v === "confianza" ? v : "faena";
  } catch {
    return "faena";
  }
}

export function guardarTemaSuperAdmin(tema: TemaSuperAdmin) {
  try {
    window.localStorage.setItem(CLAVE, tema);
  } catch {
    // Sin storage: el shell igual recibe el evento de abajo.
  }
  window.dispatchEvent(new CustomEvent<TemaSuperAdmin>(EVENTO, { detail: tema }));
}

export function escucharTemaSuperAdmin(cb: (tema: TemaSuperAdmin) => void): () => void {
  const handler = (e: Event) => cb((e as CustomEvent<TemaSuperAdmin>).detail);
  window.addEventListener(EVENTO, handler);
  return () => window.removeEventListener(EVENTO, handler);
}
