import type { ReactNode } from "react";
import { Pressable, View, type ViewStyle } from "react-native";
import { useTema } from "../../theme";

export function Card({
  children,
  onPress,
  style,
  plano = false,
}: {
  children: ReactNode;
  onPress?: () => void;
  style?: ViewStyle;
  plano?: boolean;
}) {
  const t = useTema();
  const base: ViewStyle = {
    backgroundColor: t.colores.bg,
    borderWidth: 1,
    borderColor: t.colores.border,
    borderRadius: t.radio.lg,
    padding: t.espacio(4),
    ...(plano ? {} : t.sombra.card),
  };

  if (onPress) {
    return (
      <Pressable onPress={onPress} style={({ pressed }) => [base, { opacity: pressed ? 0.9 : 1 }, style]}>
        {children}
      </Pressable>
    );
  }
  return <View style={[base, style]}>{children}</View>;
}
