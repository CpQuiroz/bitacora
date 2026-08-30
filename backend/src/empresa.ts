import { supabase } from "./supabase";
import type { RequestConUsuario } from "./auth";
import { ah } from "./asyncHandler";
import { registrarAccesoSiCorresponde } from "./accesos";

export interface RequestConEmpresa extends RequestConUsuario {
  empresaId?: string;
  rol?: string;
}

// Va después de requiereAuth: resuelve la empresa del usuario logueado.
// 403 si el usuario todavía no completó /api/registro-empresa, o si un
// admin lo desactivó (Gestión y Control) — un solo punto de chequeo que
// protege todo el backend automáticamente.
export const requiereEmpresa = ah<RequestConEmpresa>(async (req, res, next) => {
  const { data: usuario, error } = await supabase
    .from("usuarios")
    .select("empresa_id, rol, activo, mfa_activado, empresa:empresas(estado)")
    .eq("id", req.userId!)
    .maybeSingle();

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }
  if (!usuario) {
    res.status(403).json({ error: "Completa el registro de tu empresa primero" });
    return;
  }
  if (!usuario.activo) {
    res.status(403).json({ error: "Tu cuenta fue desactivada — contacta a un administrador" });
    return;
  }
  const estadoEmpresa = (usuario as unknown as { empresa: { estado: string } | null }).empresa?.estado;
  if (estadoEmpresa === "suspendida") {
    res.status(403).json({ error: "Tu empresa fue suspendida — contacta al soporte" });
    return;
  }
  if (estadoEmpresa === "dada_de_baja") {
    res.status(403).json({ error: "Esta cuenta fue dada de baja" });
    return;
  }

  // admin/supervisor están obligados a tener 2FA activo (ver mfa.ts) —
  // se les deja pasar la contraseña (no hace falta pedirla de nuevo) y
  // entrar a su propio perfil/2FA para poder configurarlo, pero
  // cualquier otra ruta queda bloqueada hasta que lo activen.
  const rolExigeMfa = usuario.rol === "admin" || usuario.rol === "supervisor";
  const rutaExceptuada = req.originalUrl.startsWith("/api/usuarios/me");
  if (rolExigeMfa && !usuario.mfa_activado && !rutaExceptuada) {
    res.status(403).json({
      error: "Tu rol requiere activar la verificación en dos pasos antes de continuar — actívala en Configuración > Seguridad.",
      code: "MFA_REQUERIDA",
    });
    return;
  }

  req.empresaId = usuario.empresa_id;
  req.rol = usuario.rol;
  // No se espera esta escritura — es solo para el historial de accesos
  // de Seguridad, no debe agregar latencia al request real.
  void registrarAccesoSiCorresponde(req.userId!, usuario.empresa_id, req.ip ?? null, req.headers["user-agent"] ?? null);
  next();
});
