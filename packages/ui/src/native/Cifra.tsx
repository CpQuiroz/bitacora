import { Text, type TextProps } from "react-native";
import type { PropsCifra } from "../tipos";
import { ESCALA_FUENTE_MAX } from "./accesibilidad";

/** Montos, cantidades, fechas, folios — números que se leen en columna. */
export function Cifra({ children, style, ...props }: PropsCifra & TextProps) {
  return (
    <Text maxFontSizeMultiplier={ESCALA_FUENTE_MAX} {...props} style={[{ fontVariant: ["tabular-nums"] }, style]}>
      {children}
    </Text>
  );
}
