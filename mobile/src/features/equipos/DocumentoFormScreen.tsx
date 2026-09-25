import { useEffect, useState } from "react";
import { Alert, KeyboardAvoidingView, Platform, ScrollView, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import * as DocumentPicker from "expo-document-picker";
import { FileText, X } from "lucide-react-native";
import type { TipoDocumento } from "@bitacora/shared";
import { tokens } from "@bitacora/design-tokens";
import { Button, Card, DatePicker, EmptyState, ErrorState, Input, LoadingState, ScreenHeader, Select, Texto } from "@bitacora/ui/native";
import { elegirFotos } from "../../lib/imagen";
import type { MasStackParamList } from "../../shell/navigation/types";
import { guardarDocumento, listarDocumentosVehiculo, tiposDocumentoVehiculo, type ArchivoDocumento } from "../../services/equipos";
import { aFecha, aIso } from "./fechas";

// Mismo tope que el backend (documentos.ts, multer 10 MB).
const MAX_BYTES = 10 * 1024 * 1024;

// Tarea 146: subir o editar un documento de un vehículo (SOAP, revisión
// técnica, permiso de circulación…) con foto de cámara, galería o PDF.
// Necesita conexión: el archivo no pasa por la cola offline.
export function DocumentoFormScreen({ navigation, route }: NativeStackScreenProps<MasStackParamList, "DocumentoForm">) {
  const { equipoId, documentoId } = route.params;
  const [tipos, setTipos] = useState<TipoDocumento[] | null>(null);
  const [tipoId, setTipoId] = useState("");
  const [numero, setNumero] = useState("");
  const [emision, setEmision] = useState<string | null>(null);
  const [vencimiento, setVencimiento] = useState<string | null>(null);
  const [archivo, setArchivo] = useState<ArchivoDocumento | null>(null);
  const [tieneArchivo, setTieneArchivo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [t, docs] = await Promise.all([tiposDocumentoVehiculo(), documentoId ? listarDocumentosVehiculo(equipoId) : Promise.resolve([])]);
        const actual = docs.find((d) => d.id === documentoId);
        if (documentoId && !actual) throw new Error("No se encontró el documento");
        // Si el tipo del documento ya no está activo, igual se muestra.
        if (actual && !t.some((x) => x.id === actual.tipo_documento_id)) {
          t.push({ id: actual.tipo_documento_id, nombre: actual.tipo?.nombre ?? "Tipo actual", aplica_a: "vehiculo", activo: false, empresa_id: "", creado_en: "" });
        }
        setTipos(t);
        if (actual) {
          setTipoId(actual.tipo_documento_id);
          setNumero(actual.numero ?? "");
          setEmision(actual.fecha_emision);
          setVencimiento(actual.fecha_vencimiento);
          setTieneArchivo(Boolean(actual.archivo_key));
        }
      } catch (x) {
        setError(x instanceof Error ? x.message : "No se pudo cargar");
      }
    })();
  }, [equipoId, documentoId]);

  const titulo = documentoId ? "Editar documento" : "Subir documento";
  const cerrar = { icono: <X size={20} strokeWidth={2.5} color={tokens.color.text} />, onPress: () => navigation.goBack(), etiquetaAccesible: "Cerrar" };

  if (error || !tipos) {
    return (
      <View style={{ flex: 1, backgroundColor: tokens.color.bg }}>
        <ScreenHeader titulo={titulo} accion={cerrar} />
        {error ? <ErrorState mensaje={error} /> : <LoadingState />}
      </View>
    );
  }

  if (tipos.length === 0) {
    return (
      <View style={{ flex: 1, backgroundColor: tokens.color.bg }}>
        <ScreenHeader titulo={titulo} accion={cerrar} />
        <EmptyState
          titulo="No hay tipos de documento para vehículos"
          mensaje="Se crean en la web, en Configuración → Tipos de documento (por ejemplo SOAP o Revisión técnica)."
        />
      </View>
    );
  }

  async function elegirPdf() {
    const r = await DocumentPicker.getDocumentAsync({ type: "application/pdf", copyToCacheDirectory: true, multiple: false });
    if (r.canceled || !r.assets?.[0]) return;
    const a = r.assets[0];
    if (a.size && a.size > MAX_BYTES) return Alert.alert("Archivo muy grande", "El PDF puede pesar hasta 10 MB.");
    setArchivo({ uri: a.uri, name: a.name || `documento-${Date.now()}.pdf`, type: "application/pdf" });
  }

  function elegirArchivo() {
    Alert.alert("Adjuntar archivo", undefined, [
      {
        text: "Foto o imagen",
        onPress: () =>
          void elegirFotos({ titulo: "Foto del documento" }).then((fotos) => {
            if (fotos[0]) setArchivo({ uri: fotos[0].uri, name: fotos[0].name, type: fotos[0].type });
          }),
      },
      { text: "PDF", onPress: () => void elegirPdf() },
      { text: "Cancelar", style: "cancel" },
    ]);
  }

  async function guardar() {
    if (!tipoId) return Alert.alert("Falta el tipo", "Elige qué documento es.");
    if (emision && vencimiento && vencimiento < emision) return Alert.alert("Fechas inválidas", "El vencimiento no puede ser anterior a la emisión.");
    setGuardando(true);
    const r = await guardarDocumento({ id: documentoId, equipoId, tipoDocumentoId: tipoId, numero, fechaEmision: emision, fechaVencimiento: vencimiento, archivo });
    setGuardando(false);
    if (!r.ok) return Alert.alert("No se pudo guardar", r.error);
    navigation.goBack();
  }

  return (
    <View style={{ flex: 1, backgroundColor: tokens.color.bg }}>
      <ScreenHeader titulo={titulo} accion={cerrar} />
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: tokens.space["4"], gap: tokens.space["3"], paddingBottom: tokens.space["8"] }} keyboardShouldPersistTaps="handled">
          <Select etiqueta="Tipo de documento" valor={tipoId} onCambio={setTipoId} placeholder="Elegir" opciones={tipos.map((t) => ({ valor: t.id, etiqueta: t.nombre }))} />
          <Input etiqueta="Número (opcional)" valor={numero} onCambio={setNumero} />
          <DatePicker etiqueta="Fecha de emisión (opcional)" valor={aFecha(emision)} onCambio={(f) => setEmision(aIso(f))} placeholder="Sin fecha" />
          {emision ? (
            <Button variante="ghost" onPress={() => setEmision(null)}>
              Quitar fecha de emisión
            </Button>
          ) : null}
          <DatePicker etiqueta="Fecha de vencimiento" valor={aFecha(vencimiento)} onCambio={(f) => setVencimiento(aIso(f))} placeholder="No vence" />
          {vencimiento ? (
            <Button variante="ghost" onPress={() => setVencimiento(null)}>
              No vence
            </Button>
          ) : null}

          <Card>
            <View style={{ flexDirection: "row", alignItems: "center", gap: tokens.space["3"] }}>
              <FileText size={20} strokeWidth={2.5} color={`${tokens.color.text}99`} />
              <Texto tamano={tokens.size.small} color={tokens.color.text} style={{ flex: 1 }} numberOfLines={2}>
                {archivo ? archivo.name : tieneArchivo ? "Tiene un archivo adjunto" : "Sin archivo adjunto"}
              </Texto>
            </View>
            <View style={{ marginTop: tokens.space["3"] }}>
              <Button variante="secundario" bloque onPress={elegirArchivo}>
                {archivo || tieneArchivo ? "Reemplazar archivo" : "Adjuntar foto o PDF"}
              </Button>
            </View>
          </Card>

          <Texto tamano={tokens.size.caption} color={`${tokens.color.text}80`}>
            Necesitas conexión para guardar: el archivo se sube al momento.
          </Texto>
          <Button bloque cargando={guardando} onPress={() => void guardar()}>
            {documentoId ? "Guardar cambios" : "Subir documento"}
          </Button>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
