// ============================================================
// Distancia por carretera entre ciudades (tarea 135, precio por km).
// Proveedor: OpenRouteService (mismos mapas OpenStreetMap que la app).
// Perfil de camión (driving-hgv), que respeta restricciones de vehículos
// pesados. Cada par ya calculado queda en distancias_cache (vale en ambos
// sentidos), así no se repiten consultas: el plan gratuito da ~2.000 al día.
// Todo pasa por calcularDistanciaKm(): cambiar de proveedor es cambiar este
// archivo.
// ============================================================
import { parTramo } from "@bitacora/shared";
import { supabase } from "./supabase";
import { env } from "./env";

const ORS = "https://api.openrouteservice.org";
const TIMEOUT_MS = 10_000;

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
    const r = await fetch(url, { ...init, signal: ctrl.signal });
    if (!r.ok) throw new ErrorDistancia(`El servicio de mapas respondió ${r.status}`, 502);
    return await r.json();
  } catch (e) {
    if (e instanceof ErrorDistancia) throw e;
    throw new ErrorDistancia("No se pudo consultar el servicio de mapas", 502);
  } finally {
    clearTimeout(t);
  }
}

async function coordenadas(lugar: string): Promise<[number, number]> {
  const url = `${ORS}/geocode/search?api_key=${encodeURIComponent(env.ORS_API_KEY!)}&text=${encodeURIComponent(lugar)}&boundary.country=CL&size=1`;
  const j = (await pedir(url)) as { features?: { geometry?: { coordinates?: [number, number] } }[] };
  const c = j.features?.[0]?.geometry?.coordinates;
  if (!c) throw new ErrorDistancia(`No encontré "${lugar}" en el mapa. Revisa el nombre de la ciudad.`, 400);
  return c;
}

async function kmPorCarretera(origen: string, destino: string): Promise<number> {
  const [a, b] = await Promise.all([coordenadas(origen), coordenadas(destino)]);
  const j = (await pedir(`${ORS}/v2/directions/driving-hgv`, {
    method: "POST",
    headers: { Authorization: env.ORS_API_KEY!, "Content-Type": "application/json" },
    body: JSON.stringify({ coordinates: [a, b] }),
  })) as { routes?: { summary?: { distance?: number } }[] };
  const metros = j.routes?.[0]?.summary?.distance;
  if (typeof metros !== "number") throw new ErrorDistancia(`No hay ruta por carretera entre ${origen} y ${destino}`, 400);
  return Math.round(metros / 100) / 10; // km con 1 decimal
}

export async function calcularDistanciaKm(origen: string, destino: string): Promise<{ km: number; desdeCache: boolean }> {
  const par = parTramo(origen, destino);
  if (par.par_a === par.par_b) return { km: 0, desdeCache: true };
  const { data: guardada } = await supabase.from("distancias_cache").select("km").eq("par_a", par.par_a).eq("par_b", par.par_b).maybeSingle();
  if (guardada) return { km: Number(guardada.km), desdeCache: true };
  if (!env.ORS_API_KEY) throw new ErrorDistancia("El cálculo de km con mapa no está configurado todavía: ingresa los km a mano.", 503);
  const km = await kmPorCarretera(origen, destino);
  await supabase.from("distancias_cache").upsert({ ...par, km, proveedor: "openrouteservice", calculado_en: new Date().toISOString() });
  return { km, desdeCache: false };
}

// Recorrido con paradas: suma de sus tramos.
export async function distanciaRecorridoKm(paradas: string[]): Promise<{ km: number; tramos: { origen: string; destino: string; km: number }[] }> {
  const limpias = paradas.map((p) => p.trim()).filter(Boolean);
  const tramos: { origen: string; destino: string; km: number }[] = [];
  for (let i = 0; i < limpias.length - 1; i++) {
    const { km } = await calcularDistanciaKm(limpias[i]!, limpias[i + 1]!);
    tramos.push({ origen: limpias[i]!, destino: limpias[i + 1]!, km });
  }
  return { km: Math.round(tramos.reduce((s, t) => s + t.km, 0) * 10) / 10, tramos };
}
