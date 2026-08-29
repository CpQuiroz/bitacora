// ============================================================
// Hash de password del Super-Admin — scrypt nativo de Node (KDF
// resistente a fuerza bruta por GPU), sin dependencia externa (sin
// bcrypt). Formato almacenado: "saltHex:hashHex".
// ============================================================
import crypto from "node:crypto";

const LARGO_SALT = 16;
const LARGO_HASH = 64;

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(LARGO_SALT);
  const hash = crypto.scryptSync(password, salt, LARGO_HASH);
  return `${salt.toString("hex")}:${hash.toString("hex")}`;
}

export function verificarPassword(password: string, almacenado: string): boolean {
  const [saltHex, hashHex] = almacenado.split(":");
  if (!saltHex || !hashHex) return false;
  const salt = Buffer.from(saltHex, "hex");
  const hashEsperado = Buffer.from(hashHex, "hex");
  const hashCalculado = crypto.scryptSync(password, salt, LARGO_HASH);
  return hashCalculado.length === hashEsperado.length && crypto.timingSafeEqual(hashCalculado, hashEsperado);
}
