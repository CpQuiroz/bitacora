import { useState } from "react";
import { TextInput } from "react-native";
import { tokens } from "@bitacora/design-tokens";
import type { PropsTextarea } from "../tipos";
import { useMarca } from "./marca";
import { FUENTE_NATIVE } from "./fuentes";
import { Campo } from "./campo";

export function Textarea({ etiqueta, error, ayuda, deshabilitado, valor, onCambio, placeholder, filas = 4 }: PropsTextarea) {
  const marca = useMarca();
  const [enfocado, setEnfocado] = useState(false);

  return (
    <Campo etiqueta={etiqueta} error={error} ayuda={ayuda}>
      <TextInput
        value={valor}
        onChangeText={onCambio}
        placeholder={placeholder}
        placeholderTextColor={`${tokens.color.text}66`}
        editable={!deshabilitado}
        multiline
        textAlignVertical="top"
        onFocus={() => setEnfocado(true)}
        onBlur={() => setEnfocado(false)}
        style={{
          minHeight: filas * 20 + tokens.space["3"] * 2,
          borderWidth: 1,
          borderColor: error ? tokens.color.accentRamp["700"] : enfocado ? marca.base : tokens.color.divider,
          borderRadius: tokens.radius.md,
          paddingHorizontal: tokens.space["4"],
          paddingVertical: tokens.space["3"],
          fontFamily: FUENTE_NATIVE.body,
          fontSize: tokens.size.body,
          color: tokens.color.text,
          backgroundColor: tokens.color.surface,
          opacity: deshabilitado ? 0.5 : 1,
        }}
      />
    </Campo>
  );
}
