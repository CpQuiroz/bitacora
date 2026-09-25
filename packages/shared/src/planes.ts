// ============================================================
// Planes de Bitácora (tarea 124, rediseño aprobado por la usuaria el
// 24-sep-2026). El plan NO decide qué módulos tiene una empresa: fija
// CUÁNTOS puede tener activos (tope en LIMITES_POR_PLAN.modulosMax), y
// cuáles los elige el Super-Admin (o el Admin de la empresa, dentro del
// tope). Cambiar de plan no prende ni apaga módulos.
//
//  - Prueba (`trial`): 7 días, todo activo.
//  - Esencial (clave `basico`, se mantuvo para no migrar datos): hasta 6.
//  - Operación: hasta 10.
//  - Pro: todos, con IA completa.
//  - Empresa: todos. Programado pero apagado (PLAN_EMPRESA_DISPONIBLE).
// ============================================================
import type { Modulo } from "./permisos";
import { MODULOS, MODULOS_SOLO_ADMIN, moduloActivadoPorDefecto } from "./permisos";
import { LIMITES_POR_PLAN, planPermiteIACompleta } from "./limites";
import type { Plan, PlanPago } from "./types";

export const PLANES_PAGO: readonly PlanPago[] = ["basico", "operacion", "pro", "empresa"];

// El plan Empresa queda programado para un cliente grande futuro, pero
// hoy la empresa no lo ve ni lo contrata (sí lo puede asignar el
// Super-Admin). Para prenderlo, cambiar a true.
export const PLAN_EMPRESA_DISPONIBLE = false;

// Planes que la propia empresa ve y contrata en Configuración > Plan.
export const PLANES_CONTRATABLES: readonly PlanPago[] = PLANES_PAGO.filter((p) => p !== "empresa" || PLAN_EMPRESA_DISPONIBLE);

export const ETIQUETA_PLAN: Record<Plan, string> = {
  trial: "Prueba gratis",
  basico: "Esencial",
  operacion: "Operación",
  pro: "Pro",
  empresa: "Empresa",
};

// Precio mensual en UF, sin IVA. Empresa es el precio "desde".
export const PRECIO_PLAN_UF: Record<PlanPago, number> = {
  basico: 1.5,
  operacion: 3.5,
  pro: 6,
  empresa: 12,
};

// Duración de la prueba gratis de una empresa nueva.
export const DIAS_PRUEBA = 7;

// Prueba vencida (tarea 144): la empresa sigue en "trial" pasada la fecha
// de fin (último día con acceso). `hoy` es la fecha de Chile YYYY-MM-DD.
// Sale de "trial" solo al confirmarse el pago (cambiarPlanEmpresa).
export function pruebaVencida(plan: string | null | undefined, pruebaTerminaEn: string | null | undefined, hoy: string): boolean {
  return plan === "trial" && pruebaTerminaEn != null && pruebaTerminaEn < hoy;
}

// Tope de una extensión de cortesía del Super-Admin.
export const MAX_DIAS_EXTENSION_PRUEBA = 90;

// Suma días a una fecha YYYY-MM-DD (aritmética en UTC: sin saltos por
// cambio de hora).
export function sumarDiasFecha(fecha: string, dias: number): string {
  const d = new Date(`${fecha}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

// "Extender N días": desde la fecha de fin si la prueba sigue vigente,
// o desde hoy si ya venció (así la extensión nunca queda en el pasado).
export function fechaPruebaExtendida(pruebaTerminaEn: string | null | undefined, dias: number, hoy: string): string {
  const base = pruebaTerminaEn && pruebaTerminaEn >= hoy ? pruebaTerminaEn : hoy;
  return sumarDiasFecha(base, dias);
}

// Secciones que cuentan para el tope de módulos del plan: todas las que
// se prenden y apagan, menos las de base (configuracion, gestion_control)
// y las de IA (que dependen del plan y del rol, no del tope).
const MODULOS_QUE_NO_CUENTAN: readonly Modulo[] = ["configuracion", "gestion_control", "informe_ia", "asistente"];
export const MODULOS_CONTABLES: readonly Modulo[] = MODULOS.filter((m) => !MODULOS_QUE_NO_CUENTAN.includes(m));

export function cuentaParaTope(modulo: Modulo): boolean {
  return MODULOS_CONTABLES.includes(modulo);
}

export function esPlanPago(valor: unknown): valor is PlanPago {
  return typeof valor === "string" && (PLANES_PAGO as readonly string[]).includes(valor);
}

// Módulos activos que cuentan para el tope, a partir de las filas de
// empresa_modulos de UNA empresa. Sin fila rige el default del código
// (moduloActivadoPorDefecto), igual que el resto del backend.
export function modulosContablesActivos(filas: readonly { modulo: string; activado: boolean }[]): Modulo[] {
  const estado = new Map(filas.map((f) => [f.modulo, f.activado]));
  return MODULOS_CONTABLES.filter((m) => (estado.has(m) ? estado.get(m)! : moduloActivadoPorDefecto(m)));
}

// Cuántos módulos sobran para caber en `plan` (0 si caben o no hay tope).
export function modulosSobrantesParaPlan(plan: Plan, activos: number): number {
  const tope = LIMITES_POR_PLAN[plan].modulosMax;
  return tope == null ? 0 : Math.max(0, activos - tope);
}

// Filtro final de lo que ve un usuario (lo usa /api/me → web y mobile):
//  - Informe con IA y Asistente son solo del rol admin, aunque un rol
//    los tenga en su lista guardada.
//  - El Asistente además solo en planes con IA completa: el cambio de
//    plan no apaga módulos, así que sin esto un Esencial vería un botón
//    que el backend rechaza.
export function filtrarModulosVisibles(modulos: readonly Modulo[], rol: string, plan: Plan): Modulo[] {
  return modulos.filter((m) => {
    if (MODULOS_SOLO_ADMIN.includes(m) && rol !== "admin") return false;
    if (m === "asistente" && !planPermiteIACompleta(plan)) return false;
    return true;
  });
}

// Módulos agrupados como aparecen en el menú (tarea 124, etapa 2). Lo
// usan el Super-Admin y la pantalla de Módulos de la empresa para
// mostrar los interruptores en el mismo orden que el menú. `cuenta`
// indica si el grupo suma para el tope del plan.
export const GRUPOS_MODULOS: readonly { titulo: string; modulos: readonly Modulo[]; cuenta: boolean }[] = [
  { titulo: "Operación", modulos: ["agenda", "agenda_pro", "levantamientos", "ordenes_servicio", "rutas", "viajes"], cuenta: true },
  { titulo: "Clientes", modulos: ["registros"], cuenta: true },
  { titulo: "Dinero", modulos: ["cotizaciones", "cobros", "financiero", "remuneraciones"], cuenta: true },
  { titulo: "Recursos", modulos: ["equipos", "inventario", "catalogo", "proveedores"], cuenta: true },
  { titulo: "Equipo", modulos: ["flota"], cuenta: true },
  { titulo: "Informes", modulos: ["informes"], cuenta: true },
  { titulo: "Inteligencia artificial (solo Admin, no cuenta para el tope)", modulos: ["informe_ia", "asistente"], cuenta: false },
  { titulo: "Base (no cuenta para el tope)", modulos: ["configuracion", "gestion_control"], cuenta: false },
];
