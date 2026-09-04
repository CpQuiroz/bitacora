import { useState } from "react";
import { Alert, Modal, ScrollView, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Pressable } from "react-native";
import type { Cliente } from "@bitacora/shared";
import { useTema } from "../theme";
import { Button, Input, PickerBuscable, Text } from "./ui";
import { crearCliente } from "../services/clientes";

/**
 * Selector de cliente con búsqueda + "＋ Nuevo cliente" al pie: abre un
 * mini formulario (nombre + dirección, lo mínimo que pide el backend) y
 * al crearlo lo deja seleccionado. Mismo comportamiento que el
 * ComboboxCliente de la web.
 */
export function SelectorCliente({
  etiqueta = "Cliente",
  valor,
  onElegir,
  clientes,
  onClienteCreado,
}: {
  etiqueta?: string;
  valor: string;
  onElegir: (id: string) => void;
  clientes: Pick<Cliente, "id" | "nombre">[];
  onClienteCreado: (c: Cliente) => void;
}) {
  const t = useTema();
  const [abierto, setAbierto] = useState(false);
  const [nombre, setNombre] = useState("");
  const [direccion, setDireccion] = useState("");
  const [guardando, setGuardando] = useState(false);

  async function crear() {
    if (!nombre.trim() || !direccion.trim()) {
      Alert.alert("Faltan datos", "Necesito al menos el nombre y la dirección del cliente.");
      return;
    }
    setGuardando(true);
    const r = await crearCliente({
      nombre: nombre.trim(),
      direccion: direccion.trim(),
      rut: "",
      comuna: "",
      telefono: "",
      correo: "",
      notas: "",
    });
    setGuardando(false);
    if (!r.ok) {
      Alert.alert("No se pudo crear el cliente", r.error);
      return;
    }
    onClienteCreado(r.cliente);
    onElegir(r.cliente.id);
    setAbierto(false);
    setNombre("");
    setDireccion("");
  }

  return (
    <>
      <PickerBuscable
        etiqueta={etiqueta}
        placeholder="Elegir cliente"
        valor={valor}
        opciones={clientes.map((c) => ({ id: c.id, label: c.nombre }))}
        onElegir={onElegir}
        alCrear={(texto) => {
          setNombre(texto);
          setDireccion("");
          setAbierto(true);
        }}
        etiquetaCrear="Nuevo cliente"
      />

      <Modal visible={abierto} animationType="slide" onRequestClose={() => setAbierto(false)}>
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
            <Pressable onPress={() => setAbierto(false)} hitSlop={12}>
              <Ionicons name="close" size={24} color={t.colores.foreground} />
            </Pressable>
            <Text variante="subtitulo" style={{ flex: 1 }}>
              Nuevo cliente
            </Text>
          </View>
          <ScrollView
            contentContainerStyle={{ padding: t.espacio(5), gap: t.espacio(4) }}
            keyboardShouldPersistTaps="handled"
          >
            <Input etiqueta="Nombre" value={nombre} onChangeText={setNombre} autoFocus />
            <Input etiqueta="Dirección" value={direccion} onChangeText={setDireccion} />
            <Text variante="caption" tono="muted">
              Después podés completar el resto de la ficha desde la pestaña Clientes.
            </Text>
            <Button titulo="Crear y seleccionar" tamano="lg" onPress={crear} cargando={guardando} />
          </ScrollView>
        </View>
      </Modal>
    </>
  );
}
