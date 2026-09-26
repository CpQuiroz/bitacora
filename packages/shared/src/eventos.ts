// Eventos de producto (tarea 153, PostHog). Mismos nombres en web y mobile
// para que el embudo se lea igual en el dashboard. Formato objeto_verbo en
// participio. El "primer" de cada uno (primera OS, primer cobro…) lo
// calcula PostHog en el embudo: acá no hace falta distinguirlo.
//
// Privacidad (Ley 21.719): las propiedades nunca llevan datos personales
// (nombres, RUT, correos, teléfonos, direcciones) ni montos. Solo ids
// técnicos, conteos y categorías.
export const EVENTOS = {
  // Embudo de activación
  empresaRegistrada: "empresa_registrada",
  login: "login",
  osCreada: "os_creada",
  cobroCreado: "cobro_creado",
  usuarioInvitado: "usuario_invitado",
  // Terreno (mobile)
  osCerradaFirmada: "os_cerrada_firmada",
  viajeIniciado: "viaje_iniciado",
  viajeCerrado: "viaje_cerrado",
} as const;

export type NombreEvento = (typeof EVENTOS)[keyof typeof EVENTOS];
export type PropiedadesEvento = Record<string, string | number | boolean | null>;
