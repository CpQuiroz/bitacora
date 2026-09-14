import { ActivityIndicator, Pressable, Text, View, type ViewStyle } from "react-native";
import { tokens } from "@bitacora/design-tokens";
import type { PropsBoton, Tamano, VarianteBoton } from "../tipos";
import { ALTURA_NATIVE } from "../tipos";
import { useMarca } from "./marca";
import { FUENTE_NATIVE } from "./fuentes";

const RADIO_PILL = tokens.radius.pill;
const PAD_H: Record<Tamano, number> = { sm: tokens.space["3"], md: tokens.space["4"], lg: tokens.space["6"] };
const TEXTO_TAMANO: Record<Tamano, number> = { sm: tokens.size.small, md: tokens.size.body, lg: tokens.size.h5 };

export function Button({
  children,
  onPress,
  variante = "primario",
  tamano = "md",
  bloque = false,
  cargando = false,
  deshabilitado = false,
  iconoIzq,
  iconoDer,
  etiquetaAccesible,
  forma = "pill",
}: PropsBoton) {
  const marca = useMarca();
  const inhabilitado = deshabilitado || cargando;
  const circular = forma === "circular";

  const fondoPorVariante: Record<VarianteBoton, string> = {
    primario: marca.base,
    secundario: tokens.color.surface,
    ghost: "transparent",
    peligro: tokens.color.accentRamp["700"],
  };
  const textoPorVariante: Record<VarianteBoton, string> = {
    primario: marca.foreground,
    secundario: tokens.color.text,
    ghost: marca.base,
    peligro: "#ffffff",
  };
  const solido = variante === "primario" || variante === "peligro";
  // Caprasimo solo en lg (voz display, un solo peso); sm/md en Figtree
  // bold/semibold — mismo criterio que packages/ui/src/web/Button.tsx.
  // Sin `fontWeight` aparte: el archivo YA es ese peso (negrita sintética
  // en Android si además se pisa fontWeight — mismo criterio que
  // mobile/src/components/ui/Text.tsx).
  const fontFamily = tamano === "lg" ? FUENTE_NATIVE.heading : solido ? FUENTE_NATIVE.bodyBold : FUENTE_NATIVE.bodySemiBold;

  return (
    <Pressable
      onPress={onPress}
      disabled={inhabilitado}
      accessibilityRole="button"
      accessibilityLabel={etiquetaAccesible}
      accessibilityState={{ disabled: inhabilitado, busy: cargando }}
      style={({ pressed }): ViewStyle => ({
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: tokens.space["2"],
        backgroundColor: fondoPorVariante[variante],
        borderWidth: variante === "secundario" ? 1 : 0,
        borderColor: tokens.color.divider,
        borderRadius: RADIO_PILL,
        // Circular: cuadrado fijo (ALTURA_NATIVE.lg = 52, coincide con el
        // mínimo táctil que ya pedía el sistema visual v2) — ignora
        // `tamano`/`bloque`, que solo aplican a la forma pill normal.
        ...(circular
          ? { width: ALTURA_NATIVE.lg, height: ALTURA_NATIVE.lg, paddingHorizontal: 0 }
          : { minHeight: ALTURA_NATIVE[tamano], paddingHorizontal: PAD_H[tamano], alignSelf: bloque ? "stretch" : "flex-start" }),
        opacity: inhabilitado ? 0.45 : pressed ? 0.85 : 1,
      })}
    >
      {cargando ? (
        <ActivityIndicator color={textoPorVariante[variante]} />
      ) : (
        iconoIzq && <View>{iconoIzq}</View>
      )}
      {/* Circular es solo ícono — el texto de `children` no se renderiza
          (la forma cuadrada no tiene espacio pensado para él). */}
      {!circular ? (
        <Text
          style={{
            fontFamily,
            fontSize: TEXTO_TAMANO[tamano],
            color: textoPorVariante[variante],
          }}
        >
          {children}
        </Text>
      ) : null}
      {!circular && !cargando && iconoDer ? <View>{iconoDer}</View> : null}
    </Pressable>
  );
}
