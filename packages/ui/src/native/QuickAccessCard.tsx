import { Pressable, View } from "react-native";
import type { LucideIcon } from "lucide-react-native";
import { tokens } from "@bitacora/design-tokens";
import { Texto } from "./Texto";

// Sistema visual móvil v2 — tarjeta de la grilla de "Accesos rápidos"
// (nació en "Más", 18-sep-2026, acá extraída a compartida el 20-sep-2026
// para poder reusarla en cualquier otra pantalla con el mismo patrón:
// ícono grande arriba + label corto centrado abajo, en grilla de 3 por
// fila). Dos tintes alternados (marca / marca secundaria) para que la
// grilla no se vea como un solo bloque monocromo — mismo criterio
// visual que ya usa StatusBadge con sus tonos.
//
// Si una pantalla necesita además una bajada de texto (subtítulo), este
// NO es el componente — es un patrón distinto (ver BotonGrande en
// MantencionVehiculoScreen.tsx, 2 por fila con título+subtítulo), no se
// fuerza a que comparta esta tarjeta para no perder esa información.
export type PropsQuickAccessCard = {
  titulo: string;
  Icono: LucideIcon;
  badge?: number;
  /** Alterna el tinte del ícono entre marca (0) y marca secundaria (1). */
  tinte?: 0 | 1;
  onPress: () => void;
};

export function QuickAccessCard({ titulo, Icono, badge, tinte = 0, onPress }: PropsQuickAccessCard) {
  const fondoIcono = tinte === 0 ? `${tokens.color.accent}22` : `${tokens.color.accent2}22`;
  const colorIcono = tinte === 0 ? tokens.color.accentRamp["700"] : tokens.color.accent2Ramp["700"];
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={badge ? `${titulo}, ${badge} pendientes` : titulo}
      style={{ flex: 1 }}
    >
      <View
        style={{
          position: "relative",
          alignItems: "center",
          gap: tokens.space["1"],
          borderRadius: tokens.radius.md,
          backgroundColor: tokens.color.surface,
          borderWidth: 1,
          borderColor: tokens.color.divider,
          paddingVertical: tokens.space["3"],
          paddingHorizontal: tokens.space["1"],
        }}
      >
        {badge ? (
          <View
            style={{
              position: "absolute",
              top: 4,
              right: 8,
              minWidth: 17,
              height: 17,
              borderRadius: 9,
              paddingHorizontal: 3,
              backgroundColor: tokens.color.accent,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Texto tamano={tokens.size.micro} color={tokens.color.surface} peso="semibold">
              {badge}
            </Texto>
          </View>
        ) : null}
        <View style={{ width: 40, height: 40, borderRadius: tokens.radius.sm, backgroundColor: fondoIcono, alignItems: "center", justifyContent: "center" }}>
          <Icono size={20} strokeWidth={2.25} color={colorIcono} />
        </View>
        <Texto tamano={tokens.size.caption} color={tokens.color.text} peso="semibold" style={{ textAlign: "center" }} numberOfLines={2}>
          {titulo}
        </Texto>
      </View>
    </Pressable>
  );
}
