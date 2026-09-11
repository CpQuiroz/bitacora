import { View } from "react-native";
import { tokens } from "@bitacora/design-tokens";
import type { PropsErrorState } from "../tipos";
import { Texto } from "./Texto";
import { FUENTE_NATIVE } from "./fuentes";
import { Button } from "./Button";

export function ErrorState({ titulo = "No se pudo cargar", mensaje, onReintentar, icono }: PropsErrorState) {
  return (
    <View style={{ alignItems: "center", gap: tokens.space["3"], paddingVertical: tokens.space["8"] }}>
      <View
        style={{
          width: 64,
          height: 64,
          borderRadius: 32,
          backgroundColor: tokens.color.accentRamp["200"],
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {icono}
      </View>
      <Texto tamano={tokens.size.h4} color={tokens.color.text} style={{ fontFamily: FUENTE_NATIVE.heading, textAlign: "center" }}>
        {titulo}
      </Texto>
      {mensaje ? (
        <Texto tamano={tokens.size.small} color={`${tokens.color.text}b3`} style={{ textAlign: "center", maxWidth: 320 }}>
          {mensaje}
        </Texto>
      ) : null}
      {onReintentar ? (
        <View style={{ marginTop: tokens.space["1"] }}>
          <Button variante="secundario" tamano="sm" onPress={onReintentar}>
            Reintentar
          </Button>
        </View>
      ) : null}
    </View>
  );
}
