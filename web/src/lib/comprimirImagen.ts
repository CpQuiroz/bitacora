// Comprime una imagen en el navegador antes de subirla (resize +
// recompresión JPEG vía Canvas) — sin dependencia nueva, evita subir
// fotos de cámara de varios MB tal cual.
export async function comprimirImagen(
  archivo: File,
  maxAncho = 1600,
  calidad = 0.7
): Promise<File> {
  if (!archivo.type.startsWith("image/")) return archivo;

  const bitmap = await createImageBitmap(archivo).catch(() => null);
  if (!bitmap) return archivo;

  const escala = Math.min(1, maxAncho / bitmap.width);
  const ancho = Math.round(bitmap.width * escala);
  const alto = Math.round(bitmap.height * escala);

  const canvas = document.createElement("canvas");
  canvas.width = ancho;
  canvas.height = alto;
  const ctx = canvas.getContext("2d");
  if (!ctx) return archivo;
  ctx.drawImage(bitmap, 0, 0, ancho, alto);

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", calidad)
  );
  if (!blob) return archivo;

  return new File([blob], archivo.name.replace(/\.\w+$/, ".jpg"), { type: "image/jpeg" });
}
