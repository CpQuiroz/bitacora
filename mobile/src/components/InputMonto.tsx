import { useState } from "react";
import { TextInput, View } from "react-native";
import { useTema } from "../theme";
import { Text } from "./ui";
import { agruparMiles, soloDigitos } from "../lib/plata";

/**
 * Campo de plata: muestra "$ 1.250.000" con separador de miles y letra
 * grande, pero entrega solo los dígitos por `onChangeText`. Para viajes,
 * trabajos y cobros — donde el monto es lo que más se mira.
 */
export function InputMonto({
  etiqueta = "Monto",
  valor,
  onChangeText,
  ayuda,
}: {
  etiqueta?: string;
  valor: string; // solo dígitos
  onChangeText: (digitos: string) => void;
  ayuda?: string;
}) {
  const t = useTema();
  const [enfocado, setEnfocado] = useState(false);
  const mostrado = agruparMiles(valor);

  return (
    <View style={{ gap: t.espacio(1.5) }}>
      <Text variante="etiqueta" tono="muted">
        {etiqueta}
      </Text>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          borderWidth: 1,
          borderColor: enfocado ? t.colores.brand : t.colores.border,
          borderRadius: t.radio.md,
          backgroundColor: t.colores.surface,
          paddingHorizontal: t.espacio(3.5),
        }}
      >
        <Text variante="subtitulo" tono="muted" style={{ marginRight: t.espacio(2) }}>
          $
        </Text>
        <TextInput
          value={mostrado}
          onChangeText={(v) => onChangeText(soloDigitos(v))}
          keyboardType="numeric"
          placeholder="0"
          placeholderTextColor={t.colores.faint}
          onFocus={() => setEnfocado(true)}
          onBlur={() => setEnfocado(false)}
          style={{
            flex: 1,
            paddingVertical: t.espacio(3),
            fontSize: t.tipografia.tamano.lg,
            fontWeight: "600",
            color: t.colores.foreground,
            fontFamily: t.tipografia.familia,
            fontVariant: ["tabular-nums"],
          }}
        />
      </View>
      {ayuda ? (
        <Text variante="caption" tono="faint">
          {ayuda}
        </Text>
      ) : null}
    </View>
  );
}
