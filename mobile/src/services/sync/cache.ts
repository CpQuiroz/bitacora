import AsyncStorage from "@react-native-async-storage/async-storage";

// Caché de lecturas: guarda la última respuesta buena de la API para
// poder mostrar algo cuando no hay señal. Cada entrada lleva su
// timestamp para el banner "datos de las HH:MM".

const PREFIJO = "cache:";

export type EntradaCache<T> = { datos: T; guardadoEn: number };

export async function guardarCache<T>(clave: string, datos: T): Promise<void> {
  try {
    await AsyncStorage.setItem(PREFIJO + clave, JSON.stringify({ datos, guardadoEn: Date.now() }));
  } catch {
    // storage lleno / no disponible — la caché es best-effort.
  }
}

export async function leerCache<T>(clave: string): Promise<EntradaCache<T> | null> {
  try {
    const raw = await AsyncStorage.getItem(PREFIJO + clave);
    if (!raw) return null;
    return JSON.parse(raw) as EntradaCache<T>;
  } catch {
    return null;
  }
}

export async function borrarCache(clave: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(PREFIJO + clave);
  } catch {
    /* noop */
  }
}

/**
 * Borra TODA la caché de lecturas (claves "cache:*"). Se llama al cerrar
 * sesión: sin esto, una caché vieja (ej. el equipo de la empresa cuando
 * tenía 1 solo usuario) sobrevive al logout/login y, si la API no logra
 * refrescarla — Render dormido, señal intermitente —, la pantalla sigue
 * mostrando el dato viejo para siempre (las entradas no tienen TTL).
 * NO toca la cola de sync ("sync:*"), que debe sobrevivir.
 */
export async function limpiarCacheLecturas(): Promise<void> {
  try {
    const claves = await AsyncStorage.getAllKeys();
    const nuestras = claves.filter((k) => k.startsWith(PREFIJO));
    if (nuestras.length > 0) await AsyncStorage.multiRemove(nuestras);
  } catch {
    /* noop */
  }
}
