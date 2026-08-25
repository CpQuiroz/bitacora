import type { Request } from "express";
import { supabase } from "./supabase";
import { ah } from "./asyncHandler";

export interface RequestConUsuario extends Request {
  userId?: string;
}

// Valida el JWT de Supabase que manda el cliente (web/mobile) en
// "Authorization: Bearer <access_token>" y deja el user id en req.userId.
export const requiereAuth = ah<RequestConUsuario>(async (req, res, next) => {
  const header = req.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) {
    res.status(401).json({ error: "Falta el header Authorization: Bearer <token>" });
    return;
  }

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) {
    res.status(401).json({ error: "Token inválido o expirado" });
    return;
  }

  req.userId = data.user.id;
  next();
});
