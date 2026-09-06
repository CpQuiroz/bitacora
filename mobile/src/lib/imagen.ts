import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import { persistirFoto } from "./fotoCola";

// Redimensiona (si hace falta) y recomprime a JPEG antes de subir —
// las fotos de cámara pueden pesar varios MB tal cual. El resultado se
// mueve a document/fotos-cola/ (persistente): si la foto queda esperando
// en la cola de sync, cache/ se puede limpiar y el archivo desaparece.
export async function comprimirImagen(
  uri: string,
  anchoOriginal: number,
  maxAncho = 1600,
  calidad = 0.6
): Promise<string> {
  const contexto = ImageManipulator.manipulate(uri);
  if (anchoOriginal > maxAncho) {
    contexto.resize({ width: maxAncho });
  }
  const renderizada = await contexto.renderAsync();
  const resultado = await renderizada.saveAsync({ compress: calidad, format: SaveFormat.JPEG });
  return persistirFoto(resultado.uri);
}
