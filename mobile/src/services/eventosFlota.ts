import * as Crypto from "expo-crypto";
import type { EventoFlotaConAutor, TipoEventoFlota } from "@bitacora/shared";
import { apiJson } from "./api";
import { encolar } from "./sync/queue";
import { guardarCache, leerCache } from "./sync/cache";

// Eventos semanales de flota (migración 128, 23-sep-2026) — GET/POST
// /api/equipos/:equipoId/eventos. El backend deja pasar a quien gestiona
// flota o al chofer con ese vehículo asignado hoy.

export type ListaEventosFlota = { eventos: EventoFlotaConAutor[]; desdeCache: boolean };

export async function listarEventosSemana(equipoId: string, desde: string, hasta: string): Promise<ListaEventosFlota> {
  const clave = `eventos-flota:${equipoId}:${desde}`;
  const res = await apiJson<EventoFlotaConAutor[]>(`/api/equipos/${equipoId}/eventos?desde=${desde}&hasta=${hasta}`);
  if (res.ok) {
    await guardarCache(clave, res.data);
    return { eventos: res.data, desdeCache: false };
  }
  const cache = await leerCache<EventoFlotaConAutor[]>(clave);
  if (cache) return { eventos: cache.datos, desdeCache: true };
  throw new Error(res.error);
}

export type BorradorEventoFlota = { tipo: TipoEventoFlota; fecha: string; descripcion: string; kilometraje: string };

// Por la cola offline — en ruta muchas veces no hay señal; se sincroniza
// sola al recuperarla (mismo criterio que la mantención diaria).
export function encolarEventoFlota(equipoId: string, b: BorradorEventoFlota) {
  return encolar({
    etiqueta: "Evento de flota",
    recurso: `equipo:${equipoId}`,
    path: `/api/equipos/${equipoId}/eventos`,
    method: "POST",
    body: {
      // id estable: un reintento tras timeout no duplica el evento.
      id: Crypto.randomUUID(),
      tipo: b.tipo,
      fecha: b.fecha,
      ...(b.descripcion.trim() ? { descripcion: b.descripcion.trim() } : {}),
      ...(b.kilometraje.trim() ? { kilometraje: b.kilometraje.trim() } : {}),
    },
  });
}
