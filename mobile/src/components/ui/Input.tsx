import { useState } from "react";
import { TextInput, View, type TextInputProps } from "react-native";
import { useTema } from "../../theme";
import { Text } from "./Text";

export function Input({
  etiqueta,
  error,
  ayuda,
  style,
  onFocus,
  onBlur,
  ...props
}: TextInputProps & { etiqueta?: string; error?: string | null; ayuda?: string }) {
  const t = useTema();
  const [enfocado, setEnfocado] = useState(false);

  return (
    <View style={{ gap: t.espacio(1.5) }}>
      {etiqueta ? (
        <Text variante="etiqueta" tono="muted">
          {etiqueta}
        </Text>
      ) : null}
      <TextInput
        placeholderTextColor={t.colores.faint}
        {...props}
        onFocus={(e) => {
          setEnfocado(true);
          onFocus?.(e);
        }}
        onBlur={(e) => {
          setEnfocado(false);
          onBlur?.(e);
        }}
        style={[
          {
            borderWidth: 1,
            borderColor: error ? t.colores.danger : enfocado ? t.colores.brand : t.colores.border,
            borderRadius: t.radio.md,
            paddingHorizontal: t.espacio(3.5),
            paddingVertical: t.espacio(3),
            fontSize: t.tipografia.tamano.base,
            color: t.colores.foreground,
            backgroundColor: t.colores.surface,
            fontFamily: t.tipografia.familia,
          },
          props.multiline ? { minHeight: 88, textAlignVertical: "top" } : null,
          style,
        ]}
      />
      {error ? (
        <Text variante="caption" tono="danger">
          {error}
        </Text>
      ) : ayuda ? (
        <Text variante="caption" tono="faint">
          {ayuda}
        </Text>
      ) : null}
    </View>
  );
}
