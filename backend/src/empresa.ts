import { supabase } from "./supabase";
import type { RequestConUsuario } from "./auth";
import { ah } from "./asyncHandler";

export interface RequestConEmpresa extends RequestConUsuario {
  empresaId?: string;
  rol?: string;
}

// Va después de requiereAuth: resuelve la empresa del usuario logueado.
// 403 si el usuario todavía no completó /api/registro-empresa.
export const requiereEmpresa = ah<RequestConEmpresa>(async (req, res, next) => {
  const { data: usuario, error } = await supabase
    .from("usuarios")
    .select("empresa_id, rol")
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

  req.empresaId = usuario.empresa_id;
  req.rol = usuario.rol;
  next();
});
