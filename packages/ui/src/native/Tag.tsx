import { View } from "react-native";
import { tokens } from "@bitacora/design-tokens";
import type { PropsTag, TonoTag } from "../tipos";
import { Texto } from "./Texto";

const COLORES: Record<TonoTag, { bg: string; fg: string }> = {
  accent: { bg: tokens.color.accentRamp["200"], fg: tokens.color.accentRamp["800"] },
  accent2: { bg: tokens.color.accent2Ramp["200"], fg: tokens.color.accent2Ramp["800"] },
  neutral: { bg: tokens.color.neutral["200"], fg: tokens.color.neutral["800"] },
  outline: { bg: "transparent", fg: tokens.color.text },
};

export function Tag({ children, tono = "neutral" }: PropsTag) {
  const c = COLORES[tono];
  return (
    <View
      style={{
        alignSelf: "flex-start",
        backgroundColor: c.bg,
        borderWidth: tono === "outline" ? 1 : 0,
        borderColor: tokens.color.divider,
        borderRadius: tokens.radius.pill,
        paddingHorizontal: tokens.space["2"],
        paddingVertical: 3,
      }}
    >
      <Texto tamano={11} color={c.fg} peso="medium" style={{ letterSpacing: 0.22 }}>
        {children}
      </Texto>
    </View>
  );
}
