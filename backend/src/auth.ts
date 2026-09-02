import type { Request } from "express";
import { supabase } from "./supabase";
import { ah } from "./asyncHandler";
import { verificarTokenImpersonacion } from "./superadmin/auth";

export interface RequestConUsuario extends Request {
  userId?: string;
  // Correo y metadata del usuario autenticado (de Supabase Auth). Se usa
  // en /api/me para resolver el acceso de una cuenta que todavía no tiene
  // fila en `usuarios` (ver backend/src/accesos.ts). Ausentes en el
  // camino de impersonación (ese usuario siempre tiene fila).
  userEmail?: string;
  userMetadata?: Record<string, unknown>;
  // Presente solo cuando el request llega con un token de impersonación
  // de Super-Admin (ver superadmin/auth.ts). req.userId es el usuario
  // impersonado; esto identifica quién lo está impersonando.
  impersonacion?: { superAdminId: string };
}

// Valida el JWT de Supabase que manda el cliente (web/mobile) en
// "Authorization: Bearer <access_token>" y deja el user id en req.userId.
// Excepción: si el token es de impersonación de Super-Admin (prefijo
// "imp."), se valida con HMAC y req.userId queda como el usuario
// impersonado — el resto del backend no necesita saber la diferencia
// (salvo requiereEmpresa, que limita qué se puede hacer impersonando).
export const requiereAuth = ah<RequestConUsuario>(async (req, res, next) => {
  const header = req.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) {
    res.status(401).json({ error: "Falta el header Authorization: Bearer <token>" });
    return;
  }

  const imp = verificarTokenImpersonacion(token);
  if (imp) {
    req.userId = imp.usuarioId;
    req.impersonacion = { superAdminId: imp.superAdminId };
    next();
    return;
  }

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) {
    res.status(401).json({ error: "Token inválido o expirado" });
    return;
  }

  req.userId = data.user.id;
  req.userEmail = data.user.email ?? undefined;
  req.userMetadata = (data.user.user_metadata ?? {}) as Record<string, unknown>;
  next();
});
