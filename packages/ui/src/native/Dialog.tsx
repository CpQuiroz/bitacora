import { Modal, Pressable, View } from "react-native";
import { tokens } from "@bitacora/design-tokens";
import type { PropsDialog } from "../tipos";
import { FUENTE_NATIVE } from "./fuentes";
import { Texto } from "./Texto";

// En mobile el "Dialog" es siempre un bottom sheet (no hay variante
// centrada) — misma paleta que el web: backdrop neutral.900 @ 50%,
// contenedor con el radio de Card (radius.lg × 1.15) y sombra lg.
export function Dialog({ abierto, onCerrar, titulo, children }: PropsDialog) {
  return (
    <Modal visible={abierto} transparent animationType="fade" onRequestClose={onCerrar}>
      <Pressable
        onPress={onCerrar}
        style={{ flex: 1, backgroundColor: `${tokens.color.neutral["900"]}80`, justifyContent: "flex-end" }}
      >
        <Pressable
          style={{
            backgroundColor: tokens.color.surface,
            borderTopLeftRadius: 32,
            borderTopRightRadius: 32,
            maxHeight: "85%",
            shadowColor: tokens.color.neutral["900"],
            shadowOpacity: 0.22,
            shadowRadius: 32,
            shadowOffset: { width: 0, height: -4 },
            elevation: 10,
          }}
        >
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              borderBottomWidth: 1,
              borderBottomColor: tokens.color.divider,
              paddingHorizontal: tokens.space["6"],
              paddingVertical: tokens.space["4"],
            }}
          >
            <Texto tamano={tokens.size.h5} color={tokens.color.text} style={{ fontFamily: FUENTE_NATIVE.heading }}>
              {titulo}
            </Texto>
            <Pressable onPress={onCerrar} hitSlop={8}>
              <Texto tamano={tokens.size.body} color={`${tokens.color.text}99`}>
                ✕
              </Texto>
            </Pressable>
          </View>
          <View style={{ paddingHorizontal: tokens.space["6"], paddingVertical: tokens.space["4"] }}>{children}</View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
