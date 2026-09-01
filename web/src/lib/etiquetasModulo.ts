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
};
