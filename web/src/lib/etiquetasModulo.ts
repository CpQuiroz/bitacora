// Nombres visibles de cada módulo — compartido entre el Panel de
// Super-Admin (toggle de módulos por empresa) y Configuración > Plan
// (comparativa Básico vs Pro), para no duplicar el mapeo en dos lugares.
export const ETIQUETA_MODULO: Record<string, string> = {
  agenda: "Agenda",
  ordenes_servicio: "Órdenes de servicio",
  viajes: "Viajes",
  registros: "Registros",
  rutas: "Rutas",
  financiero: "Financiero",
  informes: "Informes",
  informe_ia: "Informe con IA",
  asistente: "Asistente",
  configuracion: "Configuración",
  gestion_control: "Grupo y usuario",
  flota: "Flota",
  agenda_pro: "Agenda Pro (paquetes de sesiones y confirmación por el cliente)",
  remuneraciones: "Remuneraciones (liquidaciones de sueldo — legislación chilena)",
};

// Acciones sensibles delegables a un rol (además de sus módulos). Se
// editan en el Panel de Super-Admin > Roles y el backend las exige con
// requiereAccion(). El frontend las recibe en GET /api/me (`acciones`).
export const ETIQUETA_ACCION: Record<string, string> = {
  facturar: "Facturar viajes (emitir factura/boleta)",
  gestionar_plan: "Gestionar el plan y la suscripción de la empresa",
  config_agenda_pro: "Configurar Agenda Pro (servicios, horarios, paquetes)",
  ver_dashboard: "Ver el Dashboard con KPIs y finanzas de la empresa",
};
