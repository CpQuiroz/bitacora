// ============================================================
// BITÁCORA — Sesión del Portal de Cliente. Identidad completamente
// aparte de Supabase Auth (nunca un rol de la matriz admin/supervisor/
// contador/colaborador) — token propio, formato JWT mínimo
// (header.payload.firma, HMAC-SHA256), sin dependencia nueva: mismo
// criterio que la firma del webhook de WhatsApp (whatsapp.ts), que ya
// usa crypto nativo de Node en vez de una librería.
// ============================================================
import crypto from "node:crypto";
import type { Request } from "express";
import { env } from "./env";
import { ah } from "./asyncHandler";

const DURACION_SESION_MS = 24 * 60 * 60 * 1000;

type PayloadPortal = { clienteId: string; empresaId: string; exp: number };

function base64url(datos: Buffer | string): string {
  return Buffer.from(datos).toString("base64url");
}

function firmar(datos: string): string {
  return crypto.createHmac("sha256", env.PORTAL_TOKEN_SECRET).update(datos).digest("base64url");
}

export function crearTokenPortal(clienteId: string, empresaId: string): string {
  const payload: PayloadPortal = { clienteId, empresaId, exp: Date.now() + DURACION_SESION_MS };
  const cuerpo = base64url(JSON.stringify(payload));
  return `${cuerpo}.${firmar(cuerpo)}`;
}

export function verificarTokenPortal(token: string): { clienteId: string; empresaId: string } | null {
  const [cuerpo, firma] = token.split(".");
  if (!cuerpo || !firma) return null;

  const firmaEsperada = firmar(cuerpo);
  const a = Buffer.from(firma);
  const b = Buffer.from(firmaEsperada);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;

  try {
    const payload = JSON.parse(Buffer.from(cuerpo, "base64url").toString("utf8")) as PayloadPortal;
    if (typeof payload.exp !== "number" || payload.exp < Date.now()) return null;
    if (typeof payload.clienteId !== "string" || typeof payload.empresaId !== "string") return null;
    return { clienteId: payload.clienteId, empresaId: payload.empresaId };
  } catch {
    return null;
  }
}

export interface RequestConPortal extends Request {
  clienteId?: string;
  empresaId?: string;
}

export const requierePortal = ah<RequestConPortal>(async (req, res, next) => {
  const header = req.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) {
    res.status(401).json({ error: "Falta el header Authorization: Bearer <token>" });
    return;
  }

  const sesion = verificarTokenPortal(token);
  if (!sesion) {
    res.status(401).json({ error: "Sesión inválida o expirada — vuelve a entrar desde el link o con tu código" });
    return;
  }

  req.clienteId = sesion.clienteId;
  req.empresaId = sesion.empresaId;
  next();
});
