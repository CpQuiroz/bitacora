// ============================================================
// Matriz de permisos por rol y módulo — única fuente de verdad,
// usada tanto por el backend (para proteger endpoints de verdad)
// como por el web (para ocultar navegación) — nunca hay que repetir
// la regla en dos lugares. Agregar un módulo nuevo: sumarlo a
// MODULOS y a la fila de cada rol que deba verlo.
// ============================================================
import type { Rol } from "./types";

export const MODULOS = [
  "agenda",
  "ordenes_servicio",
  "viajes",
  "registros",
  "rutas",
  "financiero",
  "informes",
  "informe_ia",
  "asistente",
  "configuracion",
  "gestion_control",
  "flota",
] as const;

export type Modulo = (typeof MODULOS)[number];

export const PERMISOS_POR_ROL: Record<Rol, Modulo[]> = {
  admin: [...MODULOS],
  supervisor: ["agenda", "ordenes_servicio", "viajes", "registros", "rutas", "flota"],
  contador: ["financiero", "informes"],
  colaborador: [],
};

export function puedeVerModulo(rol: Rol, modulo: Modulo): boolean {
  return PERMISOS_POR_ROL[rol]?.includes(modulo) ?? false;
}
