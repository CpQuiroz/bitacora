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
import { comprimirImagen } from "../lib/imagen";
import { SignaturePad } from "../components/SignaturePad";

type TrabajoConTipo = Trabajo & { tipo_trabajo: TipoTrabajo | null };
type AnalisisFotoConUrl = AnalisisFoto & { url: string };
type OrdenConFirma = OrdenServicio & { firma_url_firmada: string | null };

export default function TrabajoDetalleScreen({
  trabajoId,
  onVolver,
}: {
  trabajoId: string;
  onVolver: () => void;
}) {
  const [trabajo, setTrabajo] = useState<TrabajoConTipo | null>(null);
  const [orden, setOrden] = useState<OrdenConFirma | null>(null);
  const [fotos, setFotos] = useState<AnalisisFotoConUrl[]>([]);
  const [cargando, setCargando] = useState(true);
  const [subiendoFoto, setSubiendoFoto] = useState(false);
  const [datosForm, setDatosForm] = useState<Record<string, string>>({});
  const [guardandoDatos, setGuardandoDatos] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [firmanteNombre, setFirmanteNombre] = useState("");
  const [firmanteDocumento, setFirmanteDocumento] = useState("");
  const [observacionesCierre, setObservacionesCierre] = useState("");
  const [finalizando, setFinalizando] = useState(false);

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

  const finalizada = Boolean(orden?.finalizada_en);

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

  async function subirAsset(uri: string, width: number, nombre: string, tipo: string) {
    const uriComprimida = await comprimirImagen(uri, width);

    const formData = new FormData();
    formData.append("foto", { uri: uriComprimida, name: nombre, type: tipo } as unknown as Blob);

    const res = await apiFetch(`/api/trabajos/${trabajoId}/fotos`, {
      method: "POST",
      body: formData,
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      Alert.alert("Error", body.error ?? "No se pudo subir la foto");
    }
  }

  async function tomarFoto() {
    const permiso = await ImagePicker.requestCameraPermissionsAsync();
    if (!permiso.granted) {
      Alert.alert("Permiso necesario", "Necesitamos acceso a la cámara para continuar.");
      return;
    }
    const resultado = await ImagePicker.launchCameraAsync({ quality: 0.8 });
    if (resultado.canceled || resultado.assets.length === 0) return;

    setSubiendoFoto(true);
    const asset = resultado.assets[0];
    await subirAsset(asset.uri, asset.width, asset.fileName ?? "foto.jpg", asset.mimeType ?? "image/jpeg");
    setSubiendoFoto(false);
    cargar();
  }

  async function elegirYSubirFoto() {
    const permiso = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permiso.granted) {
      Alert.alert("Permiso necesario", "Necesitamos acceso a tus fotos para continuar.");
      return;
    }
    const resultado = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.8,
      allowsMultipleSelection: true,
    });
    if (resultado.canceled || resultado.assets.length === 0) return;

    setSubiendoFoto(true);
    for (const asset of resultado.assets) {
      await subirAsset(asset.uri, asset.width, asset.fileName ?? "foto.jpg", asset.mimeType ?? "image/jpeg");
    }
    setSubiendoFoto(false);
    cargar();
  }

  async function guardarFirma(base64Png: string) {
    if (!firmanteNombre.trim()) {
      Alert.alert("Falta el nombre", "Ingresa el nombre de quien firma antes de guardar.");
      return;
    }
    const res = await apiFetch(`/api/trabajos/${trabajoId}/firma`, {
      method: "POST",
      body: JSON.stringify({
        firma_base64: base64Png,
        firmante_nombre: firmanteNombre,
        firmante_documento: firmanteDocumento,
        observaciones_cierre: observacionesCierre,
      }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      Alert.alert("Error", body.error ?? "No se pudo guardar la firma");
      return;
    }
    setOrden(await res.json());
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

  async function finalizarOS() {
    setFinalizando(true);
    const res = await apiFetch(`/api/trabajos/${trabajoId}/finalizar`, { method: "POST" });
    setFinalizando(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      Alert.alert("No se pudo finalizar", body.error ?? "Intenta de nuevo");
      return;
    }
    setOrden(await res.json());
    Alert.alert("OS finalizada", "La orden de servicio quedó cerrada y ya no se puede editar.");
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
  const puedeFinalizar = Boolean(orden?.firma_url_firmada) && Boolean(checkOut?.hecho) && !finalizada;

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 20, paddingTop: 60 }}>
      <TouchableOpacity onPress={onVolver}>
        <Text style={styles.volver}>← Mis trabajos</Text>
      </TouchableOpacity>

      <Text style={styles.titulo}>{trabajo.cliente}</Text>
      <Text style={styles.subtitulo}>
        {trabajo.fecha}
        {trabajo.hora_programada ? ` ${trabajo.hora_programada}` : ""} · ${trabajo.monto.toLocaleString("es-CL")} ·{" "}
        {trabajo.estado}
      </Text>
      {trabajo.ubicacion && <Text style={styles.subtitulo}>{trabajo.ubicacion}</Text>}
      {orden?.folio != null && <Text style={styles.folio}>OS N° {orden.folio}</Text>}

      {finalizada && (
        <View style={styles.bannerFinalizada}>
          <Text style={styles.bannerFinalizadaTexto}>✓ OS finalizada — ya no se puede editar</Text>
        </View>
      )}

      <Text style={styles.seccion}>Check-in / Check-out</Text>
      <View style={styles.filaBotones}>
        <TouchableOpacity
          style={[styles.boton, checkIn?.hecho && styles.botonHecho, finalizada && styles.botonDeshabilitado]}
          onPress={() => marcar("Check-in")}
          disabled={checkIn?.hecho || finalizada}
        >
          <Text style={styles.botonTexto}>
            {checkIn?.hecho ? `Check-in ✓ ${checkIn.hora?.slice(11, 16) ?? ""}` : "Marcar check-in"}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.boton, checkOut?.hecho && styles.botonHecho, finalizada && styles.botonDeshabilitado]}
          onPress={() => marcar("Check-out")}
          disabled={checkOut?.hecho || finalizada}
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
                editable={!finalizada}
                value={datosForm[campo.clave] ?? ""}
                onChangeText={(v) => setDatosForm((prev) => ({ ...prev, [campo.clave]: v }))}
                keyboardType={campo.tipo === "numero" ? "numeric" : "default"}
              />
            </View>
          ))}
          {!finalizada && (
            <TouchableOpacity style={styles.boton} onPress={guardarDatos} disabled={guardandoDatos}>
              <Text style={styles.botonTexto}>{guardandoDatos ? "Guardando…" : "Guardar formulario"}</Text>
            </TouchableOpacity>
          )}
        </>
      )}

      <Text style={styles.seccion}>Fotos</Text>
      {!finalizada && (
        <View style={styles.filaBotones}>
          <TouchableOpacity style={styles.boton} onPress={tomarFoto} disabled={subiendoFoto}>
            <Text style={styles.botonTexto}>{subiendoFoto ? "Subiendo…" : "Tomar foto"}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.boton} onPress={elegirYSubirFoto} disabled={subiendoFoto}>
            <Text style={styles.botonTexto}>{subiendoFoto ? "Subiendo…" : "Elegir de galería"}</Text>
          </TouchableOpacity>
        </View>
      )}

      {fotos.map((f) => (
        <View key={f.id} style={styles.tarjetaFoto}>
          <Image source={{ uri: f.url }} style={styles.foto} />
          {f.alerta && <Text style={styles.alerta}>⚠ {f.detalle_alerta}</Text>}
          <Text style={styles.resumenFoto}>{f.resumen}</Text>
        </View>
      ))}

      <Text style={styles.seccion}>Cierre y firma del cliente</Text>
      {orden?.firma_url_firmada ? (
        <View style={styles.tarjetaFoto}>
          <Image source={{ uri: orden.firma_url_firmada }} style={styles.firmaGuardada} resizeMode="contain" />
          <Text style={styles.resumenFoto}>
            Firma registrada ✓{orden.firmante_nombre ? ` — ${orden.firmante_nombre}` : ""}
          </Text>
          {orden.firmante_documento && <Text style={styles.resumenFoto}>RUT/Documento: {orden.firmante_documento}</Text>}
          {orden.observaciones_cierre && <Text style={styles.resumenFoto}>Obs: {orden.observaciones_cierre}</Text>}
        </View>
      ) : (
        <>
          <View style={{ marginBottom: 10 }}>
            <Text style={styles.etiqueta}>Nombre de quien firma *</Text>
            <TextInput style={styles.input} value={firmanteNombre} onChangeText={setFirmanteNombre} />
          </View>
          <View style={{ marginBottom: 10 }}>
            <Text style={styles.etiqueta}>RUT / documento</Text>
            <TextInput style={styles.input} value={firmanteDocumento} onChangeText={setFirmanteDocumento} />
          </View>
          <View style={{ marginBottom: 10 }}>
            <Text style={styles.etiqueta}>Observaciones de cierre</Text>
            <TextInput
              style={[styles.input, { height: 70 }]}
              multiline
              value={observacionesCierre}
              onChangeText={setObservacionesCierre}
            />
          </View>
          <SignaturePad onGuardar={guardarFirma} />
        </>
      )}

      {!finalizada && (
        <TouchableOpacity
          style={[styles.botonFinalizar, !puedeFinalizar && styles.botonDeshabilitado]}
          onPress={finalizarOS}
          disabled={!puedeFinalizar || finalizando}
        >
          <Text style={styles.botonTexto}>{finalizando ? "Finalizando…" : "Finalizar OS"}</Text>
        </TouchableOpacity>
      )}
      {!finalizada && !puedeFinalizar && (
        <Text style={styles.ayudaFinalizar}>
          Para finalizar: marca el check-out y registra la firma del cliente.
        </Text>
      )}
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
  folio: { color: "#4338ca", fontWeight: "600", marginTop: 4 },
  bannerFinalizada: { marginTop: 12, backgroundColor: "#e8f5e9", borderRadius: 8, padding: 10 },
  bannerFinalizadaTexto: { color: "#2e7d32", fontWeight: "600" },
  seccion: { fontSize: 14, fontWeight: "600", color: "#666", marginTop: 24, marginBottom: 10, textTransform: "uppercase" },
  filaBotones: { flexDirection: "row", gap: 10 },
  boton: { flex: 1, backgroundColor: "#000", borderRadius: 8, padding: 12, alignItems: "center" },
  botonHecho: { backgroundColor: "#2e7d32" },
  botonDeshabilitado: { opacity: 0.35 },
  botonTexto: { color: "#fff", fontWeight: "600" },
  botonFinalizar: { marginTop: 24, backgroundColor: "#4338ca", borderRadius: 8, padding: 14, alignItems: "center" },
  ayudaFinalizar: { marginTop: 8, color: "#888", fontSize: 12, textAlign: "center" },
  etiqueta: { marginBottom: 4, color: "#333" },
  input: { borderWidth: 1, borderColor: "#ccc", borderRadius: 8, padding: 10 },
  tarjetaFoto: { marginTop: 14, borderWidth: 1, borderColor: "#eee", borderRadius: 8, padding: 10 },
  foto: { width: "100%", height: 200, borderRadius: 6, marginBottom: 8 },
  firmaGuardada: { width: "100%", height: 120, marginBottom: 8, backgroundColor: "#fff" },
  resumenFoto: { color: "#333" },
  alerta: { color: "#b00", fontWeight: "600", marginBottom: 4 },
});
