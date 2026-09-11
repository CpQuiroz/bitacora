import { useState } from "react";
import { Modal, Platform, Pressable, View } from "react-native";
import DateTimePicker, { type DateTimePickerEvent } from "@react-native-community/datetimepicker";
import { tokens } from "@bitacora/design-tokens";
import type { PropsDatePicker } from "../tipos";
import { Campo } from "./campo";
import { Texto } from "./Texto";
import { Button } from "./Button";

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
function formatear(f: Date): string {
  return `${f.getDate()} ${MESES[f.getMonth()]} ${f.getFullYear()}`;
}

// Mismo patrón que components/ui/SelectorHora.tsx: Android es un diálogo
// nativo que se cierra solo; iOS queda en nuestro modal con Listo/Cancelar.
export function DatePicker({ etiqueta, error, ayuda, deshabilitado, valor, onCambio, placeholder, minimo, maximo }: PropsDatePicker) {
  const [abierto, setAbierto] = useState(false);
  const [borrador, setBorrador] = useState<Date>(valor ?? new Date());

  function abrir() {
    setBorrador(valor ?? new Date());
    setAbierto(true);
  }

  function onChangeAndroid(event: DateTimePickerEvent, seleccionada?: Date) {
    setAbierto(false);
    if (event.type === "set" && seleccionada) onCambio(seleccionada);
  }

  return (
    <Campo etiqueta={etiqueta} error={error} ayuda={ayuda}>
      <Pressable
        disabled={deshabilitado}
        onPress={abrir}
        style={{
          minHeight: 44,
          flexDirection: "row",
          alignItems: "center",
          borderWidth: 1,
          borderColor: error ? tokens.color.accentRamp["700"] : tokens.color.divider,
          borderRadius: tokens.radius.pill,
          paddingHorizontal: tokens.space["4"],
          backgroundColor: tokens.color.surface,
          opacity: deshabilitado ? 0.5 : 1,
        }}
      >
        <Texto tamano={tokens.size.body} color={valor ? tokens.color.text : `${tokens.color.text}66`}>
          {valor ? formatear(valor) : placeholder ?? "Elegir fecha"}
        </Texto>
      </Pressable>

      {abierto && Platform.OS === "android" ? (
        <DateTimePicker value={borrador} mode="date" minimumDate={minimo} maximumDate={maximo} onChange={onChangeAndroid} />
      ) : null}

      {Platform.OS === "ios" ? (
        <Modal visible={abierto} animationType="slide" transparent onRequestClose={() => setAbierto(false)}>
          <View style={{ flex: 1, justifyContent: "flex-end", backgroundColor: `${tokens.color.neutral["900"]}80` }}>
            <View
              style={{
                backgroundColor: tokens.color.surface,
                borderTopLeftRadius: tokens.radius.lg,
                borderTopRightRadius: tokens.radius.lg,
                padding: tokens.space["4"],
                gap: tokens.space["3"],
              }}
            >
              <DateTimePicker
                value={borrador}
                mode="date"
                display="spinner"
                minimumDate={minimo}
                maximumDate={maximo}
                onChange={(_, seleccionada) => seleccionada && setBorrador(seleccionada)}
              />
              <View style={{ flexDirection: "row", gap: tokens.space["2"] }}>
                <Button
                  tamano="lg"
                  onPress={() => {
                    onCambio(borrador);
                    setAbierto(false);
                  }}
                >
                  Listo
                </Button>
                <Button variante="ghost" onPress={() => setAbierto(false)}>
                  Cancelar
                </Button>
              </View>
            </View>
          </View>
        </Modal>
      ) : null}
    </Campo>
  );
}
