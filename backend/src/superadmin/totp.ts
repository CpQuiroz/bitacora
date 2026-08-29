// ============================================================
// TOTP (RFC 6238, sobre HOTP de RFC 4226) implementado a mano con
// crypto nativo de Node — sin dependencia externa (mismo criterio que
// portalAuth.ts). Compatible con Google Authenticator, Authy, 1Password
// y cualquier app que siga el estándar.
// ============================================================
import crypto from "node:crypto";

const BASE32_ALFABETO = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const PASO_SEGUNDOS = 30;
const DIGITOS = 6;

function base32Encode(buffer: Buffer): string {
  let bits = "";
  for (const byte of buffer) bits += byte.toString(2).padStart(8, "0");
  let salida = "";
  for (let i = 0; i + 5 <= bits.length; i += 5) {
    salida += BASE32_ALFABETO[parseInt(bits.slice(i, i + 5), 2)];
  }
  const resto = bits.length % 5;
  if (resto > 0) {
    const ultimoGrupo = bits.slice(bits.length - resto).padEnd(5, "0");
    salida += BASE32_ALFABETO[parseInt(ultimoGrupo, 2)];
  }
  return salida;
}

function base32Decode(texto: string): Buffer {
  const limpio = texto.toUpperCase().replace(/[^A-Z2-7]/g, "");
  let bits = "";
  for (const char of limpio) {
    const valor = BASE32_ALFABETO.indexOf(char);
    if (valor === -1) continue;
    bits += valor.toString(2).padStart(5, "0");
  }
  const bytes: number[] = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    bytes.push(parseInt(bits.slice(i, i + 8), 2));
  }
  return Buffer.from(bytes);
}

export function generarSecretoTotp(): string {
  return base32Encode(crypto.randomBytes(20));
}

export function otpauthUri(secretoBase32: string, correo: string): string {
  return `otpauth://totp/Bitacora%20Super-Admin:${encodeURIComponent(correo)}?secret=${secretoBase32}&issuer=Bitacora&algorithm=SHA1&digits=${DIGITOS}&period=${PASO_SEGUNDOS}`;
}

function codigoParaContador(secretoBase32: string, contador: number): string {
  const key = base32Decode(secretoBase32);
  const contadorBuffer = Buffer.alloc(8);
  contadorBuffer.writeBigUInt64BE(BigInt(contador));
  const digest = crypto.createHmac("sha1", key).update(contadorBuffer).digest();
  const offset = digest[digest.length - 1] & 0xf;
  const binario =
    ((digest[offset] & 0x7f) << 24) |
    ((digest[offset + 1] & 0xff) << 16) |
    ((digest[offset + 2] & 0xff) << 8) |
    (digest[offset + 3] & 0xff);
  return String(binario % 10 ** DIGITOS).padStart(DIGITOS, "0");
}

// Tolera ±1 paso (30s) de desfase de reloj entre el server y el celular.
export function verificarCodigoTotp(secretoBase32: string, codigo: string): boolean {
  if (!/^\d{6}$/.test(codigo)) return false;
  const contadorActual = Math.floor(Date.now() / 1000 / PASO_SEGUNDOS);
  for (const delta of [0, -1, 1]) {
    const esperado = codigoParaContador(secretoBase32, contadorActual + delta);
    const a = Buffer.from(codigo);
    const b = Buffer.from(esperado);
    if (a.length === b.length && crypto.timingSafeEqual(a, b)) return true;
  }
  return false;
}
