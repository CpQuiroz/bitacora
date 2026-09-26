import { View } from "react-native";
import { tokens } from "@bitacora/design-tokens";
import type { PropsAviso, TonoAviso } from "../tipos";
import { Texto } from "./Texto";

// Mismo contrato que web (tarea 157): mensaje fijo junto a lo que afecta.
export function Aviso({ tono = "info", children }: PropsAviso) {
  const color: Record<TonoAviso, { fondo: string; texto: string }> = {
    error: { fondo: tokens.semantic.dangerSoft, texto: tokens.semantic.danger },
    exito: { fondo: tokens.color.accent2Ramp["100"], texto: tokens.color.accent2Ramp["800"] },
    advertencia: { fondo: tokens.semantic.warningSoft, texto: tokens.semantic.warning },
    info: { fondo: tokens.color.neutral["100"], texto: tokens.color.text },
  };
  const { fondo, texto } = color[tono];
  return (
    <View
      accessibilityRole={tono === "error" ? "alert" : "text"}
      accessibilityLiveRegion={tono === "error" ? "assertive" : "polite"}
      style={{ backgroundColor: fondo, borderLeftWidth: 3, borderLeftColor: texto, borderRadius: tokens.radius.sm, paddingHorizontal: tokens.space["3"], paddingVertical: tokens.space["2"] }}
    >
      <Texto tamano={tokens.size.small} color={texto} peso="medium">
        {children}
      </Texto>
    </View>
  );
}
