import { useState } from "react";
import { Alert, Image, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { useTema } from "../../../theme";
import { Button, Card, Text } from "../../../components/ui";
import { comprimirImagen } from "../../../lib/imagen";
import type { FotoConUrl } from "../../../services/trabajos";

export function FotosSection({
  fotos,
  editable,
  onAgregar,
}: {
  fotos: FotoConUrl[];
  editable: boolean;
  onAgregar: (archivo: { uri: string; name: string; type: string }) => void;
}) {
  const t = useTema();
  const [ocupado, setOcupado] = useState(false);

  async function procesar(assets: ImagePicker.ImagePickerAsset[]) {
    setOcupado(true);
    try {
      for (const a of assets) {
        const uri = await comprimirImagen(a.uri, a.width);
        onAgregar({ uri, name: a.fileName ?? `foto-${Date.now()}.jpg`, type: a.mimeType ?? "image/jpeg" });
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

  return (
    <View style={{ gap: t.espacio(3) }}>
      <Text variante="etiqueta" tono="muted" weight="semibold" style={{ textTransform: "uppercase" }}>
        Fotos
      </Text>
      {editable && (
        <View style={{ flexDirection: "row", gap: t.espacio(2.5) }}>
          <Button titulo="Tomar foto" onPress={camara} cargando={ocupado} />
          <Button titulo="Galería" variante="secundario" onPress={galeria} cargando={ocupado} />
        </View>
      )}
      {fotos.map((f) => (
        <Card key={f.id} plano>
          <Image source={{ uri: f.url }} style={{ width: "100%", height: 200, borderRadius: t.radio.sm, marginBottom: t.espacio(2) }} />
          {f.alerta && f.detalle_alerta ? (
            <Text variante="etiqueta" tono="danger" weight="semibold">
              ⚠ {f.detalle_alerta}
            </Text>
          ) : null}
          {f.resumen ? (
            <Text variante="cuerpo" tono="muted">
              {f.resumen}
            </Text>
          ) : null}
        </Card>
      ))}
    </View>
  );
}
