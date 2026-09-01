// ============================================================
// Sesión del Panel de Super-Admin. Identidad completamente aparte de
// Supabase Auth y de la matriz de roles por empresa — mismo patrón que
// el Portal de Cliente (ver portalAuth.ts): token propio HMAC-SHA256,
// sin dependencia nueva.
// ============================================================
import crypto from "node:crypto";
import type { Request } from "express";
import { env } from "../env";
import { supabase } from "../supabase";
import { ah } from "../asyncHandler";

const DURACION_SESION_MS = 12 * 60 * 60 * 1000; // 12h — panel sensible, sesión corta

type PayloadSuperAdmin = { superAdminId: string; exp: number };

function base64url(datos: Buffer | string): string {
  return Buffer.from(datos).toString("base64url");
}

function firmar(datos: string): string {
  return crypto.createHmac("sha256", env.SUPERADMIN_TOKEN_SECRET).update(datos).digest("base64url");
}

export function crearTokenSuperAdmin(superAdminId: string): string {
  const payload: PayloadSuperAdmin = { superAdminId, exp: Date.now() + DURACION_SESION_MS };
  const cuerpo = base64url(JSON.stringify(payload));
  return `${cuerpo}.${firmar(cuerpo)}`;
}

export function verificarTokenSuperAdmin(token: string): { superAdminId: string } | null {
  const [cuerpo, firma] = token.split(".");
  if (!cuerpo || !firma) return null;

  const firmaEsperada = firmar(cuerpo);
  const a = Buffer.from(firma);
  const b = Buffer.from(firmaEsperada);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;

  try {
    const payload = JSON.parse(Buffer.from(cuerpo, "base64url").toString("utf8")) as PayloadSuperAdmin;
    if (typeof payload.exp !== "number" || payload.exp < Date.now()) return null;
    if (typeof payload.superAdminId !== "string") return null;
    return { superAdminId: payload.superAdminId };
  } catch {
    return null;
  }
}

// ── Impersonación ────────────────────────────────────────────────────
// Token que le permite a un super-admin "entrar como" un usuario de una
// empresa para debuggear. NO es una sesión de Supabase — es el mismo
// mecanismo HMAC de arriba, con dos diferencias deliberadas: (1) vida
// corta (30 min, no las 12h de la sesión de super-admin ni la ~1h de la
// de un usuario normal); (2) prefijo "imp." para que backend/src/auth.ts
// lo distinga barato antes de intentar validarlo contra Supabase.
// backend/src/auth.ts lo verifica y, si es válido, deja req.userId = el
// usuario impersonado + req.impersonacion = { superAdminId }.
const DURACION_IMPERSONACION_MS = 30 * 60 * 1000;

type PayloadImpersonacion = { tipo: "impersonacion"; superAdminId: string; usuarioId: string; exp: number };

export function crearTokenImpersonacion(superAdminId: string, usuarioId: string): { token: string; expiraEn: string } {
  const exp = Date.now() + DURACION_IMPERSONACION_MS;
  const payload: PayloadImpersonacion = { tipo: "impersonacion", superAdminId, usuarioId, exp };
  const cuerpo = base64url(JSON.stringify(payload));
  return { token: `imp.${cuerpo}.${firmar(cuerpo)}`, expiraEn: new Date(exp).toISOString() };
}

export function verificarTokenImpersonacion(token: string): { superAdminId: string; usuarioId: string } | null {
  if (!token.startsWith("imp.")) return null;
  const [, cuerpo, firma] = token.split(".");
  if (!cuerpo || !firma) return null;

  const firmaEsperada = firmar(cuerpo);
  const a = Buffer.from(firma);
  const b = Buffer.from(firmaEsperada);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;

  try {
    const payload = JSON.parse(Buffer.from(cuerpo, "base64url").toString("utf8")) as PayloadImpersonacion;
    if (payload.tipo !== "impersonacion") return null;
    if (typeof payload.exp !== "number" || payload.exp < Date.now()) return null;
    if (typeof payload.superAdminId !== "string" || typeof payload.usuarioId !== "string") return null;
    return { superAdminId: payload.superAdminId, usuarioId: payload.usuarioId };
  } catch {
    return null;
  }
}

export interface RequestConSuperAdmin extends Request {
  superAdminId?: string;
}

export const requiereSuperAdmin = ah<RequestConSuperAdmin>(async (req, res, next) => {
  const header = req.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) {
    res.status(401).json({ error: "Falta el header Authorization: Bearer <token>" });
    return;
  }

  const sesion = verificarTokenSuperAdmin(token);
  if (!sesion) {
    res.status(401).json({ error: "Sesión inválida o expirada — vuelve a entrar" });
    return;
  }

  // Revalida contra la base en cada request (no solo confía en el
  // token firmado) — si se desactiva al super-admin, el acceso se
  // corta de inmediato aunque el token todavía no haya expirado.
  const { data: superAdmin } = await supabase
    .from("super_admins")
    .select("id, activo")
    .eq("id", sesion.superAdminId)
    .maybeSingle();
  if (!superAdmin || !superAdmin.activo) {
    res.status(401).json({ error: "Sesión inválida o expirada — vuelve a entrar" });
    return;
  }

  req.superAdminId = sesion.superAdminId;
  next();
});

// Nunca bloquea la respuesta si falla — mismo criterio que notificar().
export async function registrarAuditoria(
  superAdminId: string,
  accion: string,
  opciones: { empresaId?: string; detalle?: string; ip?: string | null } = {}
): Promise<void> {
  try {
    const { error } = await supabase.from("super_admin_auditoria").insert({
      super_admin_id: superAdminId,
      accion,
      empresa_id: opciones.empresaId ?? null,
      detalle: opciones.detalle ?? null,
      ip: opciones.ip ?? null,
    });
    if (error) console.error("Error registrando auditoría de super-admin:", error);
  } catch (err) {
    console.error("Error en registrarAuditoria():", err);
  }
}
