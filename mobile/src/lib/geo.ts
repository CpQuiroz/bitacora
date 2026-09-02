import * as Location from "expo-location";

export type Ubicacion = { lat: number; lng: number; precision_m: number | null };

/**
 * Pide permiso (si hace falta) y devuelve la ubicación actual. Devuelve
 * null si el usuario niega el permiso o el GPS falla — el check-in
 * igual se puede hacer, solo que sin coordenadas.
 */
export async function ubicacionActual(): Promise<Ubicacion | null> {
  try {
    const permiso = await Location.getForegroundPermissionsAsync();
    let concedido = permiso.granted;
    if (!concedido && permiso.canAskAgain) {
      concedido = (await Location.requestForegroundPermissionsAsync()).granted;
    }
    if (!concedido) return null;

    const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    return {
      lat: Number(pos.coords.latitude.toFixed(6)),
      lng: Number(pos.coords.longitude.toFixed(6)),
      precision_m: pos.coords.accuracy != null ? Number(pos.coords.accuracy.toFixed(1)) : null,
    };
  } catch {
    return null;
  }
}

/** Distancia en metros entre dos puntos (Haversine). */
export function distanciaMetros(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371000;
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return Math.round(R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s)));
}
