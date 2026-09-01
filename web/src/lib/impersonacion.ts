// Sesión de impersonación de Super-Admin — el super-admin "entra como"
// un usuario para debuggear. NO es una sesión de Supabase: es un token
// HMAC corto (30 min) que emite el backend. Vive en su propia clave de
// localStorage; el token de la sesión de super-admin (superadminApi.ts)
// se mantiene aparte y sin tocar, para poder volver sin re-login.
const CLAVE = "bitacora:impersonation";

export type ImpersonacionGuardada = {
  token: string;
  expira: number; // epoch ms
  usuario_nombre: string;
};

export function guardarImpersonacion(v: ImpersonacionGuardada) {
  try {
    window.localStorage.setItem(CLAVE, JSON.stringify(v));
  } catch {
    /* private mode / storage bloqueado */
  }
}

export function obtenerImpersonacion(): ImpersonacionGuardada | null {
  try {
    const raw = window.localStorage.getItem(CLAVE);
    if (!raw) return null;
    const v = JSON.parse(raw) as ImpersonacionGuardada;
    if (typeof v?.token !== "string" || typeof v?.expira !== "number" || v.expira < Date.now()) {
      limpiarImpersonacion();
      return null;
    }
    return v;
  } catch {
    return null;
  }
}

export function limpiarImpersonacion() {
  try {
    window.localStorage.removeItem(CLAVE);
  } catch {
    /* noop */
  }
}
