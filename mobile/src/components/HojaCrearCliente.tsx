import { useEffect, useState } from "react";
import { Alert, KeyboardAvoidingView, Modal, Platform, Pressable, View } from "react-native";
import type { Cliente } from "@bitacora/shared";
import { useTema } from "../theme";
import { Button, Input, Text } from "./ui";
import { crearCliente } from "../services/clientes";

/**
 * Crear cliente al vuelo — hoja emergente (bottom sheet) sobre la
 * pantalla que la invoque (la venta, la cita, o cualquier lugar que
 * necesite un cliente). No abre una pantalla completa ni saca al
 * usuario del formulario en curso: al crear, queda seleccionado y el
 * resto de la ficha se completa después desde la web.
 */
export function HojaCrearCliente({
  visible,
  nombreInicial = "",
  onCerrar,
  onCreado,
}: {
  visible: boolean;
  nombreInicial?: string;
  onCerrar: () => void;
  onCreado: (c: Cliente) => void;
}) {
  const t = useTema();
  const [nombre, setNombre] = useState(nombreInicial);
  const [telefono, setTelefono] = useState("");
  const [rut, setRut] = useState("");
  const [correo, setCorreo] = useState("");
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (visible) {
      setNombre(nombreInicial);
      setTelefono("");
      setRut("");
      setCorreo("");
    }
  }, [visible, nombreInicial]);

  async function crear() {
    if (!nombre.trim()) {
      Alert.alert("Falta el nombre", "Escribe el nombre o la razón social.");
      return;
    }
    setGuardando(true);
    const r = await crearCliente({ nombre: nombre.trim(), telefono: telefono.trim(), rut: rut.trim(), correo: correo.trim(), direccion: "", comuna: "", notas: "" });
    setGuardando(false);
    if (!r.ok) {
      Alert.alert("No se pudo crear el cliente", r.error);
      return;
    }
    onCreado(r.cliente);
    setNombre("");
    setTelefono("");
    setRut("");
    setCorreo("");
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onCerrar}>
      <View style={{ flex: 1, backgroundColor: t.colores.overlay, justifyContent: "flex-end" }}>
        <Pressable style={{ flex: 1 }} onPress={onCerrar} />
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <View
            style={{
              backgroundColor: t.colores.surface,
              borderTopLeftRadius: 14,
              borderTopRightRadius: 14,
              padding: t.espacio(5),
              paddingBottom: t.espacio(8),
              gap: t.espacio(3),
            }}
          >
            <View style={{ alignSelf: "center", width: 38, height: 4, borderRadius: 2, backgroundColor: t.colores.borderStrong }} />
            <Text variante="subtitulo">Nuevo cliente</Text>
            <Input etiqueta="Nombre o razón social" value={nombre} onChangeText={setNombre} autoFocus />
            <Input etiqueta="Teléfono" value={telefono} onChangeText={setTelefono} keyboardType="phone-pad" />
            <Input etiqueta="RUT" value={rut} onChangeText={setRut} autoCapitalize="characters" />
            <Input etiqueta="Correo (opcional)" value={correo} onChangeText={setCorreo} keyboardType="email-address" autoCapitalize="none" />
            <Text variante="caption" tono="faint">
              Queda creado y seleccionado. El resto de la ficha se completa después desde la web.
            </Text>
            <Button titulo="Crear y usar" tamano="lg" onPress={crear} cargando={guardando} />
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}
