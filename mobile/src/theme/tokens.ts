// Tokens base del sistema de diseño. La empresa puede sobreescribir
// `brand` / `brandForeground` (ver ThemeProvider) — el resto es fijo.
// v1: solo tema claro (app.json → userInterfaceStyle: "light").

import { mezclar } from "./color";

const MARCA_DEFECTO = "#4338ca";
const FONDO = "#ffffff";

export const paletaBase = {
  // Superficies
  bg: FONDO,
  surface: "#f6f6f8",
  surfaceAlt: "#eeeef2",
  border: "#e3e3e8",
  overlay: "rgba(17,17,17,0.45)",

  // Texto
  foreground: "#141417",
  muted: "#6b7280",
  faint: "#9ca3af",

  // Marca (sobreescribible por empresa)
  brand: MARCA_DEFECTO,
  brandSoft: mezclar(MARCA_DEFECTO, FONDO, 0.12),
  brandForeground: "#ffffff",

  // Estados — alineados con los del web (globals.css)
  success: "#15803d",
  successSoft: "#dcfce7",
  warning: "#b45309",
  warningSoft: "#fef3c7",
  danger: "#b91c1c",
  dangerSoft: "#fee2e2",
  info: "#1d4ed8",
  infoSoft: "#dbeafe",
};

export type Paleta = typeof paletaBase;

// Escala de espaciado en múltiplos de 4.
export const espacio = (n: number) => n * 4;

export const radio = { sm: 8, md: 12, lg: 18, xl: 24, full: 999 };

export const tipografia = {
  // Familias: se resuelven en el ThemeProvider (empresa.fuente o sistema).
  familia: undefined as string | undefined,
  familiaBold: undefined as string | undefined,
  tamano: { xs: 11, sm: 13, base: 15, md: 17, lg: 20, xl: 26, xxl: 32 },
  peso: { regular: "400", medium: "500", semibold: "600", bold: "700" } as const,
  interlineado: { ajustado: 1.2, normal: 1.4, holgado: 1.6 },
};

export const sombra = {
  card: {
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  flotante: {
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
};

export const duracion = { rapido: 120, normal: 200 };
