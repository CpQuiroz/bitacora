import { Alert } from "react-native";
import * as ImagePicker from "expo-image-picker";
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

export type FotoElegida = { uri: string; name: string; type: string };

async function procesarAssets(assets: ImagePicker.ImagePickerAsset[]): Promise<FotoElegida[]> {
  const out: FotoElegida[] = [];
  for (const a of assets) {
    const uri = await comprimirImagen(a.uri, a.width);
    out.push({ uri, name: a.fileName ?? `foto-${Date.now()}.jpg`, type: a.mimeType ?? "image/jpeg" });
  }
  return out;
}

async function fotosDesdeCamara(): Promise<FotoElegida[]> {
  const permiso = await ImagePicker.requestCameraPermissionsAsync();
  if (!permiso.granted) {
    Alert.alert("Permiso necesario", "Necesitamos la cámara para la foto.");
    return [];
  }
  const r = await ImagePicker.launchCameraAsync({ quality: 0.8 });
  if (r.canceled) return [];
  return procesarAssets(r.assets);
}

async function fotosDesdeGaleria(multiple: boolean): Promise<FotoElegida[]> {
  const permiso = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permiso.granted) {
    Alert.alert("Permiso necesario", "Necesitamos acceso a tus fotos.");
    return [];
  }
  const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.8, allowsMultipleSelection: multiple });
  if (r.canceled) return [];
  return procesarAssets(r.assets);
}

// Selector único cámara/galería — TODA pantalla que suba fotos debe usar
// esto en vez de llamar a ImagePicker directo (regla "reutilizá, no
// reimplementar"). Antes cada pantalla solo ofrecía cámara; pedido real
// de la usuaria (2026-09-11): también poder elegir desde la galería
// (fotos ya tomadas, o para reemplazar una que salió borrosa).
export function elegirFotos(opciones?: { multiple?: boolean; titulo?: string }): Promise<FotoElegida[]> {
  return new Promise((resolve) => {
    Alert.alert(opciones?.titulo ?? "Agregar foto", undefined, [
      { text: "Tomar foto", onPress: () => void fotosDesdeCamara().then(resolve) },
      { text: "Elegir de galería", onPress: () => void fotosDesdeGaleria(Boolean(opciones?.multiple)).then(resolve) },
      { text: "Cancelar", style: "cancel", onPress: () => resolve([]) },
    ]);
  });
}
