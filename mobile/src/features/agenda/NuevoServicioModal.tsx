import { useState } from "react";
import { Alert, Modal, Pressable, ScrollView, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { Servicio } from "@bitacora/shared";
import { useTema } from "../../theme";
import { Button, Input, Text } from "../../components/ui";
import { InputMonto } from "../../components/InputMonto";
import { crearServicio, editarServicio } from "../../services/servicios";

const DURACIONES = [30, 45, 60, 90];

/**
 * Alta y edición de un servicio del catálogo (Agenda Pro). Con `servicio`
 * abre en modo edición (precio, nombre, duración, activo); sin él, crea
 * uno nuevo.
 */
export function NuevoServicioModal({
  visible,
  servicio,
  nombreInicial = "",
  onCerrar,
  onGuardado,
}: {
  visible: boolean;
  servicio?: Servicio | null;
  nombreInicial?: string;
  onCerrar: () => void;
  onGuardado: (s: Servicio) => void;
}) {
  const t = useTema();
  const editando = Boolean(servicio);
  // El padre monta el modal con key={servicio?.id ?? "nuevo"}, así que
  // estos valores iniciales se toman de cero cada vez que cambia el
  // servicio a editar.
  const [nombre, setNombre] = useState(servicio?.nombre ?? nombreInicial);
  const [precio, setPrecio] = useState(servicio ? String(servicio.precio) : "");
  const [duracion, setDuracion] = useState(servicio?.duracion_sugerida_min ?? 45);
  const [activo, setActivo] = useState(servicio?.activo ?? true);
  const [guardando, setGuardando] = useState(false);

  async function guardar() {
    const nombreLimpio = nombre.trim();
    if (!nombreLimpio) return Alert.alert("Falta el nombre", "Ponle un nombre al servicio.");
    const precioNum = Number(precio.replace(/\D/g, "")) || 0;
    if (!Number.isInteger(duracion) || duracion <= 0) return Alert.alert("Duración inválida", "Elige una duración mayor a 0.");

    setGuardando(true);
    const r = servicio
      ? await editarServicio(servicio.id, { nombre: nombreLimpio, precio: precioNum, duracion_sugerida_min: duracion, activo })
      : await crearServicio({ nombre: nombreLimpio, precio: precioNum, duracion_sugerida_min: duracion });
    setGuardando(false);
    if (!r.ok) return Alert.alert("No se pudo guardar", r.error);

    onGuardado(r.servicio);
    if (!editando) {
      setNombre("");
      setPrecio("");
      setDuracion(45);
    }
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
            {editando ? "Editar servicio" : "Nuevo servicio"}
          </Text>
        </View>

        <ScrollView contentContainerStyle={{ padding: t.espacio(5), gap: t.espacio(4) }} keyboardShouldPersistTaps="handled">
          <Input etiqueta="Nombre" placeholder="Ej: Limpieza facial" value={nombre} onChangeText={setNombre} autoFocus={!editando} />
          <InputMonto etiqueta="Precio de lista" valor={precio} onChangeText={setPrecio} />
          <View style={{ gap: t.espacio(2) }}>
            <Text variante="etiqueta" tono="muted">
              Duración sugerida
            </Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: t.espacio(2) }}>
              {DURACIONES.map((min) => {
                const on = duracion === min;
                return (
                  <Pressable
                    key={min}
                    onPress={() => setDuracion(min)}
                    style={{
                      minHeight: 40,
                      justifyContent: "center",
                      paddingHorizontal: t.espacio(3.5),
                      borderRadius: t.radio.md,
                      backgroundColor: on ? t.colores.brand : t.colores.surface,
                      borderWidth: 1,
                      borderColor: on ? t.colores.brand : t.colores.border,
                    }}
                  >
                    <Text variante="etiqueta" weight="semibold" tono={on ? "inverso" : "normal"}>
                      {min} min
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {editando ? (
            <Pressable
              onPress={() => setActivo((v) => !v)}
              style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", minHeight: 44 }}
            >
              <View style={{ flex: 1 }}>
                <Text variante="cuerpo">Activo</Text>
                <Text variante="caption" tono="muted">
                  Un servicio inactivo no aparece al crear una reserva.
                </Text>
              </View>
              <Ionicons name={activo ? "toggle" : "toggle-outline"} size={34} color={activo ? t.colores.brand : t.colores.muted} />
            </Pressable>
          ) : (
            <Text variante="caption" tono="muted">
              Podés ajustar el precio y la duración de esta reserva puntual después.
            </Text>
          )}

          <Button
            titulo={editando ? "Guardar" : "Crear y elegir"}
            tamano="lg"
            onPress={guardar}
            cargando={guardando}
          />
        </ScrollView>
      </View>
    </Modal>
  );
}
