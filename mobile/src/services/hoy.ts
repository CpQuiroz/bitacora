import type { EstadoOS } from "@bitacora/shared";
import { listarTrabajos } from "./trabajos";
import { listarTareasRango } from "./agenda";
import { listarViajesEquipo, listarViajesPropios } from "./viajes";
import { listarMisLevantamientos } from "./levantamientos";
import { estadoOsDeTrabajo, formatearFolio } from "@bitacora/shared";

// "Hoy"/"Pizarra": una sola lista cronológica con todo lo del día —
// trabajos, citas, viajes y levantamientos pendientes, juntos,
// ordenados por hora. El rol define el alcance (propios vs. todo el
// equipo), no qué se ve.
//
// Levantamientos (20-sep-2026, migración 111 — fecha_visita): antes no
// tenía ninguna fecha propia, así que TODOS los pendientes aparecían
// siempre, cualquier día. Ahora, si tiene fecha_visita asignada, se
// muestra el día que corresponde (y se queda visible si queda
// atrasado — mismo criterio que una tarea vencida, no desaparece
// sola). Sin fecha_visita (no asignada, o levantamientos creados antes
// de esta migración), sigue el comportamiento de siempre: aparece
// pendiente sin día fijo, sin hora, al final.
//
// Vista Semana (21-sep-2026, pedido: "en Pizarra quiero ver las
// actividades del día y de la semana") — cargarHoy() pasa de tener el
// día fijo adentro a recibir un rango [desde, hasta] (mismo shape que
// listarTareasRango, que ya lo aceptaba). Cada ítem ahora expone su
// propia `fecha` para que la pantalla pueda agruparlos por día en la
// vista Semana; en la vista Día, desde === hasta y el comportamiento
// es idéntico al de antes.

export type TipoItemHoy = "trabajo" | "cita" | "viaje" | "levantamiento";

export type ItemHoy = {
  tipo: TipoItemHoy;
  id: string;
  hora: string | null; // "HH:MM" — null = sin hora, va al final
  // Fecha propia del ítem (YYYY-MM-DD) — null solo para levantamientos
  // sin fecha_visita asignada (sin día fijo, ver comentario arriba).
  fecha: string | null;
  titulo: string;
  subtitulo: string | null;
  estado: EstadoOS | string | null;
  lat: number | null;
  lng: number | null;
  // Folio propio con prefijo ("OS-0042"/"CIT-0031"/"VIA-0012"/
  // "LEV-0004", ya formateado) — 18-sep-2026, pedido para distinguir el
  // tipo de un vistazo (antes solo un ícono chico y gris) y tener una
  // referencia citable. Null = sin folio (fila creada antes de la
  // migración 108, o falla al asignarlo).
  folio: string | null;
};

