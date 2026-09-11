import { useState } from "react";
import { ActivityIndicator, Alert, Image, Modal, Pressable, ScrollView, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { AlertCircle, AlertTriangle, Camera, RefreshCw } from "lucide-react-native";
import { CATEGORIAS_FOTO_OS, ETIQUETA_CATEGORIA_FOTO_OS, type CategoriaFotoOS } from "@bitacora/shared";
import { tokens } from "@bitacora/design-tokens";
import { Texto, useMarca } from "@bitacora/ui/native";
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

// PASO 6 (sistema de diseño) — migrado. Ver docs/design-system.md.
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
  const marca = useMarca();
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

  const cuadro = { width: LADO, height: LADO, borderRadius: tokens.radius.md, backgroundColor: tokens.color.neutral["200"] } as const;

  return (
    <View style={{ gap: tokens.space["3"] }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <Texto tamano={tokens.size.small} color={`${tokens.color.text}99`} peso="semibold" style={{ textTransform: "uppercase" }}>
          Fotos
        </Texto>
        <Texto tamano={tokens.size.caption} color={`${tokens.color.text}66`} style={{ fontVariant: ["tabular-nums"] }}>
          {total} de {MAX}
        </Texto>
      </View>

      {editable && total < MAX ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: tokens.space["2"] }}>
          {OPCIONES_CAT.map((o) => {
            const sel = categoria === o.valor;
            return (
              <Pressable
                key={o.texto}
                onPress={() => setCategoria(o.valor)}
                style={{
                  minHeight: 32,
                  paddingHorizontal: tokens.space["3"],
                  borderRadius: tokens.radius.pill,
                  borderWidth: 1,
                  borderColor: sel ? marca.base : tokens.color.divider,
                  backgroundColor: sel ? `${marca.base}1f` : tokens.color.surface,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Texto tamano={tokens.size.caption} color={sel ? marca.base : `${tokens.color.text}99`} peso={sel ? "semibold" : "medium"}>
                  {o.texto}
                </Texto>
              </Pressable>
            );
          })}
        </ScrollView>
      ) : null}

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: tokens.space["2"] }}>
        {pendientes.map((p) => (
          <Pressable key={p.id} onLongPress={() => onQuitarPendiente?.(p.id)}>
            <View style={[cuadro, { overflow: "hidden", borderWidth: 1, borderColor: tokens.color.divider }]}>
              {p.uri ? <Image source={{ uri: p.uri }} style={{ width: "100%", height: "100%", opacity: 0.6 }} /> : null}
              <View style={{ position: "absolute", right: 3, top: 3 }}>
                {p.fallida ? (
                  <AlertCircle size={16} strokeWidth={2.75} color={tokens.color.accentRamp["700"]} />
                ) : (
                  <RefreshCw size={15} strokeWidth={2.75} color={marca.base} />
                )}
              </View>
            </View>
          </Pressable>
        ))}
        {fotos.map((f) => (
          <Pressable key={f.id} onPress={() => setAbierta(f)}>
            <View style={[cuadro, { overflow: "hidden", borderWidth: 1, borderColor: tokens.color.divider }]}>
              <Image source={{ uri: f.url }} style={{ width: "100%", height: "100%" }} />
              {f.estado === "procesando" ? (
                <View
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: "rgba(255,255,255,0.4)",
                  }}
                >
                  <ActivityIndicator size="small" color={`${tokens.color.text}99`} />
                </View>
              ) : null}
              {f.alerta ? (
                <View style={{ position: "absolute", right: 3, top: 3 }}>
                  <AlertTriangle size={15} strokeWidth={2.75} color={tokens.color.accentRamp["700"]} />
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
                  backgroundColor: tokens.color.surface,
                  borderWidth: 1.5,
                  borderStyle: "dashed",
                  borderColor: tokens.color.divider,
                  alignItems: "center",
                  justifyContent: "center",
                },
              ]}
            >
              {ocupado ? (
                <ActivityIndicator size="small" color={`${tokens.color.text}99`} />
              ) : (
                <Camera size={22} strokeWidth={2.75} color={`${tokens.color.text}99`} />
              )}
            </View>
          </Pressable>
        ) : null}
      </ScrollView>

      {total === 0 ? (
        <Texto tamano={tokens.size.caption} color={`${tokens.color.text}99`}>
          Sin fotos todavía.
        </Texto>
      ) : null}

      {alertas.map((f) => (
        <Texto key={f.id} tamano={tokens.size.caption} color={tokens.color.accentRamp["700"]} peso="semibold">
          ⚠ {f.detalle_alerta}
        </Texto>
      ))}

      <Modal visible={abierta != null} transparent animationType="fade" onRequestClose={() => setAbierta(null)}>
        <Pressable
          onPress={() => setAbierta(null)}
          style={{ flex: 1, backgroundColor: `${tokens.color.neutral["900"]}d9`, alignItems: "center", justifyContent: "center", padding: 16 }}
        >
          {abierta ? (
            <>
              <Image source={{ uri: abierta.url }} resizeMode="contain" style={{ width: "100%", height: "70%" }} />
              {abierta.resumen ? (
                <Texto tamano={tokens.size.body} color={tokens.color.neutral["100"]} style={{ marginTop: 12, textAlign: "center" }}>
                  {abierta.resumen}
                </Texto>
              ) : null}
            </>
          ) : null}
        </Pressable>
      </Modal>
    </View>
  );
}
