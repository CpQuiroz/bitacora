// Región Metropolitana de Santiago — para sugerir el tipo de viático de un
// viaje (tarea 137): local si origen y destino están dentro de la RM,
// interregional si alguno sale. Solo SUGIERE: el Admin puede cambiarlo,
// porque origen/destino son texto libre y puede venir una dirección.
import type { TipoViatico } from "./types";

// Las 52 comunas de la RM + localidades de CIUDADES_CHILE que no son comuna.
const LUGARES_RM = [
  "Santiago", "Cerrillos", "Cerro Navia", "Conchalí", "El Bosque", "Estación Central", "Huechuraba",
  "Independencia", "La Cisterna", "La Florida", "La Granja", "La Pintana", "La Reina", "Las Condes",
  "Lo Barnechea", "Lo Espejo", "Lo Prado", "Macul", "Maipú", "Ñuñoa", "Pedro Aguirre Cerda",
  "Peñalolén", "Providencia", "Pudahuel", "Quilicura", "Quinta Normal", "Recoleta", "Renca",
  "San Joaquín", "San Miguel", "San Ramón", "Vitacura", "Puente Alto", "Pirque", "San José de Maipo",
  "Colina", "Lampa", "Til Til", "San Bernardo", "Buin", "Calera de Tango", "Paine", "Melipilla",
  "Alhué", "Curacaví", "María Pinto", "San Pedro", "Talagante", "El Monte", "Isla de Maipo",
  "Padre Hurtado", "Peñaflor",
  // Localidades
  "Batuco", "Chicureo", "Santiago Centro",
];

export function normalizarLugar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const SET_RM = new Set(LUGARES_RM.map(normalizarLugar));

// "Maipú", "maipu", "Maipú, RM" y "Región Metropolitana" cuentan como RM.
// "San Pedro" es comuna de la RM, pero también "San Pedro de Atacama" o
// "San Pedro de la Paz" existen: por eso se compara el lugar entero o su
// primer tramo antes de una coma, nunca un prefijo.
export function esRegionMetropolitana(lugar: string | null | undefined): boolean {
  if (!lugar) return false;
  const n = normalizarLugar(lugar);
  if (!n) return false;
  if (/\b(region metropolitana|rm)\b/.test(n)) return true;
  const primerTramo = normalizarLugar(lugar.split(",")[0] ?? "");
  return SET_RM.has(n) || SET_RM.has(primerTramo);
}

export function sugerirTipoViatico(origen: string | null | undefined, destino: string | null | undefined): TipoViatico {
  return esRegionMetropolitana(origen) && esRegionMetropolitana(destino) ? "local" : "interregional";
}
