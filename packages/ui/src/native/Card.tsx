import { Pressable, View, type ViewStyle } from "react-native";
import { tokens } from "@bitacora/design-tokens";
import type { Elevacion, PropsCard } from "../tipos";
import { RADIO_CARD } from "../tipos";

// Sombras del token en RN necesitan shadow* + elevation por separado (no
// hay `box-shadow`). sm/md/lg aproximan los valores de tokens.json.
const SOMBRA_NATIVE: Record<Elevacion, ViewStyle> = {
  sm: { shadowColor: tokens.color.neutral["900"], shadowOpacity: 0.14, shadowRadius: 2, shadowOffset: { width: 0, height: 1 }, elevation: 1 },
  md: { shadowColor: tokens.color.neutral["900"], shadowOpacity: 0.16, shadowRadius: 10, shadowOffset: { width: 0, height: 3 }, elevation: 4 },
  lg: { shadowColor: tokens.color.neutral["900"], shadowOpacity: 0.22, shadowRadius: 32, shadowOffset: { width: 0, height: 12 }, elevation: 10 },
};

export function Card({ children, onPress, elevacion, sinRelleno = false }: PropsCard) {
  const base: ViewStyle = {
    backgroundColor: tokens.color.surface,
    borderRadius: RADIO_CARD,
    padding: sinRelleno ? 0 : tokens.space["4"],
    ...(elevacion ? SOMBRA_NATIVE[elevacion] : null),
  };
  if (onPress) {
    return (
      <Pressable onPress={onPress} style={({ pressed }) => [base, { opacity: pressed ? 0.9 : 1 }]}>
        {children}
      </Pressable>
    );
  }
  return <View style={base}>{children}</View>;
}
