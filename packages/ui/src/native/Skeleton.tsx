import { useEffect, useRef } from "react";
import { Animated, Easing, View, type DimensionValue } from "react-native";
import { tokens } from "@bitacora/design-tokens";
import type { PropsSkeleton } from "../tipos";

export function Skeleton({ ancho = "100%", alto = 16, radio = 8 }: PropsSkeleton) {
  const opacidad = useRef(new Animated.Value(0.5)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacidad, { toValue: 1, duration: 700, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(opacidad, { toValue: 0.5, duration: 700, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [opacidad]);

  // El ancho/alto/radio son estáticos (layout) — solo la opacidad se
  // anima. `ancho` es número|string en el contrato compartido (web acepta
  // cualquier CSS length); en RN solo vale número o "N%" (DimensionValue).
  return (
    <View style={{ width: ancho as DimensionValue, height: alto, borderRadius: radio, overflow: "hidden" }}>
      <Animated.View style={{ flex: 1, backgroundColor: tokens.color.neutral["200"], opacity: opacidad }} />
    </View>
  );
}
