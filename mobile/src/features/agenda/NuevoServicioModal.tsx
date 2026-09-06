import { useState } from "react";
import { Alert, Modal, Pressable, ScrollView, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { Servicio } from "@bitacora/shared";
import { useTema } from "../../theme";
import { Button, Input, Text } from "../../components/ui";
import { crearServicio } from "../../services/servicios";

const DURACIONES = [30, 45, 60, 90];

/**
 * Alta rápida de un servicio del catálogo (Agenda Pro) desde "Nueva
 * reserva" — para no tener que ir a la web cuando falta uno. El resto
 * del catálogo (editar, desactivar) sigue viviendo en la web.
 */
export function NuevoServicioModal({
  visible,
  nombreInicial = "",
  onCerrar,
  onCreado,
}: {
  visible: boolean;
  nombreInicial?: string;
  onCerrar: () => void;
  onCreado: (s: Servicio) => void;
}) {
  const t = useTema();
  const [nombre, setNombre] = useState(nombreInicial);
  const [precio, setPrecio] = useState("");
  const [duracion, setDuracion] = useState(45);
  const [guardando, setGuardando] = useState(false);

  async function crear() {
    const nombreLimpio = nombre.trim();
    if (!nombreLimpio) return Alert.alert("Falta el nombre", "Ponle un nombre al servicio.");
    const precioNum = Number(precio.replace(/\D/g, "")) || 0;
    if (!Number.isInteger(duracion) || duracion <= 0) return Alert.alert("Duración inválida", "Elige una duración mayor a 0.");

    setGuardando(true);
    const r = await crearServicio({ nombre: nombreLimpio, precio: precioNum, duracion_sugerida_min: duracion });
    setGuardando(false);
    if (!r.ok) return Alert.alert("No se pudo crear", r.error);

    onCreado(r.servicio);
    setNombre("");
    setPrecio("");
    setDuracion(45);
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onCerrar}>
      <View style={{ flex: 1, backgroundColor: t.colores.bg }}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: t.espacio(3),
            paddingHorizontal: t.espacio(4),
            paddingTop: t.espacio(12),
            paddingBottom: t.espacio(3),
            borderBottomWidth: 1,
            borderBottomColor: t.colores.border,
          }}
        >
          <Pressable onPress={onCerrar} hitSlop={12}>
            <Ionicons name="close" size={24} color={t.colores.foreground} />
          </Pressable>
          <Text variante="subtitulo" style={{ flex: 1 }}>
            Nuevo servicio
          </Text>
        </View>

        <ScrollView contentContainerStyle={{ padding: t.espacio(5), gap: t.espacio(4) }} keyboardShouldPersistTaps="handled">
          <Input etiqueta="Nombre" placeholder="Ej: Limpieza facial" value={nombre} onChangeText={setNombre} autoFocus />
          <Input
            etiqueta="Precio de lista"
            keyboardType="numeric"
            placeholder="0"
            value={precio}
            onChangeText={(v) => setPrecio(v.replace(/\D/g, ""))}
          />
          <View style={{ gap: t.espacio(2) }}>
            <Text variante="etiqueta" tono="muted">
              Duración sugerida
            </Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: t.espacio(2) }}>
              {DURACIONES.map((min) => {
                const activo = duracion === min;
                return (
                  <Pressable
                    key={min}
                    onPress={() => setDuracion(min)}
                    style={{
                      minHeight: 40,
                      justifyContent: "center",
                      paddingHorizontal: t.espacio(3.5),
                      borderRadius: t.radio.md,
                      backgroundColor: activo ? t.colores.brand : t.colores.surface,
                      borderWidth: 1,
                      borderColor: activo ? t.colores.brand : t.colores.border,
                    }}
                  >
                    <Text variante="etiqueta" weight="semibold" tono={activo ? "inverso" : "normal"}>
                      {min} min
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
          <Text variante="caption" tono="muted">
            Podés ajustar el precio y la duración de esta reserva puntual después. El resto del catálogo se edita desde la web.
          </Text>
          <Button titulo="Crear y elegir" tamano="lg" onPress={crear} cargando={guardando} />
        </ScrollView>
      </View>
    </Modal>
  );
}
