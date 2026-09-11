import { useState } from "react";
import { Modal, Pressable, ScrollView, View } from "react-native";
import { tokens } from "@bitacora/design-tokens";
import type { PropsSelect } from "../tipos";
import { useMarca } from "./marca";
import { Campo } from "./campo";
import { Texto } from "./Texto";

// Hoja simple (sin buscador — para eso están los Selector* propios de la
// app, ej. PickerBuscable). Esta es la primitiva base del sistema nuevo.
export function Select({ etiqueta, error, ayuda, deshabilitado, valor, onCambio, opciones, placeholder }: PropsSelect) {
  const marca = useMarca();
  const [abierto, setAbierto] = useState(false);
  const seleccionada = opciones.find((o) => o.valor === valor);

  return (
    <Campo etiqueta={etiqueta} error={error} ayuda={ayuda}>
      <Pressable
        disabled={deshabilitado}
        onPress={() => setAbierto(true)}
        style={{
          minHeight: 44,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          borderWidth: 1,
          borderColor: error ? tokens.color.accentRamp["700"] : tokens.color.divider,
          borderRadius: tokens.radius.pill,
          paddingHorizontal: tokens.space["4"],
          backgroundColor: tokens.color.surface,
          opacity: deshabilitado ? 0.5 : 1,
        }}
      >
        <Texto tamano={tokens.size.body} color={seleccionada ? tokens.color.text : `${tokens.color.text}66`}>
          {seleccionada?.etiqueta ?? placeholder ?? ""}
        </Texto>
        <Texto tamano={tokens.size.small} color={`${tokens.color.text}80`}>
          ▾
        </Texto>
      </Pressable>

      <Modal visible={abierto} transparent animationType="fade" onRequestClose={() => setAbierto(false)}>
        <Pressable
          onPress={() => setAbierto(false)}
          style={{ flex: 1, backgroundColor: `${tokens.color.neutral["900"]}80`, justifyContent: "flex-end" }}
        >
          <Pressable
            style={{
              backgroundColor: tokens.color.surface,
              borderTopLeftRadius: tokens.radius.lg,
              borderTopRightRadius: tokens.radius.lg,
              maxHeight: "70%",
              paddingVertical: tokens.space["3"],
            }}
          >
            <ScrollView>
              {opciones.map((o) => (
                <Pressable
                  key={o.valor}
                  onPress={() => {
                    onCambio(o.valor);
                    setAbierto(false);
                  }}
                  style={{ paddingHorizontal: tokens.space["4"], paddingVertical: tokens.space["3"] }}
                >
                  <Texto
                    tamano={tokens.size.body}
                    peso={o.valor === valor ? "semibold" : "regular"}
                    color={o.valor === valor ? marca.base : tokens.color.text}
                  >
                    {o.etiqueta}
                  </Texto>
                </Pressable>
              ))}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </Campo>
  );
}
