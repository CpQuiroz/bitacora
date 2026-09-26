import { useEffect, useState } from "react";
import { Alert, KeyboardAvoidingView, Modal, Platform, Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { Cliente } from "@bitacora/shared";
import { tokens } from "@bitacora/design-tokens";
import { Button, FUENTE_NATIVE, Input, Texto } from "@bitacora/ui/native";
import { crearCliente } from "../services/clientes";

/**
 * Crear cliente al vuelo — hoja emergente (bottom sheet) sobre la
 * pantalla que la invoque (la venta, la cita, o cualquier lugar que
 * necesite un cliente). No abre una pantalla completa ni saca al
 * usuario del formulario en curso: al crear, queda seleccionado y el
 * resto de la ficha se completa después desde la web.
 *
 * Homologada al sistema visual móvil v2 (19-sep-2026) — usaba su
 * propio kit viejo (./ui, tema navy "Faena"), la única hoja que había
 * quedado atrás; el resto de la app (incluida la pantalla completa de
 * "Nuevo cliente") ya estaba en @bitacora/ui/native. Misma paleta y
 * radios que Dialog.tsx (el bottom sheet compartido) — no se usa Dialog
 * en sí porque acá hace falta KeyboardAvoidingView (varios campos con
 * autoFoco inmediato) y el "handle" arrastrable en vez del botón de
 * cerrar con X, que es el patrón propio de ESTA hoja desde el origen.
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
  const insets = useSafeAreaInsets();
  const [nombre, setNombre] = useState(nombreInicial);
  const [contactoNombre, setContactoNombre] = useState("");
  const [telefono, setTelefono] = useState("");
  const [rut, setRut] = useState("");
  const [correo, setCorreo] = useState("");
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (visible) {
      setNombre(nombreInicial);
      setContactoNombre("");
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
    const r = await crearCliente({
      nombre: nombre.trim(),
      telefono: telefono.trim(),
      rut: rut.trim(),
      correo: correo.trim(),
      direccion: "",
      comuna: "",
      notas: "",
      contacto_nombre: contactoNombre.trim(),
    });
    setGuardando(false);
    if (!r.ok) {
      Alert.alert("No se pudo crear el cliente", r.error);
      return;
    }
    onCreado(r.cliente);
    setNombre("");
    setContactoNombre("");
    setTelefono("");
    setRut("");
    setCorreo("");
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onCerrar}>
      <View style={{ flex: 1, backgroundColor: `${tokens.color.neutral["900"]}80`, justifyContent: "flex-end" }}>
        <Pressable style={{ flex: 1 }} onPress={onCerrar} />
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <View
            style={{
              backgroundColor: tokens.color.surface,
              borderTopLeftRadius: 32,
              borderTopRightRadius: 32,
              shadowColor: tokens.color.neutral["900"],
              shadowOpacity: 0.22,
              shadowRadius: 32,
              shadowOffset: { width: 0, height: -4 },
              elevation: 10,
              padding: tokens.space["6"],
              paddingBottom: tokens.space["6"] + insets.bottom,
              gap: tokens.space["4"],
            }}
          >
            <View style={{ alignSelf: "center", width: 38, height: 4, borderRadius: 2, backgroundColor: `${tokens.color.text}33` }} />
            <Texto tamano={tokens.size.h5} color={tokens.color.text} style={{ fontFamily: FUENTE_NATIVE.heading }}>
              Nuevo cliente
            </Texto>
            <Input etiqueta="Empresa o razón social" valor={nombre} onCambio={setNombre} autoFoco />
            <Input etiqueta="Persona de contacto (opcional)" valor={contactoNombre} onCambio={setContactoNombre} />
            <Input etiqueta="Teléfono" tipo="tel" valor={telefono} onCambio={setTelefono} />
            <Input etiqueta="RUT" valor={rut} onCambio={setRut} autoCapitalizar={false} />
            <Input etiqueta="Correo (opcional)" tipo="email" autoCapitalizar={false} valor={correo} onCambio={setCorreo} />
            <Texto tamano={tokens.size.caption} color={tokens.color.textSecondary}>
              Queda creado y seleccionado. El resto de la ficha se completa después desde la web.
            </Texto>
            <Button tamano="lg" bloque onPress={crear} cargando={guardando}>
              Crear y usar
            </Button>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}
