import { useState } from "react";
import { ActivityIndicator, Alert, Image, Modal, Pressable, ScrollView, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { CATEGORIAS_FOTO_OS, ETIQUETA_CATEGORIA_FOTO_OS, type CategoriaFotoOS } from "@bitacora/shared";
import { useTema } from "../../../theme";
import { Text } from "../../../components/ui";
import { comprimirImagen } from "../../../lib/imagen";
import type { FotoConUrl } from "../../../services/trabajos";

export type FotoPendiente = { id: string; uri: string; fallida: boolean; error?: string };

const MAX = 6;
const LADO = 76;

// La categoría activa se aplica a cada foto nueva hasta que se cambie.
const OPCIONES_CAT: { valor: CategoriaFotoOS | null; texto: string }[] = [
  { valor: null, texto: "General" },
  ...CATEGORIAS_FOTO_OS.map((c) => ({ valor: c, texto: ETIQUETA_CATEGORIA_FOTO_OS[c] })),
];

export function FotosSection({
  fotos,
  pendientes = [],
  editable,
  onAgregar,
  onQuitarPendiente,
}: {
  fotos: FotoConUrl[];
  pendientes?: FotoPendiente[];
  editable: boolean;
  onAgregar: (archivo: { uri: string; name: string; type: string }, categoria: CategoriaFotoOS | null) => void;
  onQuitarPendiente?: (id: string) => void;
}) {
  const t = useTema();
  const [ocupado, setOcupado] = useState(false);
  const [abierta, setAbierta] = useState<FotoConUrl | null>(null);
  const [categoria, setCategoria] = useState<CategoriaFotoOS | null>(null);

  async function procesar(assets: ImagePicker.ImagePickerAsset[]) {
    setOcupado(true);
    try {
      for (const a of assets) {
        const uri = await comprimirImagen(a.uri, a.width);
        onAgregar({ uri, name: a.fileName ?? `foto-${Date.now()}.jpg`, type: a.mimeType ?? "image/jpeg" }, categoria);
      }
    } finally {
      setOcupado(false);
    }
  }

  async function camara() {
    const permiso = await ImagePicker.requestCameraPermissionsAsync();
    if (!permiso.granted) return Alert.alert("Permiso necesario", "Necesitamos la cámara para continuar.");
    const r = await ImagePicker.launchCameraAsync({ quality: 0.8 });
    if (!r.canceled) await procesar(r.assets);
  }

  async function galeria() {
    const permiso = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permiso.granted) return Alert.alert("Permiso necesario", "Necesitamos acceso a tus fotos.");
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.8, allowsMultipleSelection: true });
    if (!r.canceled) await procesar(r.assets);
  }

  function agregar() {
    Alert.alert("Agregar foto", undefined, [
      { text: "Tomar foto", onPress: () => void camara() },
      { text: "Elegir de galería", onPress: () => void galeria() },
      { text: "Cancelar", style: "cancel" },
    ]);
  }

  const total = fotos.length + pendientes.length;
  const alertas = fotos.filter((f) => f.alerta && f.detalle_alerta);

  const cuadro = { width: LADO, height: LADO, borderRadius: t.radio.sm, backgroundColor: t.colores.surfaceAlt } as const;

  return (
    <View style={{ gap: t.espacio(2.5) }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <Text variante="etiqueta" tono="muted" weight="semibold" style={{ textTransform: "uppercase" }}>
          Fotos
        </Text>
        <Text mono variante="caption" tono="faint">
          {total} de {MAX}
        </Text>
      </View>

      {editable && total < MAX ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: t.espacio(1.5) }}>
          {OPCIONES_CAT.map((o) => {
            const sel = categoria === o.valor;
            return (
              <Pressable
                key={o.texto}
                onPress={() => setCategoria(o.valor)}
                style={{
                  minHeight: 32,
                  paddingHorizontal: t.espacio(2.5),
                  borderRadius: 999,
                  borderWidth: 1,
                  borderColor: sel ? t.colores.brand : t.colores.border,
                  backgroundColor: sel ? t.colores.brandSoft : t.colores.surface,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Text variante="caption" weight={sel ? "bold" : "medium"} style={{ color: sel ? t.colores.brand : t.colores.muted }}>
                  {o.texto}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      ) : null}

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: t.espacio(2) }}>
        {pendientes.map((p) => (
          <Pressable key={p.id} onLongPress={() => onQuitarPendiente?.(p.id)}>
            <View style={[cuadro, { overflow: "hidden", borderWidth: 1, borderColor: t.colores.border }]}>
              {p.uri ? <Image source={{ uri: p.uri }} style={{ width: "100%", height: "100%", opacity: 0.6 }} /> : null}
              <View style={{ position: "absolute", right: 3, top: 3 }}>
                {p.fallida ? (
                  <Ionicons name="alert-circle" size={16} color={t.colores.danger} />
                ) : (
                  <Ionicons name="sync" size={15} color={t.colores.accent} />
                )}
              </View>
            </View>
          </Pressable>
        ))}
        {fotos.map((f) => (
          <Pressable key={f.id} onPress={() => setAbierta(f)}>
            <View style={[cuadro, { overflow: "hidden", borderWidth: 1, borderColor: t.colores.border }]}>
              <Image source={{ uri: f.url }} style={{ width: "100%", height: "100%" }} />
              {f.estado === "procesando" ? (
                <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.4)" }}>
                  <ActivityIndicator size="small" color={t.colores.muted} />
                </View>
              ) : null}
              {f.alerta ? (
                <View style={{ position: "absolute", right: 3, top: 3 }}>
                  <Ionicons name="warning" size={15} color={t.colores.danger} />
                </View>
              ) : null}
            </View>
          </Pressable>
        ))}
        {editable && total < MAX ? (
          <Pressable onPress={agregar} disabled={ocupado}>
            <View
              style={[
                cuadro,
                {
                  borderWidth: 1.5,
                  borderStyle: "dashed",
                  borderColor: t.colores.borderStrong,
                  alignItems: "center",
                  justifyContent: "center",
                },
              ]}
            >
              {ocupado ? <ActivityIndicator size="small" color={t.colores.muted} /> : <Ionicons name="camera-outline" size={22} color={t.colores.muted} />}
            </View>
          </Pressable>
        ) : null}
      </ScrollView>

      {total === 0 ? (
        <Text variante="caption" tono="muted">
          Sin fotos todavía.
        </Text>
      ) : null}

      {alertas.map((f) => (
        <Text key={f.id} variante="caption" tono="danger" weight="semibold">
          ⚠ {f.detalle_alerta}
        </Text>
      ))}

      <Modal visible={abierta != null} transparent animationType="fade" onRequestClose={() => setAbierta(null)}>
        <Pressable
          onPress={() => setAbierta(null)}
          style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.85)", alignItems: "center", justifyContent: "center", padding: 16 }}
        >
          {abierta ? (
            <>
              <Image source={{ uri: abierta.url }} resizeMode="contain" style={{ width: "100%", height: "70%" }} />
              {abierta.resumen ? (
                <Text tono="inverso" style={{ marginTop: 12, textAlign: "center" }}>
                  {abierta.resumen}
                </Text>
              ) : null}
            </>
          ) : null}
        </Pressable>
      </Modal>
    </View>
  );
}
