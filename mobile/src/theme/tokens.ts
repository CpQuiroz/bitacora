// Tokens base del sistema de diseño. La empresa puede sobreescribir
// `brand` / `brandForeground` (ver ThemeProvider) — el resto es fijo.
// v1: solo tema claro (app.json → userInterfaceStyle: "light").

// Alineado con web/src/app/globals.css (paleta clara).
const MARCA_DEFECTO = "#1e4e8c";

export const paletaBase = {
  // Superficies: fondo de pantalla gris, tarjetas/inputs blancos —
  // así las tarjetas tienen jerarquía visual (no blanco sobre blanco).
  bg: "#eef1f4",
  surface: "#ffffff",
  surfaceAlt: "#e4e7ec",
  border: "#d8dee5",
  overlay: "rgba(17,17,17,0.45)",

  // Texto
  foreground: "#16161f",
  muted: "#5b6572", // ~5.8:1 sobre blanco — pasa AA
  faint: "#7c8593", // solo texto terciario (versión, ayudas), NUNCA info que importe

  // Marca (sobreescribible por empresa)
  brand: MARCA_DEFECTO,
  brandForeground: "#ffffff",
  brandSoft: "#e8eef7",

  // Estados — más saturados que el web a propósito (legibilidad de
  // badges en pantalla chica y a la luz del día).
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
    shadowColor: "#0b1a2b",
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
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
