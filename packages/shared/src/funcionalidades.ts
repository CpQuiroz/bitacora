// Funcionalidades apagadas a propósito (no se borra su código ni sus tablas).

// Configuración › Integraciones (Webpay, Flow, Mercado Pago, WhatsApp,
// Document AI): ninguna tarjeta conectaba de verdad y el "link de pago"
// era simulado. Oculto en web y mobile hasta tener integraciones reales
// (tarea 144). Con false, el backend responde 404 en /api/integraciones y
// 410 al generar un link de pago.
export const INTEGRACIONES_VISIBLES = false;

// "Tipo de OS" (Configuración › Tipos de OS/Trabajo): la usuaria eligió
// quitarlo de la app (tarea 145, opción B, 26-sep-2026). Las OS nuevas no
// tienen tipo; las viejas conservan sus datos medidos. La tabla
// tipos_os_trabajo y su API se mantienen.
export const TIPOS_OS_VISIBLES = false;
