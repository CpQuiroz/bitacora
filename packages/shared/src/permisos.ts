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
  // Recursos — hasta el 24-sep-2026 "registros" bundleaba Clientes,
  // Equipos, Inventario, Catálogo y Proveedores (tarea 124, pedido
  // explícito: un interruptor por cada ítem del menú; las pestañas
  // internas, como Rendiciones dentro de Gastos o Mantención dentro de
  // Flota, van con su sección). Mismo criterio que "financiero" más
  // abajo: la clave NO se renombra y pasa a significar solo Clientes;
  // las otras 4 nacen nuevas (migración 132 copia el estado de
  // "registros" a las nuevas, en empresas y en roles).
  "registros",
  "equipos",
  "inventario",
  "catalogo",
  "proveedores",
  "rutas",
  // Dinero — hasta el 23-sep-2026 un solo módulo "financiero" bundleaba
  // Cotizaciones + Cobros + Gastos/Rendiciones, todo o nada. Pedido
  // explícito: una empresa puede necesitar solo Gastos, sin Cotización
  // ni Cobros. Se separan en 3 activables independientemente —
  // "financiero" NO se renombra (evita una migración de datos en
  // `roles`/`empresa_modulos` para algo que es solo cosmético) y pasa a
  // significar Gastos/Rendiciones en particular; "cobros" y
  // "cotizaciones" nacen nuevos. Ver migración 123 (roles.ts guarda la
  // lista de módulos de cada rol como snapshot en la tabla `roles`, no
  // se recalcula sola — todo rol que ya tenía "financiero" necesita que
  // se le sumen los 2 nuevos ahí para no perder acceso).
  "financiero",
  "cotizaciones",
  "cobros",
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
  // Levantamientos: Admin crea, técnico evalúa en terreno, Admin cotiza
  // fuera de Bitácora y al aprobar nace una OS. Opt-in, apagado por
  // defecto.
  "levantamientos",
] as const;

// Nombre corto de cada módulo para mostrar en la app (mobile: Mi plan y
// Super-Admin). Record<Modulo, …> obliga a nombrar todo módulo nuevo. La
// web tiene además descripciones largas (web/src/lib/etiquetasModulo.ts).
export const NOMBRE_MODULO: Record<(typeof MODULOS)[number], string> = {
  agenda: "Agenda",
  ordenes_servicio: "Órdenes de servicio",
  viajes: "Viajes",
  registros: "Clientes",
  equipos: "Equipos",
  inventario: "Inventario",
  catalogo: "Catálogo",
  proveedores: "Proveedores",
  rutas: "Rutas",
  financiero: "Gastos y rendiciones",
  cotizaciones: "Cotizaciones",
  cobros: "Cobros",
  informes: "Informes",
  informe_ia: "Informe con IA",
  asistente: "Asistente",
  configuracion: "Configuración",
  gestion_control: "Grupo y usuario",
  flota: "Flota",
  agenda_pro: "Agenda Pro",
  remuneraciones: "Remuneraciones",
  levantamientos: "Levantamientos",
};

export type Modulo = (typeof MODULOS)[number];

// ⚠️ SEMILLA — desde la migración 71 los roles son filas editables desde
// el Panel de Super-Admin (tabla `roles`). Estas constantes solo se usan
// para sembrar los 4 roles de sistema la primera vez (backend/src/roles.ts).
// El backend resuelve permisos contra la tabla; el frontend contra
// `modulos_visibles` / `acciones` que devuelve /api/me.
const PERFIL_SUPERVISION: Modulo[] = [
  "agenda",
  "ordenes_servicio",
  "viajes",
  "registros",
  "equipos",
  "inventario",
  "catalogo",
  "proveedores",
  "rutas",
  "flota",
  "agenda_pro",
  "financiero",
  "cotizaciones",
  "cobros",
  "informes",
  "remuneraciones",
];

