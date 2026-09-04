// Catálogo curado de tipografías para Personalización — "sistema" es el
// default actual de la app (IBM Plex Sans) y no carga nada de Google Fonts.
export type FuenteInfo = {
  valor: string;
  etiqueta: string;
  googleFamily: string | null;
  pila: string;
};

export const FUENTES: FuenteInfo[] = [
  { valor: "sistema", etiqueta: "Sistema (por defecto)", googleFamily: null, pila: "var(--font-plex-sans), system-ui, sans-serif" },
  { valor: "inter", etiqueta: "Inter", googleFamily: "Inter:wght@400;500;600;700", pila: "'Inter', system-ui, sans-serif" },
  { valor: "roboto", etiqueta: "Roboto", googleFamily: "Roboto:wght@400;500;700", pila: "'Roboto', system-ui, sans-serif" },
  { valor: "poppins", etiqueta: "Poppins", googleFamily: "Poppins:wght@400;500;600;700", pila: "'Poppins', system-ui, sans-serif" },
  { valor: "montserrat", etiqueta: "Montserrat", googleFamily: "Montserrat:wght@400;500;600;700", pila: "'Montserrat', system-ui, sans-serif" },
  { valor: "nunito", etiqueta: "Nunito", googleFamily: "Nunito:wght@400;600;700", pila: "'Nunito', system-ui, sans-serif" },
  { valor: "work-sans", etiqueta: "Work Sans", googleFamily: "Work+Sans:wght@400;500;600;700", pila: "'Work Sans', system-ui, sans-serif" },
  { valor: "lato", etiqueta: "Lato", googleFamily: "Lato:wght@400;700", pila: "'Lato', system-ui, sans-serif" },
  { valor: "source-sans-3", etiqueta: "Source Sans 3", googleFamily: "Source+Sans+3:wght@400;500;600;700", pila: "'Source Sans 3', system-ui, sans-serif" },
];

export function fuenteDe(valor: string | null | undefined): FuenteInfo {
  return FUENTES.find((f) => f.valor === valor) ?? FUENTES[0];
}

// Inyecta el <link> de Google Fonts la primera vez que se usa cada
// tipografía — no hace nada para "sistema" (ya viene incluida).
export function asegurarFuenteCargada(valor: string | null | undefined) {
  if (typeof document === "undefined") return;
  const info = fuenteDe(valor);
  if (!info.googleFamily) return;
  const id = `google-font-${info.valor}`;
  if (document.getElementById(id)) return;
  const link = document.createElement("link");
  link.id = id;
  link.rel = "stylesheet";
  link.href = `https://fonts.googleapis.com/css2?family=${info.googleFamily}&display=swap`;
  document.head.appendChild(link);
}
