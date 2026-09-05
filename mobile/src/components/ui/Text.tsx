import { Text as RNText, type TextProps, type TextStyle } from "react-native";
import { useTema } from "../../theme";

// "cifra" es solo para despliegue tipo Bodoni (hora, precio) — mismo
// criterio que "titulo": ambas usan familiaDisplay cuando el tema la
// define (tema por rubro cosmetología), el tamaño real casi siempre lo
// pisa el consumidor vía `style` (hora 46px, precio 22px son puntuales).
type Variante = "titulo" | "subtitulo" | "cuerpo" | "etiqueta" | "caption" | "cifra";
type Tono = "normal" | "muted" | "faint" | "brand" | "danger" | "success" | "inverso";

const PESO_DE_FONTWEIGHT: Record<string, "regular" | "medium" | "semibold" | "bold"> = {
  "400": "regular",
  "500": "medium",
  "600": "semibold",
  "700": "bold",
};

export function Text({
  variante = "cuerpo",
  tono = "normal",
  weight,
  style,
  ...props
}: TextProps & { variante?: Variante; tono?: Tono; weight?: "regular" | "medium" | "semibold" | "bold" }) {
  const t = useTema();

  const porVariante: Record<Variante, { fontSize: number; fontWeight: "400" | "500" | "600" | "700" }> = {
    titulo: { fontSize: t.tipografia.tamano.xl, fontWeight: "700" },
    subtitulo: { fontSize: t.tipografia.tamano.md, fontWeight: "600" },
    cuerpo: { fontSize: t.tipografia.tamano.base, fontWeight: "400" },
    etiqueta: { fontSize: t.tipografia.tamano.sm, fontWeight: "500" },
    caption: { fontSize: t.tipografia.tamano.xs, fontWeight: "400" },
    cifra: { fontSize: t.tipografia.tamano.xxl, fontWeight: "400" },
  };

  const colorPorTono: Record<Tono, string> = {
    normal: t.colores.foreground,
    muted: t.colores.muted,
    faint: t.colores.faint,
    brand: t.colores.brand,
    danger: t.colores.danger,
    success: t.colores.success,
    inverso: t.colores.brandForeground,
  };

  const base = porVariante[variante];
  const fontWeight = weight ? t.tipografia.peso[weight] : base.fontWeight;

  // Resolución de familia: "titulo"/"cifra" usan la familia de despliegue
  // (Bodoni Moda en el tema cosmetología) si existe; el resto usa la
  // familia normal, mapeada por peso cuando el tema carga fuentes
  // estáticas por peso (Karla) — una fuente custom no responde a
  // `fontWeight` sin esto, así que en ese caso se omite el fontWeight de
  // React Native (el archivo ya es ese peso) para no arriesgar una
  // negrita sintética en Android.
  const esDisplay = variante === "titulo" || variante === "cifra";
  let fontFamily = t.tipografia.familia;
  let fontWeightFinal: TextStyle["fontWeight"] = fontWeight;
  if (esDisplay && t.tipografia.familiaDisplay) {
    fontFamily = fontWeight === "700" ? t.tipografia.familiaDisplayBold ?? t.tipografia.familiaDisplay : t.tipografia.familiaDisplay;
    fontWeightFinal = undefined;
  } else if (t.tipografia.familiaPorPeso) {
    const pesoKey = PESO_DE_FONTWEIGHT[fontWeight] ?? "regular";
    fontFamily = t.tipografia.familiaPorPeso[pesoKey] ?? t.tipografia.familia;
    fontWeightFinal = undefined;
  }

  return (
    <RNText
      {...props}
      style={[{ fontSize: base.fontSize, fontWeight: fontWeightFinal, color: colorPorTono[tono], fontFamily }, style]}
    />
  );
}
