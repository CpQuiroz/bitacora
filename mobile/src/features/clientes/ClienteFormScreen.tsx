import { useEffect, useState } from "react";
import { Alert, KeyboardAvoidingView, Platform, ScrollView, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { ArrowLeft } from "lucide-react-native";
import { tokens } from "@bitacora/design-tokens";
import { Button, Input, LoadingState, ScreenHeader, Textarea } from "@bitacora/ui/native";
import { useRed } from "../../services/sync/NetworkProvider";
import { crearCliente, editarCliente, obtenerCliente, type BorradorCliente } from "../../services/clientes";
import type { ClientesStackParamList } from "../../shell/navigation/types";

const VACIO: BorradorCliente = { nombre: "", rut: "", direccion: "", comuna: "", telefono: "", correo: "", notas: "", contacto_nombre: "" };

// Sistema visual móvil v2 (tarea 31) — pantalla PUSH (ClientesStack la
// registra sin `presentation: "modal"`), mismo patrón que
// ClienteDetalleScreen: ScreenHeader propio con `accion` de volver, header
// nativo apagado en ClientesStack.tsx. El título ya no se fija con
// navigation.setOptions (eso era para el header nativo que ya no se usa
// acá) — ahora es un valor calculado que se le pasa directo a ScreenHeader.
export function ClienteFormScreen({ navigation, route }: NativeStackScreenProps<ClientesStackParamList, "ClienteForm">) {
  const { enLinea } = useRed();
  const editandoId = route.params?.clienteId ?? null;

  const [b, setB] = useState<BorradorCliente>(VACIO);
  const [cargando, setCargando] = useState(Boolean(editandoId));
  const [guardando, setGuardando] = useState(false);
  const set = <K extends keyof BorradorCliente>(k: K, v: BorradorCliente[K]) => setB((p) => ({ ...p, [k]: v }));

  useEffect(() => {
    if (!editandoId) return;
    obtenerCliente(editandoId)
      .then((c) =>
        setB({
          nombre: c.nombre,
          rut: c.rut ?? "",
          direccion: c.direccion,
          comuna: c.comuna ?? "",
          telefono: c.telefono ?? "",
          correo: c.correo ?? "",
          notas: c.notas ?? "",
          contacto_nombre: c.contacto_nombre ?? "",
        })
      )
      .catch((e) => Alert.alert("No se pudo cargar", e instanceof Error ? e.message : "Intenta de nuevo"))
      .finally(() => setCargando(false));
  }, [editandoId]);

  async function guardar() {
    if (!b.nombre.trim()) return Alert.alert("Falta el nombre", "Escribe el nombre del cliente.");
    if (!b.direccion.trim()) return Alert.alert("Falta la dirección", "La dirección es obligatoria.");
    if (!enLinea) return Alert.alert("Sin conexión", "Necesitas conexión para guardar un cliente.");

    setGuardando(true);
    const r = editandoId ? await editarCliente(editandoId, b) : await crearCliente(b);
    setGuardando(false);
    if (!r.ok) return Alert.alert("No se pudo guardar", r.error);
    Alert.alert(editandoId ? "Cliente actualizado" : "Cliente creado", "Listo.", [
      { text: "Listo", onPress: () => navigation.goBack() },
    ]);
  }

  const titulo = editandoId ? "Editar cliente" : "Nuevo cliente";
  const volver = { icono: <ArrowLeft size={20} strokeWidth={2.5} color={tokens.color.text} />, onPress: () => navigation.goBack(), etiquetaAccesible: "Volver" };

  if (cargando) {
    return (
      <View style={{ flex: 1, backgroundColor: tokens.color.bg }}>
        <ScreenHeader titulo={titulo} accion={volver} />
        <View style={{ padding: tokens.space["4"] }}>
          <LoadingState />
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: tokens.color.bg }}>
      <ScreenHeader titulo={titulo} accion={volver} />
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={{ padding: tokens.space["6"], gap: tokens.space["4"], paddingBottom: tokens.space["8"] * 2 }}
          keyboardShouldPersistTaps="handled"
        >
          <Input etiqueta="Nombre" valor={b.nombre} onCambio={(v) => set("nombre", v)} />
          <Input etiqueta="Persona de contacto (opcional)" valor={b.contacto_nombre} onCambio={(v) => set("contacto_nombre", v)} />
          <Input etiqueta="RUT (opcional)" valor={b.rut} onCambio={(v) => set("rut", v)} autoCapitalizar={false} />
          <Input etiqueta="Dirección" valor={b.direccion} onCambio={(v) => set("direccion", v)} />
          <Input etiqueta="Comuna (opcional)" valor={b.comuna} onCambio={(v) => set("comuna", v)} />
          <Input etiqueta="Teléfono (opcional)" tipo="tel" valor={b.telefono} onCambio={(v) => set("telefono", v)} />
          <Input etiqueta="Correo (opcional)" tipo="email" autoCapitalizar={false} valor={b.correo} onCambio={(v) => set("correo", v)} />
          <Textarea etiqueta="Notas (opcional)" valor={b.notas} onCambio={(v) => set("notas", v)} />

          <Button bloque tamano="lg" onPress={guardar} cargando={guardando}>
            {editandoId ? "Guardar cambios" : "Crear cliente"}
          </Button>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
