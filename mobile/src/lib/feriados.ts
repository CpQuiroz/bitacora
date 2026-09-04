// Feriados legales de Chile, para pintarlos en la Agenda (punto verde).
//
// Es una tabla estática: la app no tiene un endpoint de feriados y no
// vale la pena depender de una API externa para un detalle visual. Hay
// que **revisarla una vez al año** contra https://www.feriados.cl o
// https://www.dt.gob.cl. Los feriados movibles (San Pedro y San Pablo,
// Encuentro de Dos Mundos) se trasladan al lunes cuando caen martes a
// jueves — las fechas de abajo ya vienen con ese ajuste aplicado.
//
// Si el año consultado no está en la tabla, `esFeriado` devuelve null y
// la Agenda simplemente no pinta feriados ese año (no rompe nada).

const FERIADOS: Record<string, string> = {
  // 2026
  "2026-01-01": "Año Nuevo",
  "2026-04-03": "Viernes Santo",
  "2026-04-04": "Sábado Santo",
  "2026-05-01": "Día del Trabajo",
  "2026-05-21": "Glorias Navales",
  "2026-06-21": "Día de los Pueblos Indígenas",
  "2026-06-29": "San Pedro y San Pablo",
  "2026-07-16": "Virgen del Carmen",
  "2026-08-15": "Asunción de la Virgen",
  "2026-09-18": "Independencia Nacional",
  "2026-09-19": "Glorias del Ejército",
  "2026-10-12": "Encuentro de Dos Mundos",
  "2026-10-31": "Iglesias Evangélicas y Protestantes",
  "2026-11-01": "Día de Todos los Santos",
  "2026-12-08": "Inmaculada Concepción",
  "2026-12-25": "Navidad",

  // 2027
  "2027-01-01": "Año Nuevo",
  "2027-03-26": "Viernes Santo",
  "2027-03-27": "Sábado Santo",
  "2027-05-01": "Día del Trabajo",
  "2027-05-21": "Glorias Navales",
  "2027-06-21": "Día de los Pueblos Indígenas",
  "2027-06-28": "San Pedro y San Pablo",
  "2027-07-16": "Virgen del Carmen",
  "2027-08-15": "Asunción de la Virgen",
  "2027-09-17": "Feriado adicional Fiestas Patrias",
  "2027-09-18": "Independencia Nacional",
  "2027-09-19": "Glorias del Ejército",
  "2027-10-11": "Encuentro de Dos Mundos",
  "2027-10-31": "Iglesias Evangélicas y Protestantes",
  "2027-11-01": "Día de Todos los Santos",
  "2027-12-08": "Inmaculada Concepción",
  "2027-12-25": "Navidad",
};

/** Nombre del feriado para una fecha `YYYY-MM-DD`, o null si no lo es. */
export function esFeriado(claveISO: string): string | null {
  return FERIADOS[claveISO] ?? null;
}

/** ¿Hay datos de feriados cargados para ese año? */
export function hayFeriadosDe(anio: number): boolean {
  return Object.keys(FERIADOS).some((k) => k.startsWith(`${anio}-`));
}
