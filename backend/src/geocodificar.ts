// Geocodificación gratis vía Nominatim (OpenStreetMap) — mismo stack
// gratuito que ya usamos para el mapa de rutas, sin API key. Política
// de uso de Nominatim: 1 request/seg, hay que identificarse con un
// User-Agent real. Si falla o no encuentra nada, no bloquea la
// creación del cliente — solo queda sin coordenadas.
export async function geocodificarDireccion(
  direccion: string
): Promise<{ lat: number; lng: number } | null> {
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(direccion)}`;
    const res = await fetch(url, {
      headers: { "User-Agent": "Bitacora-App/1.0 (contacto@bitacora.app)" },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;

    const data = (await res.json()) as Array<{ lat: string; lon: string }>;
    if (!Array.isArray(data) || data.length === 0) return null;

    const lat = Number(data[0].lat);
    const lng = Number(data[0].lon);
    if (Number.isNaN(lat) || Number.isNaN(lng)) return null;

    return { lat, lng };
  } catch {
    return null;
  }
}
