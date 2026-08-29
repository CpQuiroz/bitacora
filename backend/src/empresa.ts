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
    .select("empresa_id, rol, activo")
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

  req.empresaId = usuario.empresa_id;
  req.rol = usuario.rol;
  // No se espera esta escritura — es solo para el historial de accesos
  // de Seguridad, no debe agregar latencia al request real.
  void registrarAccesoSiCorresponde(req.userId!, usuario.empresa_id, req.ip ?? null, req.headers["user-agent"] ?? null);
  next();
});
