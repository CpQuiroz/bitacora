// Aviso interno de la web: "cambiaron los módulos de la empresa" (tarea
// 124, Configuración › Módulos). DashboardShell lo escucha y vuelve a
// pedir /api/me, así el menú se actualiza sin recargar la página.
export const EVENTO_MODULOS_CAMBIADOS = "bitacora:modulos-cambiados";

export function avisarModulosCambiados(): void {
  window.dispatchEvent(new Event(EVENTO_MODULOS_CAMBIADOS));
}
