import { useCallback, useEffect, useState } from "react";
import * as ImagePicker from "expo-image-picker";
import {
  ActivityIndicator,
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import type { AnalisisFoto, ItemChecklist, OrdenServicio, Trabajo, TipoTrabajo } from "@bitacora/shared";
import { apiFetch } from "../lib/api";

type TrabajoConTipo = Trabajo & { tipo_trabajo: TipoTrabajo | null };
type AnalisisFotoConUrl = AnalisisFoto & { url: string };

export default function TrabajoDetalleScreen({
  trabajoId,
  onVolver,
}: {
  trabajoId: string;
  onVolver: () => void;
}) {
  const [trabajo, setTrabajo] = useState<TrabajoConTipo | null>(null);
  const [orden, setOrden] = useState<OrdenServicio | null>(null);
  const [fotos, setFotos] = useState<AnalisisFotoConUrl[]>([]);
  const [cargando, setCargando] = useState(true);
  const [subiendoFoto, setSubiendoFoto] = useState(false);
  const [datosForm, setDatosForm] = useState<Record<string, string>>({});
  const [guardandoDatos, setGuardandoDatos] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setError(null);
    const [resTrabajo, resOrden, resFotos] = await Promise.all([
      apiFetch(`/api/trabajos/${trabajoId}`),
      apiFetch(`/api/trabajos/${trabajoId}/orden`),
      apiFetch(`/api/trabajos/${trabajoId}/fotos`),
    ]);
    if (!resTrabajo.ok) {
      setError("No se pudo cargar el trabajo");
      setCargando(false);
      return;
    }
    const t: TrabajoConTipo = await resTrabajo.json();
    setTrabajo(t);
    setDatosForm(
      Object.fromEntries(
        Object.entries(t.datos ?? {}).map(([k, v]) => [k, String(v ?? "")])
      )
    );
    setOrden(resOrden.ok ? await resOrden.json() : null);
    setFotos(resFotos.ok ? await resFotos.json() : []);
    setCargando(false);
  }, [trabajoId]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  async function marcar(item: "Check-in" | "Check-out") {
    const res = await apiFetch(`/api/trabajos/${trabajoId}/checklist`, {
      method: "POST",
      body: JSON.stringify({ item }),
    });
    if (!res.ok) {
      Alert.alert("Error", "No se pudo marcar " + item);
      return;
    }
    setOrden(await res.json());
  }

  async function elegirYSubirFoto() {
    const permiso = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permiso.granted) {
      Alert.alert("Permiso necesario", "Necesitamos acceso a tus fotos para continuar.");
      return;
    }
    const resultado = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.7,
    });
    if (resultado.canceled || resultado.assets.length === 0) return;

    const asset = resultado.assets[0];
    const nombre = asset.fileName ?? "foto.jpg";
    const tipo = asset.mimeType ?? "image/jpeg";

    const formData = new FormData();
    // React Native's fetch acepta este objeto {uri,name,type} como parte de archivo.
    formData.append("foto", { uri: asset.uri, name: nombre, type: tipo } as unknown as Blob);

    setSubiendoFoto(true);
    const res = await apiFetch(`/api/trabajos/${trabajoId}/fotos`, {
      method: "POST",
      body: formData,
    });
    setSubiendoFoto(false);

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      Alert.alert("Error", body.error ?? "No se pudo subir la foto");
      return;
    }
    cargar();
  }

  async function guardarDatos() {
    setGuardandoDatos(true);
    const res = await apiFetch(`/api/trabajos/${trabajoId}`, {
      method: "PATCH",
      body: JSON.stringify({ datos: datosForm }),
    });
    setGuardandoDatos(false);
    if (!res.ok) {
      Alert.alert("Error", "No se pudo guardar el formulario");
      return;
    }
    Alert.alert("Listo", "Formulario guardado");
  }

  if (cargando) {
    return (
      <View style={styles.centro}>
        <ActivityIndicator />
      </View>
    );
  }
  if (error || !trabajo) {
    return (
      <View style={styles.centro}>
        <Text style={styles.error}>{error ?? "Trabajo no encontrado"}</Text>
        <TouchableOpacity onPress={onVolver}>
          <Text style={styles.volver}>← Volver</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const checklist: ItemChecklist[] = orden?.checklist ?? [];
  const checkIn = checklist.find((c) => c.item === "Check-in");
  const checkOut = checklist.find((c) => c.item === "Check-out");

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 20, paddingTop: 60 }}>
      <TouchableOpacity onPress={onVolver}>
        <Text style={styles.volver}>← Mis trabajos</Text>
      </TouchableOpacity>

      <Text style={styles.titulo}>{trabajo.cliente}</Text>
      <Text style={styles.subtitulo}>
        {trabajo.fecha} · ${trabajo.monto.toLocaleString("es-CL")} · {trabajo.estado}
      </Text>
      {trabajo.ubicacion && <Text style={styles.subtitulo}>{trabajo.ubicacion}</Text>}

      <Text style={styles.seccion}>Check-in / Check-out</Text>
      <View style={styles.filaBotones}>
        <TouchableOpacity
          style={[styles.boton, checkIn?.hecho && styles.botonHecho]}
          onPress={() => marcar("Check-in")}
          disabled={checkIn?.hecho}
        >
          <Text style={styles.botonTexto}>
            {checkIn?.hecho ? `Check-in ✓ ${checkIn.hora?.slice(11, 16) ?? ""}` : "Marcar check-in"}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.boton, checkOut?.hecho && styles.botonHecho]}
          onPress={() => marcar("Check-out")}
          disabled={checkOut?.hecho}
        >
          <Text style={styles.botonTexto}>
            {checkOut?.hecho ? `Check-out ✓ ${checkOut.hora?.slice(11, 16) ?? ""}` : "Marcar check-out"}
          </Text>
        </TouchableOpacity>
      </View>

      {trabajo.tipo_trabajo && trabajo.tipo_trabajo.campos.length > 0 && (
        <>
          <Text style={styles.seccion}>{trabajo.tipo_trabajo.nombre}</Text>
          {trabajo.tipo_trabajo.campos.map((campo) => (
            <View key={campo.clave} style={{ marginBottom: 10 }}>
              <Text style={styles.etiqueta}>{campo.etiqueta}</Text>
              <TextInput
                style={styles.input}
                value={datosForm[campo.clave] ?? ""}
                onChangeText={(v) => setDatosForm((prev) => ({ ...prev, [campo.clave]: v }))}
                keyboardType={campo.tipo === "numero" ? "numeric" : "default"}
              />
            </View>
          ))}
          <TouchableOpacity style={styles.boton} onPress={guardarDatos} disabled={guardandoDatos}>
            <Text style={styles.botonTexto}>{guardandoDatos ? "Guardando…" : "Guardar formulario"}</Text>
          </TouchableOpacity>
        </>
      )}

      <Text style={styles.seccion}>Fotos</Text>
      <TouchableOpacity style={styles.boton} onPress={elegirYSubirFoto} disabled={subiendoFoto}>
        <Text style={styles.botonTexto}>
          {subiendoFoto ? "Subiendo y analizando…" : "Agregar foto"}
        </Text>
      </TouchableOpacity>

      {fotos.map((f) => (
        <View key={f.id} style={styles.tarjetaFoto}>
          <Image source={{ uri: f.url }} style={styles.foto} />
          {f.alerta && <Text style={styles.alerta}>⚠ {f.detalle_alerta}</Text>}
          <Text style={styles.resumenFoto}>{f.resumen}</Text>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  centro: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#fff", gap: 12 },
  error: { color: "#c00" },
  volver: { color: "#007aff", marginBottom: 12 },
  titulo: { fontSize: 22, fontWeight: "600" },
  subtitulo: { color: "#666", marginTop: 2 },
  seccion: { fontSize: 14, fontWeight: "600", color: "#666", marginTop: 24, marginBottom: 10, textTransform: "uppercase" },
  filaBotones: { flexDirection: "row", gap: 10 },
  boton: { flex: 1, backgroundColor: "#000", borderRadius: 8, padding: 12, alignItems: "center" },
  botonHecho: { backgroundColor: "#2e7d32" },
  botonTexto: { color: "#fff", fontWeight: "600" },
  etiqueta: { marginBottom: 4, color: "#333" },
  input: { borderWidth: 1, borderColor: "#ccc", borderRadius: 8, padding: 10 },
  tarjetaFoto: { marginTop: 14, borderWidth: 1, borderColor: "#eee", borderRadius: 8, padding: 10 },
  foto: { width: "100%", height: 200, borderRadius: 6, marginBottom: 8 },
  resumenFoto: { color: "#333" },
  alerta: { color: "#b00", fontWeight: "600", marginBottom: 4 },
});
