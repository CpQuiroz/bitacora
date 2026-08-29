// Link de contacto directo (wa.me) — no requiere la integración de
// WhatsApp Cloud API (esa es solo para el bot de captura de viajes).
// Antepone el código de país (56) si el número no lo trae ya.
export function linkWhatsapp(telefono: string): string {
  const digitos = telefono.replace(/\D/g, "").replace(/^0+/, "");
  const conCodigoPais = digitos.startsWith("56") ? digitos : `56${digitos}`;
  return `https://wa.me/${conCodigoPais}`;
}
