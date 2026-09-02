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
  // Funcionalidad opt-in por empresa (ver empresa_modulos / Etapa 5) —
  // agenda con paquetes de sesiones y confirmación/cancelación de
  // citas por el cliente. No es parte del "agenda" base.
  "agenda_pro",
  // Cálculo de liquidaciones de sueldo (legislación chilena) — opt-in,
  // apagado por defecto, lo enciende el Super-Admin por empresa.
  "remuneraciones",
] as const;

export type Modulo = (typeof MODULOS)[number];

export const PERMISOS_POR_ROL: Record<Rol, Modulo[]> = {
  admin: [...MODULOS],
  supervisor: ["agenda", "ordenes_servicio", "viajes", "registros", "rutas", "flota", "agenda_pro"],
  contador: ["financiero", "informes", "remuneraciones"],
  colaborador: [],
};

export function puedeVerModulo(rol: Rol, modulo: Modulo): boolean {
  return PERMISOS_POR_ROL[rol]?.includes(modulo) ?? false;
}

// Qué módulos quedan activados para una empresa que todavía no tiene
// fila en empresa_modulos para ese módulo puntual. Los base activados
// por defecto; los opt-in, desactivados hasta que el Super-Admin los
// prenda o la empresa pase a Pro (ver cambiarPlanEmpresa en
// backend/src/planes.ts). informe_ia y asistente pasaron a ser
// exclusivos de Pro — antes eran base, empresas ya existentes se
// migran explícitamente en la migración que agrega esto (no quedan
// des-sincronizadas silenciosamente).
export const MODULOS_OPCIONALES: Modulo[] = ["agenda_pro", "informe_ia", "asistente", "remuneraciones"];

export function moduloActivadoPorDefecto(modulo: Modulo): boolean {
  return !MODULOS_OPCIONALES.includes(modulo);
}
