// Tokens base del sistema de diseño — dirección "Faena" (refresco 1a).
// Reemplaza mobile/src/theme/tokens.ts. Mismas claves y misma forma que
// el archivo actual: solo cambian los valores, más `accent` / `accentSoft`
// que antes no existían.
// v1: solo tema claro (app.json → userInterfaceStyle: "light").

// Alineado con web/src/app/globals.css (paleta 1a).
const MARCA_DEFECTO = "#14314f";

export const paletaBase = {
  // Superficies: fondo de pantalla gris, tarjetas/inputs blancos —
  // así las tarjetas tienen jerarquía visual (no blanco sobre blanco).
  bg: "#e9eaec",
  surface: "#ffffff",
  surfaceAlt: "#f3f5f7",
  border: "#d3d8dd",
  overlay: "rgba(16,23,32,0.5)",

  // Texto
  foreground: "#101720",
  muted: "#5c6672", // ~5.8:1 sobre blanco — pasa AA
  faint: "#8b939d", // solo texto terciario (versión, ayudas), NUNCA info que importe

  // Marca
  brand: MARCA_DEFECTO,
  brandForeground: "#ffffff",
  brandSoft: "#e4eaf1",

  // Acento (naranja señal): SOLO para la acción de terreno en curso —
  // botón "Continuar", ítem activo, parada actual de la ruta. El color
  // de la empresa se escribe acá (ver ThemeProvider), no en `brand`.
  accent: "#c2500f",
  accentSoft: "#fdf1e6",

  // Estados — más saturados que el web a propósito (legibilidad de
  // badges en pantalla chica y a la luz del día).
  success: "#15803d",
  successSoft: "#e7f2eb",
  warning: "#b45309",
  warningSoft: "#fdf1e6",
  danger: "#b91c1c",
  dangerSoft: "#fbeaea",
  info: "#14314f",
  infoSoft: "#e4eaf1",
};

export type Paleta = typeof paletaBase;

// Escala de espaciado en múltiplos de 4.
export const espacio = (n: number) => n * 4;

// 1a es de esquina corta — antes { sm: 8, md: 12, lg: 18, xl: 24 }.
export const radio = { sm: 6, md: 8, lg: 10, xl: 12, full: 999 };

export const tipografia = {
  // Familias: se resuelven en el ThemeProvider (empresa.fuente o sistema).
  familia: undefined as string | undefined,
  familiaBold: undefined as string | undefined,
  // Tema por rubro (ver theme/temas/cosmetologia.ts): cuando un tema
  // carga fuentes locales por peso (no hay "negrita sintética" con
  // fuentes custom), familiaPorPeso manda sobre familia/familiaBold para
  // cada peso puntual. familiaDisplay/familiaDisplayBold es la familia
  // de despliegue (hora, precio, título de pantalla) — undefined en el
  // tema por defecto, que sigue usando familia/familiaBold para todo.
  familiaPorPeso: undefined as Partial<Record<"regular" | "medium" | "semibold" | "bold", string>> | undefined,
  familiaDisplay: undefined as string | undefined,
  familiaDisplayBold: undefined as string | undefined,
  // Subida de escala para terreno: base 15 → 16. `xs` sigue siendo solo
  // para texto terciario.
  tamano: { xs: 12, sm: 14, base: 16, md: 18, lg: 21, xl: 26, xxl: 32 },
  peso: { regular: "400", medium: "500", semibold: "600", bold: "700" } as const,
  interlineado: { ajustado: 1.2, normal: 1.4, holgado: 1.6 },
};

// En 1a separa el borde, no la sombra.
export const sombra = {
  card: {
    shadowColor: "#0b1a2b",
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
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
