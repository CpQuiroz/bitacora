// Tokens base del sistema de diseño — tema único "Faena".
// v2: un solo tema para TODOS los rubros (antes había una variante
// "Vino y eucalipto" por rubro cosmetología, ya retirada). Solo tema
// claro (app.json → userInterfaceStyle: "light").
//
// Los 9 colores con nombre del pedido son el origen de todo lo demás:
//   papel #EEF0F2 · blanco #FFFFFF · tinta #101720 · navy #14314F
//   naranja #C2500F · gris #5C6672 · grisSuave #8B939D
//   borde #D3D8DD · bordeFuerte #C8CED5

const papel = "#EEF0F2";
const blanco = "#FFFFFF";
const tinta = "#101720";
const navy = "#14314F";
const naranja = "#C2500F";
const gris = "#5C6672";
const grisSuave = "#8B939D";
const borde = "#D3D8DD";
const bordeFuerte = "#C8CED5";

export const paletaBase = {
  // Superficies
  bg: papel, // fondo de las listas
  surface: blanco, // tarjetas y superficies
  surfaceAlt: "#F5F6F8", // caja de "nota interna" y afines
  border: borde,
  borderStrong: bordeFuerte, // bordes de campo de formulario
  overlay: "rgba(16,23,32,0.42)", // hoja emergente / crear al vuelo (42%)

  // Texto
  foreground: tinta,
  muted: gris, // texto secundario
  faint: grisSuave, // texto terciario y placeholders — NUNCA info que importe
  onDark: "#C9D3DE", // texto secundario sobre el bloque de foco navy

  // Acento primario (navy): acción primaria, encabezados oscuros
  brand: navy,
  brandForeground: blanco,
  brandSoft: "#E4EAF1",

  // Señal (naranja): en curso, siguiente, alertas, línea de "ahora".
  // Fijo — no se reemplaza por el color de la empresa.
  accent: naranja,
  accentSoft: "#FDF1E6",

  // Estados (bg / texto) — del pedido
  success: "#14663C", // firmada
  successSoft: "#E7F2EB",
  warning: "#8A4A10", // enProceso
  warningSoft: "#FDF1E6",
  danger: "#A02020", // vencida
  dangerSoft: "#FBEAEA",
  info: navy, // agendado
  infoSoft: "#E4EAF1",
};

export type Paleta = typeof paletaBase;

// Riel de estados con nombre semántico, para las pantallas del refresco.
export const estado = {
  agendado: { bg: "#E4EAF1", fg: "#14314F" },
  enProceso: { bg: "#FDF1E6", fg: "#8A4A10" },
  firmada: { bg: "#E7F2EB", fg: "#14663C" },
  vencida: { bg: "#FBEAEA", fg: "#A02020" },
  neutro: { bg: "#ECEEF1", fg: "#5C6672" },
} as const;

// Escala de espaciado en múltiplos de 4.
export const espacio = (n: number) => n * 4;

// Radio 6-8 en tarjetas y campos; 22 en el contenedor de pantalla.
export const radio = { sm: 6, md: 7, lg: 8, xl: 8, contenedor: 22, full: 999 };

export const tipografia = {
  // Familias: se resuelven en el ThemeProvider (IBM Plex, local).
  familia: undefined as string | undefined,
  familiaBold: undefined as string | undefined,
  // familiaPorPeso manda sobre familia/familiaBold para cada peso
  // puntual cuando el tema carga fuentes estáticas por peso (una fuente
  // custom no responde a fontWeight en RN sin esto).
  familiaPorPeso: undefined as Partial<Record<"regular" | "medium" | "semibold" | "bold", string>> | undefined,
  // familiaDisplay = IBM Plex Mono: TODO número que se compare o se lea
  // de un vistazo (horas, montos, km, RUT, folios, odómetro). La usa la
  // variante "cifra" de <Text> y el prop `mono`.
  familiaDisplay: undefined as string | undefined,
  familiaDisplayBold: undefined as string | undefined,
  // Cuerpo 15, títulos de pantalla 20, etiquetas de campo 13. Nunca bajo
  // 12.5 salvo los rótulos mono en mayúsculas (9.5-10px), que se piden a
  // mano en cada pantalla.
  tamano: { xs: 12.5, sm: 13, base: 15, md: 17, lg: 20, xl: 24, xxl: 30 },
  peso: { regular: "400", medium: "500", semibold: "600", bold: "700" } as const,
  interlineado: { ajustado: 1.2, normal: 1.4, holgado: 1.6 },
};

// Faena separa con filete de 1px, no con sombra.
export const sombra = {
  card: { shadowColor: "transparent", shadowOpacity: 0, shadowRadius: 0, shadowOffset: { width: 0, height: 0 }, elevation: 0 },
  flotante: {
    // única excepción: la hoja emergente y el FAB necesitan despegarse.
    shadowColor: "#0b1a2b",
    shadowOpacity: 0.14,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
};

// Altura mínima de cualquier cosa tocable.
export const TOQUE_MIN = 46;

export const duracion = { rapido: 120, normal: 200 };
