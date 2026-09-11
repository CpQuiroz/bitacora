import { useState } from "react";
import { TextInput, View, type KeyboardTypeOptions, type TextInputProps } from "react-native";
import { tokens } from "@bitacora/design-tokens";
import type { PropsInput, TipoInput } from "../tipos";
import { useMarca } from "./marca";
import { FUENTE_NATIVE } from "./fuentes";
import { Campo } from "./campo";

const TECLADO: Record<TipoInput, KeyboardTypeOptions> = {
  texto: "default",
  numero: "numeric",
  codigo: "number-pad",
  email: "email-address",
  password: "default",
  tel: "phone-pad",
  hora: "default",
};

const CONTENIDO: Record<TipoInput, TextInputProps["textContentType"]> = {
  texto: "none",
  numero: "none",
  codigo: "oneTimeCode",
  email: "emailAddress",
  password: "password",
  tel: "telephoneNumber",
  hora: "none",
};

export function Input({
  etiqueta,
  error,
  ayuda,
  deshabilitado,
  valor,
  onCambio,
  placeholder,
  tipo = "texto",
  maxLongitud,
  iconoIzq,
  autoFoco,
  autoCapitalizar = true,
  onSubmit,
}: PropsInput) {
  const marca = useMarca();
  const [enfocado, setEnfocado] = useState(false);

  return (
    <Campo etiqueta={etiqueta} error={error} ayuda={ayuda}>
      <View style={{ position: "relative" }}>
        {iconoIzq ? (
          <View style={{ position: "absolute", left: tokens.space["3"], top: 0, bottom: 0, justifyContent: "center", zIndex: 1 }}>
            {iconoIzq}
          </View>
        ) : null}
        <TextInput
          value={valor}
          onChangeText={onCambio}
          placeholder={placeholder}
          placeholderTextColor={`${tokens.color.text}66`}
          editable={!deshabilitado}
          autoFocus={autoFoco}
          secureTextEntry={tipo === "password"}
          keyboardType={TECLADO[tipo]}
          textContentType={CONTENIDO[tipo]}
          maxLength={maxLongitud}
          autoCapitalize={autoCapitalizar ? "sentences" : "none"}
          autoCorrect={autoCapitalizar}
          returnKeyType={onSubmit ? "go" : "next"}
          onSubmitEditing={onSubmit}
          onFocus={() => setEnfocado(true)}
          onBlur={() => setEnfocado(false)}
          style={{
            minHeight: 44,
            borderWidth: 1,
            borderColor: error ? tokens.color.accentRamp["700"] : enfocado ? marca.base : tokens.color.divider,
            borderRadius: tokens.radius.pill,
            paddingHorizontal: tokens.space["4"],
            paddingLeft: iconoIzq ? tokens.space["8"] : tokens.space["4"],
            fontFamily: FUENTE_NATIVE.body,
            fontSize: tokens.size.body,
            color: tokens.color.text,
            backgroundColor: tokens.color.surface,
            opacity: deshabilitado ? 0.5 : 1,
          }}
        />
      </View>
    </Campo>
  );
}
