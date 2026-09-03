import { useState } from "react";
import { ActivityIndicator, Alert, Image, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { useTema } from "../../../theme";
import { Button, Card, Text } from "../../../components/ui";
import { comprimirImagen } from "../../../lib/imagen";
import type { FotoConUrl } from "../../../services/trabajos";

export type FotoPendiente = { id: string; uri: string; fallida: boolean; error?: string };

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
  onAgregar: (archivo: { uri: string; name: string; type: string }) => void;
  onQuitarPendiente?: (id: string) => void;
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

      {pendientes.map((p) => (
        <Card key={p.id} plano>
          {p.uri ? (
            <Image source={{ uri: p.uri }} style={{ width: "100%", height: 200, borderRadius: t.radio.sm }} />
          ) : null}
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: t.espacio(2), marginTop: t.espacio(2) }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: t.espacio(2), flex: 1 }}>
              {p.fallida ? (
                <Text variante="caption" tono="danger">
                  No se pudo subir{p.error ? `: ${p.error}` : ""}
                </Text>
              ) : (
                <>
                  <ActivityIndicator size="small" color={t.colores.muted} />
                  <Text variante="caption" tono="muted">
                    Subiendo… (se reintenta solo)
                  </Text>
                </>
              )}
            </View>
            {onQuitarPendiente ? (
              <Button titulo="Quitar" variante="ghost" onPress={() => onQuitarPendiente(p.id)} />
            ) : null}
          </View>
        </Card>
      ))}

      {fotos.map((f) => (
        <Card key={f.id} plano>
          <Image source={{ uri: f.url }} style={{ width: "100%", height: 200, borderRadius: t.radio.sm, marginBottom: t.espacio(2) }} />
          {f.alerta && f.detalle_alerta ? (
            <Text variante="etiqueta" tono="danger" weight="semibold">
              ⚠ {f.detalle_alerta}
            </Text>
          ) : null}
          {f.estado === "procesando" ? (
            <View style={{ flexDirection: "row", alignItems: "center", gap: t.espacio(2) }}>
              <ActivityIndicator size="small" color={t.colores.muted} />
              <Text variante="cuerpo" tono="muted">
                Analizando la foto…
              </Text>
            </View>
          ) : f.estado === "error" ? (
            <Text variante="cuerpo" tono="muted">
              No se pudo analizar automáticamente.
            </Text>
          ) : f.resumen ? (
            <Text variante="cuerpo" tono="muted">
              {f.resumen}
            </Text>
          ) : null}
        </Card>
      ))}

      {fotos.length === 0 && pendientes.length === 0 ? (
        <Text variante="caption" tono="muted">
          Sin fotos todavía.
        </Text>
      ) : null}
    </View>
  );
}
