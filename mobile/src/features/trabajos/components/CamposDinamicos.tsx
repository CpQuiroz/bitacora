import { useState } from "react";
import { ActivityIndicator, Alert, Image, Pressable, ScrollView, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { Camera, RefreshCw, AlertCircle } from "lucide-react-native";
import type { CampoTipoTrabajo } from "@bitacora/shared";
import { tokens } from "@bitacora/design-tokens";
import { Button, Input, Texto } from "@bitacora/ui/native";
import { comprimirImagen } from "../../../lib/imagen";
import type { FotoConUrl } from "../../../services/trabajos";
import type { FotoPendiente } from "./FotosSection";

const LADO = 72;

// Foto de un campo puntual del formulario (migración 105) — mini
// galería sin selector de categoría (la categoría ES el campo), mismo
// mecanismo de cámara/galería/compresión que FotosSection.tsx pero
// sin duplicar su UI completa (esta es más chica: 1 campo, no toda la OS).
function CampoFoto({
  etiqueta,
  fotos,
  pendientes,
  editable,
  onAgregar,
  onQuitarPendiente,
  onEliminar,
}: {
  etiqueta: string;
  fotos: FotoConUrl[];
  pendientes: FotoPendiente[];
  editable: boolean;
  onAgregar: (archivo: { uri: string; name: string; type: string }) => void;
  onQuitarPendiente?: (id: string) => void;
  onEliminar?: (fotoId: string) => Promise<void> | void;
}) {
  const [ocupado, setOcupado] = useState(false);
  const total = fotos.length + pendientes.length;
  const cuadro = { width: LADO, height: LADO, borderRadius: tokens.radius.md, backgroundColor: tokens.color.neutral["200"] } as const;

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

  function agregar() {
    Alert.alert("Agregar foto", undefined, [
      { text: "Tomar foto", onPress: () => void camara() },
      { text: "Elegir de galería", onPress: () => void galeria() },
      { text: "Cancelar", style: "cancel" },
    ]);
  }

  function confirmarEliminar(fotoId: string) {
    if (!onEliminar) return;
    Alert.alert("Eliminar foto", "¿Eliminar esta foto?", [
      { text: "Cancelar", style: "cancel" },
      { text: "Eliminar", style: "destructive", onPress: () => void onEliminar(fotoId) },
    ]);
  }

  return (
    <View style={{ gap: tokens.space["2"] }}>
      <Texto tamano={tokens.size.small} color={tokens.color.text}>
        {etiqueta}
      </Texto>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: tokens.space["2"] }}>
        {pendientes.map((p) => (
          <View key={p.id} style={[cuadro, { overflow: "hidden", borderWidth: 1, borderColor: tokens.color.divider }]}>
            {p.uri ? <Image source={{ uri: p.uri }} style={{ width: "100%", height: "100%", opacity: 0.6 }} /> : null}
            <View style={{ position: "absolute", left: 3, bottom: 3 }}>
              {p.fallida ? (
                <AlertCircle size={14} strokeWidth={2.75} color={tokens.color.accentRamp["700"]} />
              ) : (
                <RefreshCw size={13} strokeWidth={2.75} color={tokens.color.accent} />
              )}
            </View>
          </View>
        ))}
        {fotos.map((f) => (
          <Pressable key={f.id} onPress={() => confirmarEliminar(f.id)} disabled={!editable}>
            <View style={[cuadro, { overflow: "hidden", borderWidth: 1, borderColor: tokens.color.divider }]}>
              <Image source={{ uri: f.url }} style={{ width: "100%", height: "100%" }} />
            </View>
          </Pressable>
        ))}
        {editable ? (
          <Pressable onPress={agregar} disabled={ocupado}>
            <View style={[cuadro, { borderWidth: 1.5, borderStyle: "dashed", borderColor: tokens.color.divider, alignItems: "center", justifyContent: "center" }]}>
              {ocupado ? <ActivityIndicator size="small" color={`${tokens.color.text}99`} /> : <Camera size={20} strokeWidth={2.75} color={`${tokens.color.text}99`} />}
            </View>
          </Pressable>
        ) : null}
      </ScrollView>
      {total === 0 && !editable ? (
        <Texto tamano={tokens.size.caption} color={`${tokens.color.text}99`}>
          Sin foto.
        </Texto>
      ) : null}
    </View>
  );
}

// PASO 6 (sistema de diseño) — migrado. Ver docs/design-system.md.
// Campo tipo "foto" (migración 105) — no vive en `valores` (texto),
// requiere fotosPorCampo/fotosPendientesPorCampo + los callbacks de
// foto aparte.
export function CamposDinamicos({
  nombre,
  campos,
  valores,
  onCambiar,
  onGuardar,
  guardando,
  editable,
  fotosPorCampo,
  fotosPendientesPorCampo,
  onAgregarFoto,
  onQuitarFotoPendiente,
  onEliminarFoto,
}: {
  nombre: string;
  campos: CampoTipoTrabajo[];
  valores: Record<string, string>;
  onCambiar: (clave: string, valor: string) => void;
  onGuardar: () => void;
  guardando: boolean;
  editable: boolean;
  fotosPorCampo?: Record<string, FotoConUrl[]>;
  fotosPendientesPorCampo?: Record<string, FotoPendiente[]>;
  onAgregarFoto?: (clave: string, archivo: { uri: string; name: string; type: string }) => void;
  onQuitarFotoPendiente?: (id: string) => void;
  onEliminarFoto?: (fotoId: string) => Promise<void> | void;
}) {
  if (campos.length === 0) return null;

  return (
    <View style={{ gap: tokens.space["3"] }}>
      <Texto tamano={tokens.size.small} color={`${tokens.color.text}99`} peso="semibold" style={{ textTransform: "uppercase" }}>
        {nombre}
      </Texto>
      {campos.map((campo) =>
        campo.tipo === "foto" ? (
          <CampoFoto
            key={campo.clave}
            etiqueta={campo.etiqueta}
            fotos={fotosPorCampo?.[campo.clave] ?? []}
            pendientes={fotosPendientesPorCampo?.[campo.clave] ?? []}
            editable={editable}
            onAgregar={(archivo) => onAgregarFoto?.(campo.clave, archivo)}
            onQuitarPendiente={onQuitarFotoPendiente}
            onEliminar={onEliminarFoto}
          />
        ) : (
          <Input
            key={campo.clave}
            etiqueta={campo.etiqueta}
            deshabilitado={!editable}
            valor={valores[campo.clave] ?? ""}
            onCambio={(v) => onCambiar(campo.clave, v)}
            tipo={campo.tipo === "numero" ? "numero" : "texto"}
          />
        )
      )}
      {editable ? (
        <Button bloque onPress={onGuardar} cargando={guardando}>
          Guardar formulario
        </Button>
      ) : null}
    </View>
  );
}
