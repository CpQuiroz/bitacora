// ============================================================
// BITÁCORA — Optimización de rutas (MVP)
//
// Nearest-neighbor sobre distancia en línea recta (haversine),
// sin API de ruteo — no hace falta un solver exacto para esto.
// Funciones puras, sin acceso a base de datos, para que sean
// fáciles de probar y de razonar.
// ============================================================

export type PuntoGeo = { lat: number; lng: number };

function aRadianes(grados: number): number {
  return (grados * Math.PI) / 180;
}

// Distancia en línea recta entre dos coordenadas, en km.
export function distanciaKm(a: PuntoGeo, b: PuntoGeo): number {
  const RADIO_TIERRA_KM = 6371;
  const dLat = aRadianes(b.lat - a.lat);
  const dLng = aRadianes(b.lng - a.lng);
  const lat1 = aRadianes(a.lat);
  const lat2 = aRadianes(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return RADIO_TIERRA_KM * 2 * Math.asin(Math.sqrt(h));
}

export type TareaGeo = { id: string; lat: number | null; lng: number | null };

export type ParadaSecuenciada = { id: string; distanciaDesdeAnteriorKm: number };

export type ResultadoSecuencia = {
  ordenConCoords: ParadaSecuenciada[];
  sinCoordsIds: string[]; // van al final, no entran al cálculo de distancia
  distanciaTotalKm: number;
};

// Vecino más cercano: en cada paso, visita la tarea sin visitar más
// cercana al punto actual (empezando en el punto base).
export function secuenciarNearestNeighbor(
  origen: PuntoGeo,
  tareas: TareaGeo[]
): ResultadoSecuencia {
  const conCoords = tareas.filter(
    (t): t is TareaGeo & { lat: number; lng: number } => t.lat != null && t.lng != null
  );
  const sinCoordsIds = tareas.filter((t) => t.lat == null || t.lng == null).map((t) => t.id);

  const restantes = [...conCoords];
  const ordenConCoords: ParadaSecuenciada[] = [];
  let actual: PuntoGeo = origen;
  let distanciaTotalKm = 0;

  while (restantes.length > 0) {
    let mejorIdx = 0;
    let mejorDist = Infinity;
    for (let i = 0; i < restantes.length; i++) {
      const d = distanciaKm(actual, restantes[i]);
      if (d < mejorDist) {
        mejorDist = d;
        mejorIdx = i;
      }
    }
    const [elegido] = restantes.splice(mejorIdx, 1);
    ordenConCoords.push({ id: elegido.id, distanciaDesdeAnteriorKm: mejorDist });
    distanciaTotalKm += mejorDist;
    actual = elegido;
  }

  return { ordenConCoords, sinCoordsIds, distanciaTotalKm };
}

const VELOCIDAD_PROMEDIO_KMH = 35; // supuesto razonable para tráfico urbano

export type AsignacionHorario = {
  id: string;
  hora_estimada_llegada: string | null; // "HH:MM", null si no alcanza a caber
  fuera_de_horario: boolean;
};

function horaAMinutos(hora: string): number {
  const [h, m] = hora.split(":").map(Number);
  return h * 60 + (m || 0);
}

function minutosAHora(minutos: number): string {
  const h = Math.floor(minutos / 60) % 24;
  const m = minutos % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

// Recorre las paradas ya secuenciadas y les asigna hora estimada de
// llegada, sumando tiempo de viaje (estimado desde la distancia) +
// duración de cada tarea, saltando el bloque de almuerzo si el
// cursor cae dentro. Tareas que ya no caben antes de horaFin quedan
// con hora_estimada_llegada: null y fuera_de_horario: true (no se
// descartan, solo se marcan).
export function asignarHorarios(
  paradas: ParadaSecuenciada[],
  duraciones: Record<string, number | null | undefined>,
  horaInicio: string,
  horaFin: string,
  almuerzoInicio?: string | null,
  almuerzoFin?: string | null
): { asignaciones: AsignacionHorario[]; duracionTotalMin: number } {
  const inicioMin = horaAMinutos(horaInicio);
  const finMin = horaAMinutos(horaFin);
  const almInicioMin = almuerzoInicio ? horaAMinutos(almuerzoInicio) : null;
  const almFinMin = almuerzoFin ? horaAMinutos(almuerzoFin) : null;

  let cursor = inicioMin;
  const asignaciones: AsignacionHorario[] = [];

  for (const parada of paradas) {
    const minutosViaje = Math.round((parada.distanciaDesdeAnteriorKm / VELOCIDAD_PROMEDIO_KMH) * 60);
    cursor += minutosViaje;

    if (almInicioMin != null && almFinMin != null && cursor >= almInicioMin && cursor < almFinMin) {
      cursor = almFinMin;
    }

    const duracion = duraciones[parada.id] ?? 30;
    const fueraDeHorario = cursor >= finMin;
    asignaciones.push({
      id: parada.id,
      hora_estimada_llegada: fueraDeHorario ? null : minutosAHora(cursor),
      fuera_de_horario: fueraDeHorario,
    });
    cursor += duracion;
  }

  return { asignaciones, duracionTotalMin: Math.max(0, cursor - inicioMin) };
}
