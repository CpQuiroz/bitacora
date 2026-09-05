// Tema por rubro "Vino y eucalipto" — se activa solo cuando
// empresa.rubro === "cosmetologia" (ver ThemeProvider). El resto de la
// app (transporte, servicio_tecnico, otro) sigue con la paleta "Faena"
// de tokens.ts sin cambios.
import { mezclar } from "../color";
import { radio, sombra, tipografia, type Paleta } from "../tokens";

// Los 6 tokens con nombre del punto 1 del pedido — no se derivan, son el
// origen de todo lo demás en este archivo.
const papel = "#FBF9F7";
const tintaCiruela = "#2B1F22";
const vinoSeco = "#7A2E3C";
const eucalipto = "#3F5D52";
const malvaGris = "#6E6167";
const hilo = "#E6DFDA";

// Único caso que no entra en la Paleta genérica: texto secundario sobre
// el bloque de foco (fondo tintaCiruela) del detalle de reserva. No se
// suma a Paleta porque ningún otro fondo oscuro existe en este tema.
export const textoSobreFoco = "#D8CBCE";

// Halo del punto activo del riel de estados (punto 2) — mismo valor que
// brandSoft/accentSoft, con nombre propio porque el riel lo referencia
// directo sin pasar por semántica de "marca".
export const haloActivo = "#F2E4E7";

export const paletaCosmetologia: Paleta = {
  bg: papel,
  surface: "#FFFFFF",
  // Mismo valor que el fondo de "nota interna" (punto 4) — es la
  // superficie secundaria de todo el tema, no solo de ese campo.
  surfaceAlt: "#F4EFEB",
  border: hilo,
  overlay: "rgba(43,31,34,0.5)", // tintaCiruela al 50%

  foreground: tintaCiruela,
  // Único gris para texto secundario en todo el tema — a propósito
  // muted === faint, no hay un gris más claro para texto que se lea.
  muted: malvaGris,
  faint: malvaGris,

  brand: vinoSeco,
  brandForeground: "#FFFFFF",
  brandSoft: haloActivo,

  accent: vinoSeco,
  accentSoft: haloActivo,

  success: eucalipto,
  successSoft: mezclar(eucalipto, papel, 0.14),
  warning: "#8A5A2B",
  warningSoft: mezclar("#8A5A2B", papel, 0.14),
  danger: "#8C3B3B",
  dangerSoft: mezclar("#8C3B3B", papel, 0.14),
  info: eucalipto,
  infoSoft: mezclar(eucalipto, papel, 0.14),
};

// "Radios 11-18px" — reemplaza la esquina corta de Faena por una más
// suave, todavía sin llegar a "pill".
export const radioCosmetologia: typeof radio = { sm: 11, md: 12, lg: 14, xl: 18, full: 999 };

// "Sin sombras: separa el filete" — Card ya pone borde siempre (ver
// components/ui/Card.tsx), esto solo apaga la sombra que se suma encima.
export const sombraCosmetologia: typeof sombra = {
  card: { shadowColor: "transparent", shadowOpacity: 0, shadowRadius: 0, shadowOffset: { width: 0, height: 0 }, elevation: 0 },
  flotante: { shadowColor: "transparent", shadowOpacity: 0, shadowRadius: 0, shadowOffset: { width: 0, height: 0 }, elevation: 0 },
};

// Karla para todo — cargada por peso porque son archivos estáticos
// (una fuente variable no responde a fontWeight en RN sin esto). Bodoni
// Moda solo para hora/precio/título de pantalla (ver Text.tsx: variante
// "titulo" y "cifra" usan familiaDisplay/familiaDisplayBold).
export const tipografiaCosmetologia: typeof tipografia = {
  ...tipografia,
  familia: "Karla-Regular",
  familiaBold: "Karla-Bold",
  familiaPorPeso: {
    regular: "Karla-Regular",
    medium: "Karla-Medium",
    semibold: "Karla-SemiBold",
    bold: "Karla-Bold",
  },
  familiaDisplay: "BodoniModa-Regular",
  familiaDisplayBold: "BodoniModa-Bold",
};

// Para registrar con useFonts() en la raíz de la app (ver shell/App.tsx).
// Instancias estáticas generadas a partir de las variables de Google
// Fonts (OFL) — ver mobile/assets/fonts/OFL-*.txt.
export const fuentesCosmetologia = {
  "Karla-Regular": require("../../../assets/fonts/Karla-Regular.ttf"),
  "Karla-Medium": require("../../../assets/fonts/Karla-Medium.ttf"),
  "Karla-SemiBold": require("../../../assets/fonts/Karla-SemiBold.ttf"),
  "Karla-Bold": require("../../../assets/fonts/Karla-Bold.ttf"),
  "BodoniModa-Regular": require("../../../assets/fonts/BodoniModa-Regular.ttf"),
  "BodoniModa-Bold": require("../../../assets/fonts/BodoniModa-Bold.ttf"),
};
