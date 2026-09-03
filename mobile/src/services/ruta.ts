import { apiJson } from "./api";
import { guardarCache, leerCache } from "./sync/cache";

export type Parada = {
  trabajo_id: string;
  cliente_nombre: string;
  direccion: string | null;
  lat: number | null;
  lng: number | null;
};

export async function obtenerRutaDelDia(): Promise<{ paradas: Parada[]; desdeCache: boolean; guardadoEn?: number }> {
  const res = await apiJson<{ paradas: Parada[] }>("/api/rutas");
  if (res.ok) {
    await guardarCache("ruta:hoy", res.data.paradas);
    return { paradas: res.data.paradas, desdeCache: false };
  }
  const cache = await leerCache<Parada[]>("ruta:hoy");
  if (cache) return { paradas: cache.datos, desdeCache: true, guardadoEn: cache.guardadoEn };
  throw new Error(res.error);
}
