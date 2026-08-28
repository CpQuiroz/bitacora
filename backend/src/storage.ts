// ============================================================
// BITÁCORA — Capa de storage agnóstica (compatible S3)
// Funciona igual con Cloud Storage, AWS S3 o Cloudflare R2:
// solo cambian las variables de entorno, nunca el código de
// la app que sube/lee fotos.
//
// Fase 1: STORAGE_ENDPOINT apunta al endpoint S3 de Supabase
// Storage. Fase 2: solo cambian las env vars, apuntando a
// Cloud Storage — este archivo no se toca.
// ============================================================

import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { env } from "./env";

const client = new S3Client({
  endpoint: env.STORAGE_ENDPOINT,
  region: env.STORAGE_REGION,
  credentials: {
    accessKeyId: env.STORAGE_ACCESS_KEY,
    secretAccessKey: env.STORAGE_SECRET_KEY,
  },
  forcePathStyle: true, // requerido para compatibilidad con GCS/R2
});

const BUCKET = env.STORAGE_BUCKET;

// ------------------------------------------------------------
// Sube una foto de un trabajo
// ------------------------------------------------------------
export async function subirFoto(
  empresaId: string,
  trabajoId: string,
  archivo: Buffer | Uint8Array,
  contentType: string
): Promise<string> {
  const key = `${empresaId}/trabajos/${trabajoId}/${Date.now()}.jpg`;

  await client.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: archivo,
      ContentType: contentType,
    })
  );

  return key; // se guarda en analisis_fotos.foto_url
}

// ------------------------------------------------------------
// Sube la firma del cliente al cerrar una orden de servicio.
// ------------------------------------------------------------
export async function subirFirma(
  empresaId: string,
  trabajoId: string,
  archivo: Buffer | Uint8Array
): Promise<string> {
  const key = `${empresaId}/trabajos/${trabajoId}/firma-${Date.now()}.png`;

  await client.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: archivo,
      ContentType: "image/png",
    })
  );

  return key; // se guarda en ordenes_servicio.firma_url
}

// ------------------------------------------------------------
// Genera una URL firmada temporal para ver la foto (o cualquier
// otro archivo en un bucket privado — nunca buckets públicos para
// esto, buena práctica de seguridad)
// ------------------------------------------------------------
export async function urlFirmada(
  key: string,
  minutosValidez = 15,
  bucket: string = BUCKET
): Promise<string> {
  const command = new GetObjectCommand({ Bucket: bucket, Key: key });
  return getSignedUrl(client, command, { expiresIn: minutosValidez * 60 });
}

// ------------------------------------------------------------
// Sube el logo de una empresa. A diferencia de las fotos de
// trabajos, este bucket es público — un logo no es información
// sensible y se muestra todo el tiempo en la interfaz, así que
// no vale la pena firmar la URL cada vez.
// ------------------------------------------------------------
const BUCKET_LOGOS = "logos";

export async function subirLogo(
  empresaId: string,
  archivo: Buffer | Uint8Array,
  contentType: string
): Promise<string> {
  const extension = contentType === "image/png" ? "png" : contentType === "image/webp" ? "webp" : "jpg";
  const key = `${empresaId}.${extension}`;

  await client.send(
    new PutObjectCommand({
      Bucket: BUCKET_LOGOS,
      Key: key,
      Body: archivo,
      ContentType: contentType,
    })
  );

  // ?v= evita que quede cacheada una versión vieja tras resubir el logo.
  return `${env.SUPABASE_URL}/storage/v1/object/public/${BUCKET_LOGOS}/${key}?v=${Date.now()}`;
}

// ------------------------------------------------------------
// Foto de perfil de un usuario — reutiliza el bucket público de
// logos (mismo tipo de contenido: imagen no sensible que se
// muestra todo el tiempo), con prefijo "avatars/" para no
// pisarse con los logos de empresa.
// ------------------------------------------------------------
export async function subirFotoPerfil(
  usuarioId: string,
  archivo: Buffer | Uint8Array,
  contentType: string
): Promise<string> {
  const extension = contentType === "image/png" ? "png" : contentType === "image/webp" ? "webp" : "jpg";
  const key = `avatars/${usuarioId}.${extension}`;

  await client.send(
    new PutObjectCommand({
      Bucket: BUCKET_LOGOS,
      Key: key,
      Body: archivo,
      ContentType: contentType,
    })
  );

  return `${env.SUPABASE_URL}/storage/v1/object/public/${BUCKET_LOGOS}/${key}?v=${Date.now()}`;
}

// ------------------------------------------------------------
// Anexos de una tarea (documentos, fotos adicionales, etc. — hasta
// 20MB). Bucket privado, igual que fotos-trabajos: se ve con URL
// firmada, nunca público.
// ------------------------------------------------------------
const BUCKET_ANEXOS = "anexos";

export async function subirAnexo(
  empresaId: string,
  trabajoId: string,
  nombreOriginal: string,
  archivo: Buffer | Uint8Array,
  contentType: string
): Promise<string> {
  const nombreSeguro = nombreOriginal.replace(/[^a-zA-Z0-9._-]/g, "_");
  const key = `${empresaId}/trabajos/${trabajoId}/${Date.now()}-${nombreSeguro}`;

  await client.send(
    new PutObjectCommand({
      Bucket: BUCKET_ANEXOS,
      Key: key,
      Body: archivo,
      ContentType: contentType,
    })
  );

  return key; // se guarda en trabajos.anexos[].key
}

export function urlFirmadaAnexo(key: string, minutosValidez = 15): Promise<string> {
  return urlFirmada(key, minutosValidez, BUCKET_ANEXOS);
}

// ------------------------------------------------------------
// Comprobante/factura de un gasto (imagen o PDF). Bucket privado
// como anexos — un comprobante de compra es información financiera
// sensible, se ve con URL firmada.
// ------------------------------------------------------------
export async function subirComprobante(
  empresaId: string,
  gastoId: string,
  nombreOriginal: string,
  archivo: Buffer | Uint8Array,
  contentType: string
): Promise<string> {
  const nombreSeguro = nombreOriginal.replace(/[^a-zA-Z0-9._-]/g, "_");
  const key = `${empresaId}/gastos/${gastoId}/${Date.now()}-${nombreSeguro}`;

  await client.send(
    new PutObjectCommand({
      Bucket: BUCKET_ANEXOS,
      Key: key,
      Body: archivo,
      ContentType: contentType,
    })
  );

  return key; // se guarda en gastos.comprobante_url
}

export function urlFirmadaComprobante(key: string, minutosValidez = 15): Promise<string> {
  return urlFirmada(key, minutosValidez, BUCKET_ANEXOS);
}
