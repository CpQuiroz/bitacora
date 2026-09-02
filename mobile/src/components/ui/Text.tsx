import { Text as RNText, type TextProps } from "react-native";
import { useTema } from "../../theme";

type Variante = "titulo" | "subtitulo" | "cuerpo" | "etiqueta" | "caption";
type Tono = "normal" | "muted" | "faint" | "brand" | "danger" | "success" | "inverso";

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

  return (
    <RNText
      {...props}
      style={[
        { fontSize: base.fontSize, fontWeight, color: colorPorTono[tono], fontFamily: t.tipografia.familia },
        style,
      ]}
    />
  );
}
