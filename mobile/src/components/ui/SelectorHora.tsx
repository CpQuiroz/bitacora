import { useState } from "react";
import { Modal, Platform, Pressable, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import DateTimePicker, { type DateTimePickerEvent } from "@react-native-community/datetimepicker";
import { useTema } from "../../theme";
import { Button } from "./Button";
import { Text } from "./Text";

function horaADate(hora: string): Date {
  const d = new Date();
  const [h, m] = hora.split(":").map(Number);
  d.setHours(Number.isFinite(h) ? h : 9, Number.isFinite(m) ? m : 0, 0, 0);
  return d;
}

function dateAHora(d: Date): string {
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/**
 * Selector de hora con reloj nativo (@react-native-community/datetimepicker)
 * — reemplaza el campo de texto libre "HH:MM" que obligaba a tipear.
 * En Android el picker es un diálogo nativo que se cierra solo; en iOS es
 * inline (spinner), así que se envuelve en nuestro propio modal con
 * "Listo"/"Cancelar" — mismo estilo que PickerBuscable/SelectorCliente.
 */
export function SelectorHora({
  etiqueta,
  valor,
  onCambiar,
  placeholder = "Sin hora definida",
}: {
  etiqueta: string;
  valor: string; // "" = sin hora, si no "HH:MM"
  onCambiar: (v: string) => void;
  placeholder?: string;
}) {
  const t = useTema();
  const [abierto, setAbierto] = useState(false);
  const [borrador, setBorrador] = useState(() => horaADate(valor || "09:00"));

  function abrir() {
    setBorrador(horaADate(valor || "09:00"));
    setAbierto(true);
  }

  function onChangeAndroid(event: DateTimePickerEvent, seleccionada?: Date) {
    setAbierto(false);
    if (event.type === "set" && seleccionada) onCambiar(dateAHora(seleccionada));
  }

  return (
    <View style={{ gap: t.espacio(1.5) }}>
      <Text variante="etiqueta" tono="muted">
        {etiqueta}
      </Text>
      <View style={{ flexDirection: "row", gap: t.espacio(2) }}>
        <Pressable
          onPress={abrir}
          style={({ pressed }) => ({
            flex: 1,
            flexDirection: "row",
            alignItems: "center",
            gap: t.espacio(2),
            borderWidth: 1,
            borderColor: t.colores.border,
            borderRadius: t.radio.md,
            paddingHorizontal: t.espacio(3.5),
            minHeight: 48,
            backgroundColor: t.colores.surface,
            opacity: pressed ? 0.7 : 1,
          })}
        >
          <Ionicons name="time-outline" size={18} color={t.colores.muted} />
          <Text variante="cuerpo" tono={valor ? "normal" : "faint"}>
            {valor || placeholder}
          </Text>
        </Pressable>
        {valor ? (
          <Pressable
            onPress={() => onCambiar("")}
            hitSlop={8}
            style={{ alignItems: "center", justifyContent: "center", paddingHorizontal: t.espacio(1) }}
          >
            <Ionicons name="close-circle" size={22} color={t.colores.faint} />
          </Pressable>
        ) : null}
      </View>

      {abierto && Platform.OS === "android" ? (
        <DateTimePicker value={borrador} mode="time" is24Hour onChange={onChangeAndroid} />
      ) : null}

      {Platform.OS === "ios" && (
        <Modal visible={abierto} animationType="slide" transparent onRequestClose={() => setAbierto(false)}>
          <View style={{ flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.4)" }}>
            <View style={{ backgroundColor: t.colores.surface, borderTopLeftRadius: t.radio.lg, borderTopRightRadius: t.radio.lg, padding: t.espacio(4), gap: t.espacio(3) }}>
              <Text variante="subtitulo" style={{ textAlign: "center" }}>
                {etiqueta}
              </Text>
              <DateTimePicker
                value={borrador}
                mode="time"
                is24Hour
                display="spinner"
                onChange={(_, seleccionada) => seleccionada && setBorrador(seleccionada)}
              />
              <View style={{ flexDirection: "row", gap: t.espacio(2) }}>
                <Button
                  titulo="Listo"
                  tamano="lg"
                  onPress={() => {
                    onCambiar(dateAHora(borrador));
                    setAbierto(false);
                  }}
                />
                <Button titulo="Cancelar" variante="ghost" onPress={() => setAbierto(false)} />
              </View>
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
}
