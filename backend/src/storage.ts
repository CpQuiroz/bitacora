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
// Genera una URL firmada temporal para ver la foto
// (nunca buckets públicos — buena práctica de seguridad)
// ------------------------------------------------------------
export async function urlFirmada(
  key: string,
  minutosValidez = 15
): Promise<string> {
  const command = new GetObjectCommand({ Bucket: BUCKET, Key: key });
  return getSignedUrl(client, command, { expiresIn: minutosValidez * 60 });
}
