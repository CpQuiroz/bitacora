// ============================================================
// BITÁCORA — Cifrado simétrico para secretos (credenciales de
// Integraciones, secreto TOTP de Super-Admin). AES-256-GCM nativo de
// Node, sin dependencia externa. La llave la pasa cada caller (nunca
// vive en este archivo) — así una fuga de una llave no compromete lo
// cifrado con otra. Nunca en el código, nunca en el frontend, nunca
// en git.
// ============================================================
import crypto from "node:crypto";

const ALGORITMO = "aes-256-gcm";
const PREFIJO = "enc:v1:";
const LARGO_IV = 12;
const LARGO_TAG = 16;

function decodificarLlave(llaveBase64: string, nombreEnvVar: string): Buffer {
  const llave = Buffer.from(llaveBase64, "base64");
  if (llave.length !== 32) {
    throw new Error(`${nombreEnvVar} debe decodificar a 32 bytes en base64 (usa: openssl rand -base64 32)`);
  }
  return llave;
}

export function cifrarJson(datos: Record<string, unknown>, llaveBase64: string, nombreEnvVar: string): string {
  const iv = crypto.randomBytes(LARGO_IV);
  const cipher = crypto.createCipheriv(ALGORITMO, decodificarLlave(llaveBase64, nombreEnvVar), iv);
  const cifrado = Buffer.concat([cipher.update(Buffer.from(JSON.stringify(datos), "utf8")), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return PREFIJO + Buffer.concat([iv, authTag, cifrado]).toString("base64");
}

// Acepta también el formato legado (JSON plano, sin el prefijo "enc:v1:")
// por si alguna fila quedara sin migrar — no debería pasar tras la
// migración de datos, pero así no rompe el endpoint si ocurriera.
export function descifrarJson(valor: string | null | undefined, llaveBase64: string, nombreEnvVar: string): Record<string, unknown> {
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
  const decipher = crypto.createDecipheriv(ALGORITMO, decodificarLlave(llaveBase64, nombreEnvVar), iv);
  decipher.setAuthTag(authTag);
  const descifrado = Buffer.concat([decipher.update(cifrado), decipher.final()]);
  return JSON.parse(descifrado.toString("utf8"));
}
