import { Text, type TextProps } from "react-native";
import type { PropsCifra } from "../tipos";

/** Montos, cantidades, fechas, folios — números que se leen en columna. */
export function Cifra({ children, style, ...props }: PropsCifra & TextProps) {
  return (
    <Text {...props} style={[{ fontVariant: ["tabular-nums"] }, style]}>
      {children}
    </Text>
  );
}
