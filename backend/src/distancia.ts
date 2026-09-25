// ============================================================
// Distancia por carretera entre ciudades (tarea 135, precio por km).
// Proveedor: OpenRouteService (mismos mapas OpenStreetMap que la app).
// Perfil de camión (driving-hgv), que respeta restricciones de vehículos
// pesados. Cada par ya calculado queda en distancias_cache (vale en ambos
// sentidos), así no se repiten consultas: el plan gratuito da ~2.000 al día
// por clave, compartida por todas las empresas (ver limitarDistancia).
// Todo pasa por calcularDistanciaKm(): cambiar de proveedor es cambiar este
// archivo.
//
// Distancia mala en la caché (ej. un lugar mal ubicado): el Admin siempre
// puede corregir los km a mano en el viaje; para arreglarla para todos,
// borrar la fila en distancias_cache (par_a, par_b normalizados) y se
// recalcula la próxima vez.
// ============================================================
import { normalizarLugar, parTramo } from "@bitacora/shared";
import { supabase } from "./supabase";
import { env } from "./env";

const ORS = "https://api.openrouteservice.org";
const TIMEOUT_MS = 10_000;
// Una ruta dentro de Chile continental no pasa de ~5.000 km por carretera.
const KM_MAXIMO = 6000;

export class ErrorDistancia extends Error {
  constructor(
    message: string,
    readonly status: 400 | 502 | 503
  ) {
    super(message);
  }
}

async function pedir(url: string, init?: RequestInit): Promise<unknown> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const r = await fetch(url, { ...init, headers: { ...(init?.headers ?? {}), Authorization: env.ORS_API_KEY! }, signal: ctrl.signal });
    if (!r.ok) throw new ErrorDistancia(`El servicio de mapas respondió ${r.status}`, 502);
    return await r.json();
  } catch (e) {
    if (e instanceof ErrorDistancia) throw e;
    throw new ErrorDistancia("No se pudo consultar el servicio de mapas", 502);
  } finally {
    clearTimeout(t);
  }
}

// Coordenadas por lugar normalizado, en memoria del proceso: una ciudad que
// aparece en varios pares no se vuelve a buscar.
const coordsCache = new Map<string, [number, number]>();

async function coordenadas(lugar: string): Promise<[number, number]> {
  const clave = normalizarLugar(lugar);
  const guardada = coordsCache.get(clave);
  if (guardada) return guardada;
  // Solo ciudades, comunas y provincias: evita que "Temuco" caiga en una
  // calle o local con el mismo nombre.
  const url = `${ORS}/geocode/search?text=${encodeURIComponent(lugar)}&boundary.country=CL&layers=locality,localadmin,county&size=1`;
  const j = (await pedir(url)) as { features?: { geometry?: { coordinates?: [number, number] } }[] };
  const c = j.features?.[0]?.geometry?.coordinates;
  if (!c) throw new ErrorDistancia(`No encontré la ciudad "${lugar}" en el mapa. Revisa el nombre o ingresa los km a mano.`, 400);
  if (coordsCache.size > 2000) coordsCache.clear();
  coordsCache.set(clave, c);
  return c;
}

async function kmPorCarretera(origen: string, destino: string): Promise<number> {
  const [a, b] = await Promise.all([coordenadas(origen), coordenadas(destino)]);
  const j = (await pedir(`${ORS}/v2/directions/driving-hgv`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ coordinates: [a, b] }),
  })) as { routes?: { summary?: { distance?: number } }[] };
  const metros = j.routes?.[0]?.summary?.distance;
  if (typeof metros !== "number") throw new ErrorDistancia(`No hay ruta por carretera entre ${origen} y ${destino}`, 400);
  const km = Math.round(metros / 100) / 10; // 1 decimal
  if (!(km > 0) || km > KM_MAXIMO) throw new ErrorDistancia(`La distancia entre ${origen} y ${destino} no parece correcta (${km} km). Ingrésala a mano.`, 400);
  return km;
}

export async function calcularDistanciaKm(origen: string, destino: string): Promise<{ km: number; desdeCache: boolean }> {
  const par = parTramo(origen, destino);
  if (par.par_a === par.par_b) return { km: 0, desdeCache: true };
  const { data: guardada, error: errLectura } = await supabase.from("distancias_cache").select("km").eq("par_a", par.par_a).eq("par_b", par.par_b).maybeSingle();
  if (errLectura) console.error(`[distancia] no se pudo leer la caché: ${errLectura.message}`);
  if (guardada) return { km: Number(guardada.km), desdeCache: true };
  if (!env.ORS_API_KEY) throw new ErrorDistancia("El cálculo de km con mapa no está configurado todavía: ingresa los km a mano.", 503);
  const km = await kmPorCarretera(origen, destino);
  const { error: errGuardar } = await supabase.from("distancias_cache").upsert({ ...par, km, proveedor: "openrouteservice", calculado_en: new Date().toISOString() });
  if (errGuardar) console.error(`[distancia] no se pudo guardar en la caché: ${errGuardar.message}`);
  return { km, desdeCache: false };
}

// Recorrido con paradas: suma de sus tramos (calculados en paralelo).
export async function distanciaRecorridoKm(paradas: string[]): Promise<{ km: number; tramos: { origen: string; destino: string; km: number }[] }> {
  const limpias = paradas.map((p) => p.trim()).filter(Boolean);
  const pares = limpias.slice(0, -1).map((o, i) => ({ origen: o, destino: limpias[i + 1]! }));
  const tramos = await Promise.all(pares.map(async (p) => ({ ...p, km: (await calcularDistanciaKm(p.origen, p.destino)).km })));
  return { km: Math.round(tramos.reduce((s, t) => s + t.km, 0) * 10) / 10, tramos };
}