export function hoyISO(): string {
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
 * @param incluirLevantamientos  true si el usuario ve la sección Levantamientos (FUNCIONES_LEVANTAMIENTOS).
 * @param desde  primer día del rango a mostrar (YYYY-MM-DD) — vista Día: igual a `hasta`.
 * @param hasta  último día del rango a mostrar (YYYY-MM-DD).
 */
export async function cargarHoy(
  equipo: boolean,
  incluirViajes: boolean,
  incluirLevantamientos: boolean,
  desde: string,
  hasta: string
): Promise<ResultadoHoy> {
  const [rTrabajos, rCitas, rViajes, rLevantamientos] = await Promise.allSettled([
    listarTrabajos(equipo),
    listarTareasRango(desde, hasta),
    incluirViajes ? (equipo ? listarViajesEquipo() : listarViajesPropios()) : Promise.resolve(null),
    incluirLevantamientos ? listarMisLevantamientos() : Promise.resolve(null),
  ]);

  let desdeCache = false;
  let guardadoEn: number | undefined;
  const items: ItemHoy[] = [];

  if (rTrabajos.status === "fulfilled") {
    const r = rTrabajos.value;
    desdeCache = desdeCache || r.desdeCache;
    if (r.desdeCache) guardadoEn = r.guardadoEn;
    for (const tr of r.trabajos) {
      if (tr.fecha < desde || tr.fecha > hasta) continue;
      items.push({
        tipo: "trabajo",
        id: tr.id,
        hora: hhmm(tr.hora_programada),
        fecha: tr.fecha,
        titulo: tr.cliente,
        // El folio ahora se ve aparte (tag "OS-000X", ver HoyScreen) —
        // el subtítulo vuelve a ser solo la ubicación.
        subtitulo: tr.ubicacion ?? null,
        estado: tr.orden?.estado_os ?? estadoOsDeTrabajo(tr.estado),
        lat: null,
        lng: null,
        folio: formatearFolio("OS", tr.orden?.folio),
      });
    }
  }

  if (rCitas.status === "fulfilled") {
    const r = rCitas.value;
    desdeCache = desdeCache || r.desdeCache;
    if (r.desdeCache && guardadoEn == null) guardadoEn = r.guardadoEn;
    for (const c of r.tareas) {
      if (c.fecha < desde || c.fecha > hasta) continue;
      items.push({
        tipo: "cita",
        id: c.id,
        hora: hhmm(c.hora),
        fecha: c.fecha,
        titulo: c.titulo || c.cliente?.nombre || "Cita",
        subtitulo: c.cliente?.nombre && c.titulo ? c.cliente.nombre : c.cliente?.direccion ?? null,
        estado: c.estado,
        lat: c.cliente?.lat ?? null,
        lng: c.cliente?.lng ?? null,
        folio: formatearFolio("CIT", c.folio),
      });
    }
  }

  if (rViajes.status === "fulfilled" && rViajes.value) {
    const r = rViajes.value;
    desdeCache = desdeCache || r.desdeCache;
    if (r.desdeCache && guardadoEn == null) guardadoEn = r.guardadoEn;
    for (const v of r.viajes) {
      if (v.fecha < desde || v.fecha > hasta) continue;
      items.push({
        tipo: "viaje",
        id: v.id,
        hora: null,
        fecha: v.fecha,
        titulo: v.cliente_info?.nombre ?? v.cliente ?? "Viaje",
        subtitulo: v.origen && v.destino ? `${v.origen} → ${v.destino}` : v.numero_guia ? `Guía ${v.numero_guia}` : null,
        estado: v.estado,
        lat: null,
        lng: null,
        folio: formatearFolio("VIA", v.folio),
      });
    }
  }

  if (rLevantamientos.status === "fulfilled" && rLevantamientos.value) {
    // Solo los que todavía esperan algo del técnico — completado_tecnico
    // en adelante ya pasó a la oficina/cliente externo, no pertenece más
    // al tablero de terreno.
    for (const lev of rLevantamientos.value) {
      if (!["creado", "asignado", "en_terreno"].includes(lev.estado)) continue;
      // Con fecha futura (fuera del rango pedido): no acá, le toca a su
      // propio día/semana. Atrasada (antes de `desde`) u hoy: se
      // muestra igual — no desaparece sola, mismo criterio que una
      // tarea vencida (la pantalla la agrupa aparte si quedó antes del
      // rango visible). Sin fecha: comportamiento de siempre, siempre
      // visible (fecha: null).
      if (lev.fecha_visita && lev.fecha_visita > hasta) continue;
      items.push({
        tipo: "levantamiento",
        id: lev.id,
        hora: hhmm(lev.hora_visita),
        fecha: lev.fecha_visita ?? null,
        titulo: lev.cliente?.nombre ?? "Levantamiento",
        subtitulo: lev.descripcion_requerimiento,
        estado: lev.estado,
        lat: null,
        lng: null,
        folio: formatearFolio("LEV", lev.folio),
      });
    }
  }

  // Si las 4 fuentes fallaron, propaga el error de trabajos (la principal).
  if (
    rTrabajos.status === "rejected" &&
    rCitas.status === "rejected" &&
    (rViajes.status === "rejected" || rViajes.value == null) &&
    (rLevantamientos.status === "rejected" || rLevantamientos.value == null)
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
