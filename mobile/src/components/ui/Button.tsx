import { ActivityIndicator, Pressable, View, type ViewStyle } from "react-native";
import { useTema } from "../../theme";
import { Text } from "./Text";

type Variante = "primario" | "secundario" | "ghost" | "peligro";
type Tamano = "md" | "lg";

export function Button({
  titulo,
  onPress,
  variante = "primario",
  tamano = "md",
  cargando = false,
  disabled = false,
  fullWidth = true,
  icono,
  style,
}: {
  titulo: string;
  onPress: () => void;
  variante?: Variante;
  tamano?: Tamano;
  cargando?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  icono?: React.ReactNode;
  style?: ViewStyle;
}) {
  const t = useTema();
  const inhabilitado = disabled || cargando;

  const fondo: Record<Variante, string> = {
    primario: t.colores.brand,
    secundario: t.colores.surface,
    ghost: "transparent",
    peligro: t.colores.danger,
  };
  const textoTono = variante === "primario" || variante === "peligro" ? "inverso" : variante === "ghost" ? "brand" : "normal";
  const borde = variante === "secundario" ? t.colores.border : "transparent";

  return (
    <Pressable
      onPress={onPress}
      disabled={inhabilitado}
      style={({ pressed }) => [
        {
          backgroundColor: fondo[variante],
          borderColor: borde,
          borderWidth: variante === "secundario" ? 1 : 0,
          borderRadius: t.radio.md,
          paddingVertical: tamano === "lg" ? t.espacio(4) : t.espacio(3.25),
          paddingHorizontal: t.espacio(4),
          alignItems: "center",
          justifyContent: "center",
          flexDirection: "row",
          gap: t.espacio(2),
          alignSelf: fullWidth ? "stretch" : "flex-start",
          opacity: inhabilitado ? 0.45 : pressed ? 0.85 : 1,
        },
        style,
      ]}
    >
      {cargando ? (
        <ActivityIndicator color={textoTono === "inverso" ? t.colores.brandForeground : t.colores.brand} />
      ) : (
        <>
          {icono ? <View>{icono}</View> : null}
          <Text variante="etiqueta" tono={textoTono} weight="semibold" style={{ fontSize: tamano === "lg" ? 16 : 15 }}>
            {titulo}
          </Text>
        </>
      )}
    </Pressable>
  );
}
