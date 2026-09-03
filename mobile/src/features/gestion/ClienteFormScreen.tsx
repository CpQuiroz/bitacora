import { useEffect, useState } from "react";
import { Alert, ScrollView } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useTema } from "../../theme";
import { Button, Input, LoadingScreen } from "../../components/ui";
import { useRed } from "../../services/sync/NetworkProvider";
import { crearCliente, editarCliente, obtenerCliente, type BorradorCliente } from "../../services/clientes";
import type { GestionStackParamList } from "../../shell/navigation/types";

const VACIO: BorradorCliente = { nombre: "", rut: "", direccion: "", comuna: "", telefono: "", correo: "" , notas: "" };

export function ClienteFormScreen({ navigation, route }: NativeStackScreenProps<GestionStackParamList, "ClienteForm">) {
  const t = useTema();
  const { enLinea } = useRed();
  const editandoId = route.params?.clienteId ?? null;

  const [b, setB] = useState<BorradorCliente>(VACIO);
  const [cargando, setCargando] = useState(Boolean(editandoId));
  const [guardando, setGuardando] = useState(false);
  const set = <K extends keyof BorradorCliente>(k: K, v: BorradorCliente[K]) => setB((p) => ({ ...p, [k]: v }));

  useEffect(() => {
    navigation.setOptions({ title: editandoId ? "Editar cliente" : "Nuevo cliente" });
  }, [navigation, editandoId]);

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

  if (cargando) return <LoadingScreen />;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: t.colores.bg }}
      contentContainerStyle={{ padding: t.espacio(5), gap: t.espacio(4), paddingBottom: t.espacio(12) }}
      keyboardShouldPersistTaps="handled"
    >
      <Input etiqueta="Nombre" value={b.nombre} onChangeText={(v) => set("nombre", v)} />
      <Input etiqueta="RUT (opcional)" value={b.rut} onChangeText={(v) => set("rut", v)} autoCapitalize="characters" />
      <Input etiqueta="Dirección" value={b.direccion} onChangeText={(v) => set("direccion", v)} />
      <Input etiqueta="Comuna (opcional)" value={b.comuna} onChangeText={(v) => set("comuna", v)} />
      <Input etiqueta="Teléfono (opcional)" keyboardType="phone-pad" value={b.telefono} onChangeText={(v) => set("telefono", v)} />
      <Input etiqueta="Correo (opcional)" keyboardType="email-address" autoCapitalize="none" value={b.correo} onChangeText={(v) => set("correo", v)} />
      <Input etiqueta="Notas (opcional)" multiline value={b.notas} onChangeText={(v) => set("notas", v)} />

      <Button
        titulo={editandoId ? "Guardar cambios" : "Crear cliente"}
        tamano="lg"
        onPress={guardar}
        cargando={guardando}
        style={{ marginTop: t.espacio(2) }}
      />
    </ScrollView>
  );
}
