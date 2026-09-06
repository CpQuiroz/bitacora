import { Directory, File, Paths } from "expo-file-system";

// Las fotos que esperan en la cola de sync se guardan acá — en
// document/, que el SO NO borra (a diferencia de cache/, donde caen las
// fotos recién sacadas y las que produce expo-image-manipulator). Sin
// esto, una foto encolada por horas terminaba con su archivo ya
// eliminado y no había reintento que la salvara.
export const DIR_FOTOS_COLA = new Directory(Paths.document, "fotos-cola");

/** ¿El archivo de esta foto todavía existe en el teléfono? */
export function fotoExiste(uri: string | undefined): boolean {
  if (!uri) return false;
  try {
    return new File(uri).exists;
  } catch {
    return false;
  }
}

/** Borra una foto persistida (tras subirla bien o descartar la acción). */
export function borrarFoto(uri: string | undefined): void {
  if (!uri || !uri.includes("fotos-cola")) return;
  try {
    const f = new File(uri);
    if (f.exists) f.delete();
  } catch {
    /* best-effort */
  }
}

/**
 * Mueve un archivo de foto (uri efímera de cámara / manipulator) a
 * document/fotos-cola/ y devuelve la uri nueva. Si algo falla, devuelve
 * la uri original (mejor subir desde cache que perder la foto).
 */
export async function persistirFoto(uriEfimera: string): Promise<string> {
  try {
    if (!DIR_FOTOS_COLA.exists) DIR_FOTOS_COLA.create({ idempotent: true });
    const origen = new File(uriEfimera);
    const nombre = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
    const destino = new File(DIR_FOTOS_COLA, nombre);
    await origen.move(destino);
    return destino.uri;
  } catch {
    return uriEfimera;
  }
}
