import { useEffect, useState } from "react";
import { Alert, ScrollView, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { Cliente, Equipo } from "@bitacora/shared";
import { useTema } from "../../theme";
import { Button, Card, Input, LoadingScreen, Text } from "../../components/ui";
import { comprimirImagen } from "../../lib/imagen";
import { catalogoParaViaje, encolarViaje, type BorradorViaje } from "../../services/viajes";
import type { ViajesStackParamList } from "../../app/navigation/types";

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

function Selector<T extends { id: string }>({
  etiqueta,
  opciones,
  valor,
  onElegir,
  render,
}: {
  etiqueta: string;
  opciones: T[];
  valor: string;
  onElegir: (id: string) => void;
  render: (o: T) => string;
}) {
  const t = useTema();
  return (
    <View style={{ gap: t.espacio(1.5) }}>
      <Text variante="etiqueta" tono="muted">
        {etiqueta}
      </Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: t.espacio(2) }}>
        {opciones.map((o) => {
          const activo = o.id === valor;
          return (
            <Text
              key={o.id}
              variante="etiqueta"
              onPress={() => onElegir(o.id)}
              style={{
                color: activo ? t.colores.brand : t.colores.foreground,
                backgroundColor: activo ? t.colores.brandSoft : t.colores.surface,
                borderWidth: 1,
                borderColor: activo ? t.colores.brand : t.colores.border,
                paddingHorizontal: t.espacio(3),
                paddingVertical: t.espacio(2),
                borderRadius: t.radio.full,
                overflow: "hidden",
              }}
            >
              {render(o)}
            </Text>
          );
        })}
      </View>
    </View>
  );
}

export function ViajeFormScreen({ navigation }: NativeStackScreenProps<ViajesStackParamList, "ViajeForm">) {
  const t = useTema();
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
    if (!b.cliente_id) return Alert.alert("Falta el cliente", "Elegí un cliente.");
    if (!b.numero_guia.trim()) return Alert.alert("Falta la guía", "Ingresá el número de guía.");
    if (!b.origen.trim() || !b.destino.trim()) return Alert.alert("Falta la ruta", "Completá origen y destino.");
    if (!(Number(b.subtotal.replace(/\D/g, "")) > 0)) return Alert.alert("Falta el monto", "Ingresá el monto del viaje.");

    setGuardando(true);
    await encolarViaje({ ...b, subtotal: b.subtotal.replace(/\D/g, "") }, foto ?? undefined);
    setGuardando(false);
    Alert.alert("Listo", "El viaje quedó registrado como borrador. La oficina lo revisa.", [
      { text: "OK", onPress: () => navigation.goBack() },
    ]);
  }

  if (clientes === null) return <LoadingScreen />;

  return (
    <ScrollView style={{ flex: 1, backgroundColor: t.colores.bg }} contentContainerStyle={{ padding: t.espacio(5), gap: t.espacio(4) }}>
      <Selector etiqueta="Cliente" opciones={clientes} valor={b.cliente_id} onElegir={(id) => set("cliente_id", id)} render={(c) => c.nombre} />
      <Input etiqueta="Número de guía" value={b.numero_guia} onChangeText={(v) => set("numero_guia", v)} />

      <Card plano>
        <Text variante="etiqueta" tono="muted" style={{ marginBottom: t.espacio(2) }}>
          Foto de la guía
        </Text>
        <Button titulo={foto ? "Cambiar foto ✓" : "Tomar foto de la guía"} variante={foto ? "secundario" : "primario"} onPress={adjuntarFoto} />
      </Card>

      <Input etiqueta="Origen" value={b.origen} onChangeText={(v) => set("origen", v)} />
      <Input etiqueta="Destino" value={b.destino} onChangeText={(v) => set("destino", v)} />

      {equipos.length > 0 ? (
        <Selector
          etiqueta="Vehículo (opcional)"
          opciones={[{ id: "" } as Equipo, ...equipos]}
          valor={b.equipo_id ?? ""}
          onElegir={(id) => set("equipo_id", id)}
          render={(e) => (e.id ? `${e.nombre}${e.patente ? ` (${e.patente})` : ""}` : "Ninguno")}
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
      <Text variante="etiqueta" tono="brand" weight="semibold" onPress={() => set("aplica_iva", !b.aplica_iva)}>
        {b.aplica_iva ? "☑" : "☐"} Aplicar IVA (19%)
      </Text>

      <Button titulo="Registrar viaje" tamano="lg" onPress={guardar} cargando={guardando} />
    </ScrollView>
  );
}
