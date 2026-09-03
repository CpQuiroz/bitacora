import crypto from "node:crypto";
import { env } from "./env";

// Ley 21.719 — link de "no recibir más avisos" en los correos al cliente.
// Token firmado (HMAC), sin vencimiento (un link de baja tiene que
// funcionar siempre). Solo identifica al cliente + empresa; no da acceso
// a ningún dato.

function firmar(datos: string): string {
  return crypto.createHmac("sha256", env.PORTAL_TOKEN_SECRET).update(datos).digest("base64url");
}

export function tokenBajaAvisos(empresaId: string, clienteId: string): string {
  const cuerpo = Buffer.from(`${empresaId}.${clienteId}`).toString("base64url");
  return `${cuerpo}.${firmar(cuerpo)}`;
}

export function verificarTokenBajaAvisos(token: string): { empresaId: string; clienteId: string } | null {
  const [cuerpo, firma] = (token ?? "").split(".");
  if (!cuerpo || !firma) return null;
  const esperada = firmar(cuerpo);
  const a = Buffer.from(firma);
  const b = Buffer.from(esperada);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  const [empresaId, clienteId] = Buffer.from(cuerpo, "base64url").toString("utf8").split(".");
  if (!empresaId || !clienteId) return null;
  return { empresaId, clienteId };
}

export function linkBajaAvisos(empresaId: string, clienteId: string): string {
  return `${env.WEB_URL}/baja-avisos?token=${tokenBajaAvisos(empresaId, clienteId)}`;
}
