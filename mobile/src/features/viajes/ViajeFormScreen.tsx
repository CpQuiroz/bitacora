import { useEffect, useState } from "react";
import { Alert, Pressable, ScrollView, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { Ionicons } from "@expo/vector-icons";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { Cliente, Equipo } from "@bitacora/shared";
import { useTema } from "../../theme";
import { Button, Card, Input, LoadingScreen, PickerBuscable, Text } from "../../components/ui";
import { useRed } from "../../services/sync/NetworkProvider";
import { comprimirImagen } from "../../lib/imagen";
import { catalogoParaViaje, encolarViaje, type BorradorViaje } from "../../services/viajes";
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

export function ViajeFormScreen({ navigation }: NativeStackScreenProps<ViajesStackParamList, "ViajeForm">) {
  const t = useTema();
  const { enLinea } = useRed();
  const [clientes, setClientes] = useState<Cliente[] | null>(null);
  const [equipos, setEquipos] = useState<Equipo[]>([]);
  const [b, setB] = useState<BorradorViaje>(VACIO);
  const [foto, setFoto] = useState<{ uri: string; name: string; type: string } | null>(null);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    catalogoParaViaje().then(({ clientes, equipos }) => {
      setClientes(clientes.filter((c) => c.activo));
      setEquipos(equipos.filter((e) => e.activo));
    });
  }, []);

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

    setGuardando(true);
    await encolarViaje({ ...b, subtotal: b.subtotal.replace(/\D/g, "") }, foto ?? undefined);
    setGuardando(false);
    Alert.alert(
      "Viaje registrado",
      enLinea
        ? "Quedó como borrador. La oficina lo revisa."
        : "Quedó guardado. Se enviará a la oficina cuando vuelvas a tener señal.",
      [{ text: "Listo", onPress: () => navigation.goBack() }]
    );
  }

  if (clientes === null) return <LoadingScreen />;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: t.colores.bg }}
      contentContainerStyle={{ padding: t.espacio(5), gap: t.espacio(4), paddingBottom: t.espacio(10) }}
      keyboardShouldPersistTaps="handled"
    >
      <PickerBuscable
        etiqueta="Cliente"
        placeholder="Elegir cliente"
        valor={b.cliente_id}
        opciones={clientes.map((c) => ({ id: c.id, label: c.nombre }))}
        onElegir={(id) => set("cliente_id", id)}
      />

      <Input etiqueta="Número de guía" value={b.numero_guia} onChangeText={(v) => set("numero_guia", v)} />

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

      <Input etiqueta="Origen" value={b.origen} onChangeText={(v) => set("origen", v)} />
      <Input etiqueta="Destino" value={b.destino} onChangeText={(v) => set("destino", v)} />

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

      <Input etiqueta="Monto del viaje (sin IVA)" keyboardType="numeric" value={b.subtotal} onChangeText={(v) => set("subtotal", v)} />

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

      <Button titulo="Registrar viaje" tamano="lg" onPress={guardar} cargando={guardando} style={{ marginTop: t.espacio(2) }} />
    </ScrollView>
  );
}
