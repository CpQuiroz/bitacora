// ============================================================
// BITÁCORA — Cifrado simétrico para secretos guardados por la
// empresa (hoy: credenciales de Integraciones). AES-256-GCM nativo
// de Node, sin dependencia externa. La llave maestra vive solo en
// la variable de entorno INTEGRACIONES_ENCRYPTION_KEY del backend —
// nunca en el código, nunca en el frontend, nunca en git.
// ============================================================
import crypto from "node:crypto";
import { env } from "./env";

const ALGORITMO = "aes-256-gcm";
const PREFIJO = "enc:v1:";
const LARGO_IV = 12;
const LARGO_TAG = 16;

function llaveMaestra(): Buffer {
  const llave = Buffer.from(env.INTEGRACIONES_ENCRYPTION_KEY, "base64");
  if (llave.length !== 32) {
    throw new Error("INTEGRACIONES_ENCRYPTION_KEY debe decodificar a 32 bytes en base64 (usa: openssl rand -base64 32)");
  }
  return llave;
}

export function cifrarJson(datos: Record<string, unknown>): string {
  const iv = crypto.randomBytes(LARGO_IV);
  const cipher = crypto.createCipheriv(ALGORITMO, llaveMaestra(), iv);
  const cifrado = Buffer.concat([cipher.update(Buffer.from(JSON.stringify(datos), "utf8")), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return PREFIJO + Buffer.concat([iv, authTag, cifrado]).toString("base64");
}

// Acepta también el formato legado (JSON plano, sin el prefijo "enc:v1:")
// por si alguna fila quedara sin migrar — no debería pasar tras la
// migración de datos, pero así no rompe el endpoint si ocurriera.
export function descifrarJson(valor: string | null | undefined): Record<string, unknown> {
  if (!valor) return {};
  if (!valor.startsWith(PREFIJO)) {
    try {
      return JSON.parse(valor);
    } catch {
      return {};
    }
  }
  const buf = Buffer.from(valor.slice(PREFIJO.length), "base64");
  const iv = buf.subarray(0, LARGO_IV);
  const authTag = buf.subarray(LARGO_IV, LARGO_IV + LARGO_TAG);
  const cifrado = buf.subarray(LARGO_IV + LARGO_TAG);
  const decipher = crypto.createDecipheriv(ALGORITMO, llaveMaestra(), iv);
  decipher.setAuthTag(authTag);
  const descifrado = Buffer.concat([decipher.update(cifrado), decipher.final()]);
  return JSON.parse(descifrado.toString("utf8"));
}
