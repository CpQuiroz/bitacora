import type { ReactNode } from "react";
import { View } from "react-native";
import { tokens } from "@bitacora/design-tokens";
import { Texto } from "./Texto";

/** Envoltorio compartido: label arriba + children + error/ayuda debajo. */
export function Campo({
  etiqueta,
  error,
  ayuda,
  children,
}: {
  etiqueta?: string;
  error?: string | null;
  ayuda?: string;
  children: ReactNode;
}) {
  return (
    <View style={{ gap: tokens.space["1"] }}>
      {etiqueta ? (
        <Texto tamano={tokens.size.caption} color={`${tokens.color.text}b3`}>
          {etiqueta}
        </Texto>
      ) : null}
      {children}
      {error ? (
        <Texto tamano={tokens.size.caption} color={tokens.color.accentRamp["700"]}>
          {error}
        </Texto>
      ) : ayuda ? (
        <Texto tamano={tokens.size.caption} color={`${tokens.color.text}99`}>
          {ayuda}
        </Texto>
      ) : null}
    </View>
  );
}
