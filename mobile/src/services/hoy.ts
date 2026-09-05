import type { EstadoOS } from "@bitacora/shared";
import { listarTrabajos } from "./trabajos";
import { listarTareasRango } from "./agenda";
import { listarViajesEquipo, listarViajesPropios } from "./viajes";
import { estadoOsDeTrabajo } from "@bitacora/shared";

// "Hoy": una sola lista cronológica con todo lo del día — trabajos,
// citas y viajes juntos, ordenados por hora. El rol define el alcance
// (propios vs. todo el equipo), no qué se ve.

export type TipoItemHoy = "trabajo" | "cita" | "viaje";

export type ItemHoy = {
  tipo: TipoItemHoy;
  id: string;
  hora: string | null; // "HH:MM" — null = sin hora, va al final
  titulo: string;
  subtitulo: string | null;
  estado: EstadoOS | string | null;
  lat: number | null;
  lng: number | null;
};

function hoyISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function hhmm(hora: string | null | undefined): string | null {
  return hora ? hora.slice(0, 5) : null;
}

export type ResultadoHoy = { items: ItemHoy[]; desdeCache: boolean; guardadoEn?: number };

/**
 * @param equipo  true = alcance de gestión (todo el equipo); false = solo lo propio.
 * @param incluirViajes  false si la empresa tiene el módulo "viajes" apagado.
 */
export async function cargarHoy(equipo: boolean, incluirViajes: boolean): Promise<ResultadoHoy> {
  const dia = hoyISO();

  const [rTrabajos, rCitas, rViajes] = await Promise.allSettled([
    listarTrabajos(equipo),
    listarTareasRango(dia, dia),
    incluirViajes ? (equipo ? listarViajesEquipo() : listarViajesPropios()) : Promise.resolve(null),
  ]);

  let desdeCache = false;
  let guardadoEn: number | undefined;
  const items: ItemHoy[] = [];

  if (rTrabajos.status === "fulfilled") {
    const r = rTrabajos.value;
    desdeCache = desdeCache || r.desdeCache;
    if (r.desdeCache) guardadoEn = r.guardadoEn;
    for (const tr of r.trabajos) {
      if (tr.fecha !== dia) continue;
      items.push({
        tipo: "trabajo",
        id: tr.id,
        hora: hhmm(tr.hora_programada),
        titulo: tr.cliente,
        subtitulo: tr.ubicacion ?? null,
        estado: tr.orden?.estado_os ?? estadoOsDeTrabajo(tr.estado),
        lat: null,
        lng: null,
      });
    }
  }

  if (rCitas.status === "fulfilled") {
    const r = rCitas.value;
    desdeCache = desdeCache || r.desdeCache;
    if (r.desdeCache && guardadoEn == null) guardadoEn = r.guardadoEn;
    for (const c of r.tareas) {
      if (c.fecha !== dia) continue;
      items.push({
        tipo: "cita",
        id: c.id,
        hora: hhmm(c.hora),
        titulo: c.titulo || c.cliente?.nombre || "Cita",
        subtitulo: c.cliente?.nombre && c.titulo ? c.cliente.nombre : c.cliente?.direccion ?? null,
        estado: c.estado,
        lat: c.cliente?.lat ?? null,
        lng: c.cliente?.lng ?? null,
      });
    }
  }

  if (rViajes.status === "fulfilled" && rViajes.value) {
    const r = rViajes.value;
    desdeCache = desdeCache || r.desdeCache;
    if (r.desdeCache && guardadoEn == null) guardadoEn = r.guardadoEn;
    for (const v of r.viajes) {
      if (v.fecha !== dia) continue;
      items.push({
        tipo: "viaje",
        id: v.id,
        hora: null,
        titulo: v.cliente_info?.nombre ?? v.cliente ?? "Viaje",
        subtitulo: v.origen && v.destino ? `${v.origen} → ${v.destino}` : v.numero_guia ? `Guía ${v.numero_guia}` : null,
        estado: v.estado,
        lat: null,
        lng: null,
      });
    }
  }

  // Si las 3 fuentes fallaron, propaga el error de trabajos (la principal).
  if (
    rTrabajos.status === "rejected" &&
    rCitas.status === "rejected" &&
    (rViajes.status === "rejected" || rViajes.value == null)
  ) {
    throw rTrabajos.reason instanceof Error ? rTrabajos.reason : new Error("No se pudo cargar el día");
  }

  items.sort((a, b) => {
    if (a.hora && b.hora) return a.hora.localeCompare(b.hora);
    if (a.hora) return -1;
    if (b.hora) return 1;
    return a.titulo.localeCompare(b.titulo);
  });

  return { items, desdeCache, guardadoEn };
}
