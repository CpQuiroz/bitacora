import AsyncStorage from "@react-native-async-storage/async-storage";

// Preferencias del dispositivo (no de la cuenta). Se cachean en memoria
// para que la cola de sincronización (código no-React) pueda leerlas
// sincrónicamente.

export type Preferencias = {
  descargarDiaAlAbrir: boolean;
  fotosSoloWifi: boolean;
};

const DEFECTO: Preferencias = { descargarDiaAlAbrir: false, fotosSoloWifi: false };
const CLAVE = "prefs:v1";

let cache: Preferencias = { ...DEFECTO };
const subs = new Set<(p: Preferencias) => void>();

export async function cargarPreferencias(): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(CLAVE);
    if (raw) cache = { ...DEFECTO, ...(JSON.parse(raw) as Partial<Preferencias>) };
  } catch {
    // se queda con los defaults
  }
}

export function preferencias(): Preferencias {
  return cache;
}

export async function setPreferencia<K extends keyof Preferencias>(clave: K, valor: Preferencias[K]): Promise<void> {
  cache = { ...cache, [clave]: valor };
  subs.forEach((f) => f(cache));
  try {
    await AsyncStorage.setItem(CLAVE, JSON.stringify(cache));
  } catch {
    // best-effort
  }
}

export function suscribirPreferencias(fn: (p: Preferencias) => void): () => void {
  subs.add(fn);
  return () => subs.delete(fn);
}
