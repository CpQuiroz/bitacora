// Funcionalidades apagadas a propósito (no se borra su código ni sus tablas).

// Configuración › Integraciones (Webpay, Flow, Mercado Pago, WhatsApp,
// Document AI): ninguna tarjeta conectaba de verdad y el "link de pago"
// era simulado. Oculto en web y mobile hasta tener integraciones reales
// (tarea 144). Con false, el backend responde 404 en /api/integraciones y
// 410 al generar un link de pago.
export const INTEGRACIONES_VISIBLES = false;
