import { View } from "react-native";
import { tokens } from "@bitacora/design-tokens";
import { MAPA_ESTADO_TONO, type PropsStatusBadge, type TonoEstado } from "../tipos";
import { Texto } from "./Texto";

// En progreso / Completado / Convertido-Cerrado / Cancelado.
const COLORES: Record<TonoEstado, { bg: string; fg: string }> = {
  en_progreso: { bg: tokens.color.accentRamp["200"], fg: tokens.color.accentRamp["800"] },
  completado: { bg: tokens.color.accent2Ramp["200"], fg: tokens.color.accent2Ramp["800"] },
  cerrado: { bg: tokens.color.neutral["300"], fg: tokens.color.neutral["900"] },
  cancelado: { bg: tokens.color.neutral["200"], fg: tokens.color.neutral["700"] },
};

export function StatusBadge({ estado, etiqueta, tonoForzado }: PropsStatusBadge) {
  const tono = tonoForzado ?? MAPA_ESTADO_TONO[estado] ?? "cerrado";
  const c = COLORES[tono];
  return (
    <View
      style={{
        alignSelf: "flex-start",
        backgroundColor: c.bg,
        borderRadius: tokens.radius.pill,
        paddingHorizontal: tokens.space["2"],
        paddingVertical: 3,
      }}
    >
      <Texto tamano={11} color={c.fg} peso="medium" style={{ letterSpacing: 0.22, textTransform: "capitalize" }}>
        {etiqueta ?? estado.replaceAll("_", " ")}
      </Texto>
    </View>
  );
}
