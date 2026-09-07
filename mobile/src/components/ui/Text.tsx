import { Text as RNText, type TextProps, type TextStyle } from "react-native";
import { useTema } from "../../theme";

// "cifra" (y el prop `mono`) usan IBM Plex Mono: TODO número que se
// compare o se lea de un vistazo — horas, montos, km, RUT, folios,
// odómetro. "titulo" usa IBM Plex Sans como el resto del texto. El
// tamaño real de "cifra" casi siempre lo pisa el consumidor vía `style`.
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
  mono = false,
  style,
  ...props
}: TextProps & { variante?: Variante; tono?: Tono; weight?: "regular" | "medium" | "semibold" | "bold"; mono?: boolean }) {
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

  // Resolución de familia: "cifra" y el prop `mono` usan IBM Plex Mono;
  // el resto usa IBM Plex Sans, mapeada por peso (una fuente custom no
  // responde a `fontWeight` en RN sin esto — el archivo ya es ese peso,
  // así que se omite el fontWeight de React Native para no arriesgar una
  // negrita sintética en Android).
  const esMono = mono || variante === "cifra";
  let fontFamily = t.tipografia.familia;
  let fontWeightFinal: TextStyle["fontWeight"] = fontWeight;
  if (esMono && t.tipografia.familiaDisplay) {
    fontFamily =
      fontWeight === "700" || fontWeight === "600"
        ? t.tipografia.familiaDisplayBold ?? t.tipografia.familiaDisplay
        : t.tipografia.familiaDisplay;
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
