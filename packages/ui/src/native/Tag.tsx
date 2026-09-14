import { View } from "react-native";
import { tokens } from "@bitacora/design-tokens";
import type { PropsTag, TonoTag } from "../tipos";
import { Texto } from "./Texto";
import { useMarca } from "./marca";

export function Tag({ children, tono = "neutral" }: PropsTag) {
  // "accent2" es el único tono de marca (color_secundario del tenant) —
  // los demás son fijos del sistema, iguales para todas las empresas.
  // Antes de esto, accent2 leía tokens.color.accent2Ramp (fijo) — ahora
  // useMarca() ya resuelve un tinte/tono a partir de color_secundario,
  // con el mismo fijo del sistema (accent2Ramp) como fallback si la
  // empresa no configuró uno.
  const marca = useMarca();
  const COLORES: Record<TonoTag, { bg: string; fg: string }> = {
    accent: { bg: tokens.color.accentRamp["200"], fg: tokens.color.accentRamp["800"] },
    accent2: { bg: marca.secundarioSuave, fg: marca.secundarioFuerte },
    neutral: { bg: tokens.color.neutral["200"], fg: tokens.color.neutral["800"] },
    outline: { bg: "transparent", fg: tokens.color.text },
  };
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
