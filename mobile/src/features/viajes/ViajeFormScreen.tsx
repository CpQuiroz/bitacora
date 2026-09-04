import { useEffect, useState } from "react";
import { Alert, Pressable, ScrollView, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { Ionicons } from "@expo/vector-icons";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { Cliente, Equipo } from "@bitacora/shared";
import { useTema } from "../../theme";
import { Button, Card, Input, LoadingScreen, PickerBuscable, Text } from "../../components/ui";
import { SelectorCliente } from "../../components/SelectorCliente";
import { InputMonto } from "../../components/InputMonto";
import { useRed } from "../../services/sync/NetworkProvider";
import { comprimirImagen } from "../../lib/imagen";
import { CIUDADES_CHILE } from "../../lib/ciudadesChile";
import {
  catalogoParaViaje,
  crearViaje,
  editarViaje,
  encolarViaje,
  obtenerViaje,
  type BorradorViaje,
} from "../../services/viajes";
import type { ViajesStackParamList } from "../../shell/navigation/types";

const VACIO: BorradorViaje = {
  cliente_id: "",
  numero_guia: "",
  origen: "",
  destino: "",
  equipo_id: "",
  km_inicial: "",
  km_final: "",
  subtotal: "",
  aplica_iva: true,
};

export function ViajeFormScreen({ navigation, route }: NativeStackScreenProps<ViajesStackParamList, "ViajeForm">) {
  const t = useTema();
  const { enLinea } = useRed();
  const editandoId = route.params?.viajeId ?? null;
  const [clientes, setClientes] = useState<Cliente[] | null>(null);
  const [equipos, setEquipos] = useState<Equipo[]>([]);
  const [b, setB] = useState<BorradorViaje>(VACIO);
  const [foto, setFoto] = useState<{ uri: string; name: string; type: string } | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [cargandoViaje, setCargandoViaje] = useState(Boolean(editandoId));

  useEffect(() => {
    navigation.setOptions({ title: editandoId ? "Editar viaje" : "Nuevo viaje" });
  }, [navigation, editandoId]);

  useEffect(() => {
    catalogoParaViaje().then(({ clientes, equipos }) => {
      setClientes(clientes.filter((c) => c.activo));
      setEquipos(equipos.filter((e) => e.activo));
    });
  }, []);

  useEffect(() => {
    if (!editandoId) return;
    obtenerViaje(editandoId)
      .then(({ viaje }) => {
        setB({
          cliente_id: viaje.cliente_id ?? "",
          numero_guia: viaje.numero_guia,
          origen: viaje.origen,
          destino: viaje.destino,
          equipo_id: viaje.equipo_id ?? "",
          km_inicial: viaje.km_inicial != null ? String(viaje.km_inicial) : "",
          km_final: viaje.km_final != null ? String(viaje.km_final) : "",
          subtotal: String(Math.round(viaje.subtotal)),
          aplica_iva: viaje.aplica_iva,
        });
      })
      .catch((e) => Alert.alert("No se pudo cargar el viaje", e instanceof Error ? e.message : "Intenta de nuevo"))
      .finally(() => setCargandoViaje(false));
  }, [editandoId]);

  const set = (k: keyof BorradorViaje, v: string | boolean) => setB((prev) => ({ ...prev, [k]: v }));

  async function adjuntarFoto() {
    const permiso = await ImagePicker.requestCameraPermissionsAsync();
    if (!permiso.granted) return Alert.alert("Permiso necesario", "Necesitamos la cámara para la foto de la guía.");
    const r = await ImagePicker.launchCameraAsync({ quality: 0.8 });
    if (r.canceled) return;
    const a = r.assets[0];
    const uri = await comprimirImagen(a.uri, a.width);
    setFoto({ uri, name: a.fileName ?? `guia-${Date.now()}.jpg`, type: a.mimeType ?? "image/jpeg" });
  }

  async function guardar() {
    if (!b.cliente_id) return Alert.alert("Falta el cliente", "Elige un cliente.");
    if (!b.numero_guia.trim()) return Alert.alert("Falta la guía", "Ingresa el número de guía.");
    if (!b.origen.trim() || !b.destino.trim()) return Alert.alert("Falta la ruta", "Completa el origen y el destino.");
    if (!(Number(b.subtotal.replace(/\D/g, "")) > 0)) return Alert.alert("Falta el monto", "Ingresa el monto del viaje.");
    const ki = Number(b.km_inicial),
      kf = Number(b.km_final);
    if (b.km_inicial && b.km_final && kf < ki) {
      return Alert.alert("Revisa los kilómetros", "El km final no puede ser menor que el inicial.");
    }

    const borrador = { ...b, subtotal: b.subtotal.replace(/\D/g, "") };
    const volver = () => navigation.goBack();
    setGuardando(true);

    if (editandoId) {
      if (!enLinea) {
        setGuardando(false);
        return Alert.alert("Sin conexión", "Necesitas conexión para editar un viaje.");
      }
      const r = await editarViaje(editandoId, {
        numero_guia: borrador.numero_guia,
        origen: borrador.origen,
        destino: borrador.destino,
        cliente_id: borrador.cliente_id,
        km_inicial: borrador.km_inicial,
        km_final: borrador.km_final,
        subtotal: borrador.subtotal,
        aplica_iva: borrador.aplica_iva,
      });
      setGuardando(false);
      if (!r.ok) return Alert.alert("No se pudo guardar", r.error);
      Alert.alert("Viaje actualizado", "Listo.", [{ text: "Listo", onPress: volver }]);
      return;
    }

    if (enLinea) {
      const r = await crearViaje(borrador, foto ?? undefined);
      if (r.ok) {
        setGuardando(false);
        Alert.alert(
          "Viaje registrado",
          r.fotoPendiente
            ? "Llegó a la oficina. La foto de la guía se está subiendo y se reintenta sola si falla."
            : "Llegó a la oficina. Queda pendiente de aprobación.",
          [{ text: "Listo", onPress: volver }]
        );
        return;
      }
      if (!r.reintentable) {
        setGuardando(false);
        Alert.alert("No se pudo registrar", r.error);
        return;
      }
      // Señal inestable o servidor caído: lo guardamos y la cola lo reintenta sola.
      await encolarViaje(borrador, foto ?? undefined);
      setGuardando(false);
      Alert.alert(
        "Se reintentará solo",
        "No se pudo enviar ahora (conexión o servidor). Lo guardamos y se reenvía cuando haya señal — lo ves en la lista de Viajes.",
        [{ text: "Listo", onPress: volver }]
      );
      return;
    }

    await encolarViaje(borrador, foto ?? undefined);
    setGuardando(false);
    Alert.alert("Guardado sin conexión", "Se enviará a la oficina cuando vuelvas a tener señal.", [
      { text: "Listo", onPress: volver },
    ]);
  }

  if (clientes === null || cargandoViaje) return <LoadingScreen />;

  return (
    <View style={{ flex: 1, backgroundColor: t.colores.bg }}>
      <ScrollView
        contentContainerStyle={{ padding: t.espacio(5), gap: t.espacio(4), paddingBottom: t.espacio(8) }}
        keyboardShouldPersistTaps="handled"
      >
      <SelectorCliente
        valor={b.cliente_id}
        onElegir={(id) => set("cliente_id", id)}
        clientes={clientes}
        onClienteCreado={(c) => setClientes((prev) => [...(prev ?? []), c])}
      />

      <Input etiqueta="Número de guía" value={b.numero_guia} onChangeText={(v) => set("numero_guia", v)} />

      {!editandoId ? (
        <Card plano>
          <Text variante="etiqueta" tono="muted" style={{ marginBottom: t.espacio(2) }}>
            Foto de la guía
          </Text>
          <Button
            titulo={foto ? "Cambiar foto ✓" : "Tomar foto de la guía"}
            variante={foto ? "secundario" : "primario"}
            onPress={adjuntarFoto}
          />
        </Card>
      ) : null}

      <PickerBuscable
        etiqueta="Origen"
        placeholder="Elegir ciudad de origen"
        valor={b.origen}
        opciones={CIUDADES_CHILE.map((c) => ({ id: c, label: c }))}
        onElegir={(v) => set("origen", v)}
        permitirLibre
        textoLibre={(texto) => `Usar "${texto}" (no está en la lista)`}
      />
      <PickerBuscable
        etiqueta="Destino"
        placeholder="Elegir ciudad de destino"
        valor={b.destino}
        opciones={CIUDADES_CHILE.map((c) => ({ id: c, label: c }))}
        onElegir={(v) => set("destino", v)}
        permitirLibre
        textoLibre={(texto) => `Usar "${texto}" (no está en la lista)`}
      />

      {equipos.length > 0 ? (
        <PickerBuscable
          etiqueta="Vehículo (opcional)"
          valor={b.equipo_id ?? ""}
          opcionVacia="Ninguno"
          opciones={equipos.map((e) => ({ id: e.id, label: e.nombre, sublabel: e.patente ?? undefined }))}
          onElegir={(id) => set("equipo_id", id)}
        />
      ) : null}

      <View style={{ flexDirection: "row", gap: t.espacio(3) }}>
        <View style={{ flex: 1 }}>
          <Input etiqueta="Km inicial" keyboardType="numeric" value={b.km_inicial} onChangeText={(v) => set("km_inicial", v)} />
        </View>
        <View style={{ flex: 1 }}>
          <Input etiqueta="Km final" keyboardType="numeric" value={b.km_final} onChangeText={(v) => set("km_final", v)} />
        </View>
      </View>

      <InputMonto etiqueta="Monto del viaje (sin IVA)" valor={b.subtotal} onChangeText={(v) => set("subtotal", v)} />

      <Pressable
        onPress={() => set("aplica_iva", !b.aplica_iva)}
        hitSlop={8}
        style={({ pressed }) => ({
          flexDirection: "row",
          alignItems: "center",
          gap: t.espacio(2.5),
          minHeight: 44,
          opacity: pressed ? 0.7 : 1,
        })}
      >
        <Ionicons
          name={b.aplica_iva ? "checkbox" : "square-outline"}
          size={24}
          color={b.aplica_iva ? t.colores.brand : t.colores.muted}
        />
        <Text variante="cuerpo">Aplicar IVA (19%)</Text>
      </Pressable>
      </ScrollView>

      <View
        style={{
          padding: t.espacio(4),
          paddingBottom: t.espacio(6),
          borderTopWidth: 1,
          borderTopColor: t.colores.border,
          backgroundColor: t.colores.surface,
        }}
      >
        <Button titulo={editandoId ? "Guardar cambios" : "Registrar viaje"} tamano="lg" onPress={guardar} cargando={guardando} />
      </View>
    </View>
  );
}