// Roles de gestión (tarea 138): los que asignan y cambian montos,
// reciben avisos de gestión, etc. Desde el 24-sep-2026 el Contador se
// fusionó en el Supervisor (pedido de la usuaria: un solo perfil).
export const ROLES_SUPERVISION: readonly string[] = ["admin", "supervisor"];

export const PERMISOS_POR_ROL: Record<Rol, Modulo[]> = {
  admin: [...MODULOS],
  // Supervisor incluye lo que era el Contador (fusionados el 24-sep-2026,
  // tarea 138, migración 138). Si algún día se vuelve a separar, se crea
  // el rol acá y en la tabla roles (migración nueva).
  supervisor: PERFIL_SUPERVISION,
  // El colaborador ve su Agenda (calendario + tareas asignadas). El
  // resto de su trabajo en terreno vive en la app móvil.
  colaborador: ["agenda"],
};

// Módulos que el Admin de una empresa puede activar/desactivar por rol
// dentro de SU empresa (tabla empresa_rol_modulos, migración 75).
// Se excluyen `configuracion` y `gestion_control`: delegarlos permitiría
// que un rol operativo edite la empresa o gestione usuarios/usuarios —
// esos siguen definidos solo por el Super-Admin en la plantilla global.
// `asistente` se excluye desde el 23-sep-2026 (pedido explícito, Fase
// 2.2): es exclusivo de Admin sin excepción — si quedara delegable,
// un Admin de empresa podría (a propósito o por error) prendérselo a
// un Colaborador desde Configuración > Perfiles, esquivando el
// requiereRol("admin") que ya lo protege en el backend (server.ts) del
// lado de la EMPRESA, no del lado del Super-Admin (que sigue viendo
// todos los módulos igual, admin siempre pasa cualquier chequeo de rol).
// `informe_ia` se excluye desde el 24-sep-2026 (tarea 124): el informe
// con IA pasa a ser solo del Admin, en todos los planes.
export const MODULOS_DELEGABLES_POR_EMPRESA: Modulo[] = MODULOS.filter(
  (m) => m !== "configuracion" && m !== "gestion_control" && m !== "asistente" && m !== "informe_ia"
);

// Módulos que son SOLO del rol admin, aunque un rol los tenga en su
// lista (snapshot en la tabla roles). modulosVisiblesDeUsuario los
// filtra para el resto y el backend exige rol admin en sus rutas.
export const MODULOS_SOLO_ADMIN: readonly Modulo[] = ["informe_ia", "asistente"];

// Capacidades sensibles delegables a un rol (además de sus módulos). El
// rol `admin` las tiene todas siempre, no hace falta listarlas.
// registrar_venta (23-sep-2026): por ahora solo el Admin puede registrar
// ventas a clientes — se delega a otros roles desde el Panel de
// Super-Admin > Roles cuando se decida (sin tocar código).
export const ACCIONES = ["facturar", "gestionar_plan", "config_agenda_pro", "ver_dashboard", "registrar_venta"] as const;
export type Accion = (typeof ACCIONES)[number];

export const ACCIONES_POR_ROL: Record<Rol, Accion[]> = {
  admin: [...ACCIONES],
  supervisor: ["config_agenda_pro", "ver_dashboard", "registrar_venta"],
  colaborador: [],
};

// Supervisor: 2FA opcional desde la fusión con Contador (tarea 138,
// decisión de la usuaria). El gate real lee roles.requiere_2fa.
export const ROL_EXIGE_2FA: Record<Rol, boolean> = {
  admin: true,
  supervisor: false,
  colaborador: false,
};

export const ETIQUETA_ROL_SISTEMA: Record<Rol, string> = {
  admin: "Admin",
  supervisor: "Supervisor",
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
export const MODULOS_OPCIONALES: Modulo[] = ["agenda_pro", "informe_ia", "asistente", "remuneraciones", "levantamientos"];

export function moduloActivadoPorDefecto(modulo: Modulo): boolean {
  return !MODULOS_OPCIONALES.includes(modulo);
}
