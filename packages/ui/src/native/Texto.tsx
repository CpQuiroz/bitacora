import { Text, type TextProps } from "react-native";
import { FUENTE_NATIVE } from "./fuentes";

/**
 * Texto mínimo para uso INTERNO de las primitivas (labels, mensajes de
 * error/ayuda). No es el componente de texto de la app — eso lo define
 * cada consumidor (mobile ya tiene el suyo en components/ui/Text.tsx).
 */
export function Texto({
  tamano,
  color,
  peso = "regular",
  style,
  ...props
}: TextProps & { tamano: number; color: string; peso?: "regular" | "medium" | "semibold" }) {
  const familia = { regular: FUENTE_NATIVE.body, medium: FUENTE_NATIVE.bodyMedium, semibold: FUENTE_NATIVE.bodySemiBold }[peso];
  return <Text {...props} style={[{ fontFamily: familia, fontSize: tamano, color }, style]} />;
}
