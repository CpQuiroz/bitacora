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

// ⚠️ SEMILLA — desde la migración 71 los roles son filas editables desde
// el Panel de Super-Admin (tabla `roles`). Estas constantes solo se usan
// para sembrar los 4 roles de sistema la primera vez (backend/src/roles.ts).
// El backend resuelve permisos contra la tabla; el frontend contra
// `modulos_visibles` / `acciones` que devuelve /api/me.
export const PERMISOS_POR_ROL: Record<Rol, Modulo[]> = {
  admin: [...MODULOS],
  supervisor: ["agenda", "ordenes_servicio", "viajes", "registros", "rutas", "flota", "agenda_pro"],
  contador: ["financiero", "informes", "remuneraciones"],
  colaborador: [],
};

// Capacidades sensibles delegables a un rol (además de sus módulos). El
// rol `admin` las tiene todas siempre, no hace falta listarlas.
export const ACCIONES = ["facturar", "gestionar_plan", "config_agenda_pro", "ver_dashboard"] as const;
export type Accion = (typeof ACCIONES)[number];

export const ACCIONES_POR_ROL: Record<Rol, Accion[]> = {
  admin: [...ACCIONES],
  supervisor: ["config_agenda_pro", "ver_dashboard"],
  contador: ["ver_dashboard"],
  colaborador: [],
};

export const ROL_EXIGE_2FA: Record<Rol, boolean> = {
  admin: true,
  supervisor: true,
  contador: false,
  colaborador: false,
};

export const ETIQUETA_ROL_SISTEMA: Record<Rol, string> = {
  admin: "Admin",
  supervisor: "Supervisor",
  contador: "Contador",
  colaborador: "Colaborador / técnico / chofer",
};

// Fallback sincrónico — solo se usa si por algún motivo no hay tabla de
// roles cargada. El camino real es asíncrono contra la DB.
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
