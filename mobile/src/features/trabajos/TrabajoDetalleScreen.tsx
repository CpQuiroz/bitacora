import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Linking, Platform, ScrollView, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { ItemChecklist } from "@bitacora/shared";
import { Ionicons } from "@expo/vector-icons";
import { useTema } from "../../theme";
import { Badge, Button, Card, ErrorState, LoadingScreen, Text } from "../../components/ui";
import { OfflineBanner } from "../../components/OfflineBanner";
import { useRed } from "../../services/sync/NetworkProvider";
import { ubicacionActual } from "../../lib/geo";
import {
  encolarCheckin,
  encolarDatos,
  encolarFinalizar,
  encolarFirma,
  encolarFoto,
  obtenerDetalle,
  type DetalleTrabajo,
} from "../../services/trabajos";
import { CamposDinamicos } from "./components/CamposDinamicos";
import { FotosSection } from "./components/FotosSection";
import { CierreFirma } from "./components/CierreFirma";
import type { TrabajosStackParamList } from "../../shell/navigation/types";

const ETIQUETA_OS: Record<string, string> = {
  pendiente: "Sin empezar",
  enviada: "Sin empezar",
  en_proceso: "En proceso",
  completada: "Completado",
  firmada: "Finalizado",
};

export function TrabajoDetalleScreen({ route, navigation }: NativeStackScreenProps<TrabajosStackParamList, "TrabajoDetalle">) {
  const t = useTema();
  const { trabajoId } = route.params;
  const { pendientes, fallidas, enLinea, descartar } = useRed();
  const fotosPendientes = useMemo(() => {
    const esFotoDeAca = (a: (typeof pendientes)[number]) =>
      a.recurso === `trabajo:${trabajoId}` && a.etiqueta === "Foto";
    return [
      ...pendientes.filter(esFotoDeAca).map((a) => ({ id: a.id, uri: a.archivo?.uri ?? "", fallida: false, error: a.ultimoError })),
      ...fallidas.filter(esFotoDeAca).map((a) => ({ id: a.id, uri: a.archivo?.uri ?? "", fallida: true, error: a.ultimoError })),
    ];
  }, [pendientes, fallidas, trabajoId]);

  const [detalle, setDetalle] = useState<DetalleTrabajo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [datosForm, setDatosForm] = useState<Record<string, string>>({});
  const [guardandoDatos, setGuardandoDatos] = useState(false);
  const [marcando, setMarcando] = useState<"Check-in" | "Check-out" | null>(null);
  const [finalizando, setFinalizando] = useState(false);

  const cargar = useCallback(async () => {
    setError(null);
    try {
      const d = await obtenerDetalle(trabajoId);
      setDetalle(d);
      setDatosForm(Object.fromEntries(Object.entries(d.trabajo.datos ?? {}).map(([k, v]) => [k, String(v ?? "")])));
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo cargar el trabajo");
    }
  }, [trabajoId]);

  useEffect(() => {
    cargar();
  }, [cargar]);
  useFocusEffect(useCallback(() => void cargar(), [cargar]));

  // Cuando una foto de la cola se sube, refrescamos para traer la de
  // verdad desde el servidor.
  const fotosEnCola = fotosPendientes.filter((f) => !f.fallida).length;
  useEffect(() => {
    void cargar();
  }, [fotosEnCola, cargar]);

  // El análisis con IA de cada foto termina en segundo plano en el
  // backend: mientras haya alguna "procesando", refrescamos cada 8s para
  // traer el resumen cuando esté listo.
  const hayFotoProcesando = (detalle?.fotos ?? []).some((f) => f.estado === "procesando");
  useEffect(() => {
    if (!hayFotoProcesando) return;
    const id = setInterval(() => void cargar(), 8000);
    return () => clearInterval(id);
  }, [hayFotoProcesando, cargar]);

  if (!detalle && !error) return <LoadingScreen />;
  if (error && !detalle) return <ErrorState mensaje={error} onReintentar={cargar} />;
  if (!detalle) return null;

  const { trabajo, orden, fotos } = detalle;
  const cli = trabajo.cliente_info;
  const finalizada = Boolean(orden?.finalizada_en) || finalizando;
  const checklist: ItemChecklist[] = orden?.checklist ?? [];
  const checkIn = checklist.find((c) => c.item === "Check-in");
  const checkOut = checklist.find((c) => c.item === "Check-out");
  const puedeFinalizar = Boolean(orden?.firma_url_firmada) && Boolean(checkOut?.hecho) && !finalizada;
  const estadoMostrar = orden?.estado_os ? ETIQUETA_OS[orden.estado_os] ?? trabajo.estado : trabajo.estado;
  const direccion = cli?.direccion || trabajo.ubicacion;
  const coords = cli?.lat != null && cli?.lng != null ? { lat: cli.lat, lng: cli.lng } : null;

  function abrirMapa() {
    const destino = coords ? `${coords.lat},${coords.lng}` : encodeURIComponent(direccion ?? "");
    if (!destino) return;
    const url = Platform.select({
      ios: `http://maps.apple.com/?daddr=${destino}`,
      default: `https://www.google.com/maps/dir/?api=1&destination=${destino}`,
    });
    Linking.openURL(url!);
  }

  async function marcar(item: "Check-in" | "Check-out") {
    setMarcando(item);
    const ubic = await ubicacionActual();
    if (!ubic) {
      Alert.alert(
        "Sin ubicación",
        `Se registrará el ${item.toLowerCase()} sin coordenadas (permiso denegado o GPS no disponible).`
      );
    }
    await encolarCheckin(trabajoId, item, ubic);
    setMarcando(null);
    setDetalle((prev) =>
      prev
        ? {
            ...prev,
            orden: {
              ...(prev.orden ?? ({} as NonNullable<DetalleTrabajo["orden"]>)),
              checklist: [
                ...(prev.orden?.checklist ?? []).filter((c) => c.item !== item),
                { item, hecho: true, hora: new Date().toISOString() },
              ],
            } as DetalleTrabajo["orden"],
          }
        : prev
    );
  }

  async function guardarDatos() {
    setGuardandoDatos(true);
    await encolarDatos(trabajoId, datosForm);
    setGuardandoDatos(false);
    Alert.alert("Guardado", enLinea ? "Datos guardados." : "Se enviarán cuando haya conexión.");
  }

  async function finalizar() {
    setFinalizando(true);
    await encolarFinalizar(trabajoId);
    Alert.alert(
      "Trabajo finalizado",
      "Quedó cerrado. Si estás sin conexión, se enviará a la oficina apenas vuelvas a tener señal.",
      [{ text: "Listo", onPress: () => navigation.goBack() }]
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: t.colores.bg }}>
      <OfflineBanner guardadoEn={detalle.desdeCache ? detalle.guardadoEn : undefined} />
      <ScrollView contentContainerStyle={{ padding: t.espacio(5), gap: t.espacio(4), paddingBottom: t.espacio(24) }}>
        <View style={{ gap: t.espacio(1.5) }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <Text variante="titulo" style={{ flex: 1 }}>
              {cli?.nombre ?? trabajo.cliente}
            </Text>
            <Badge texto={estadoMostrar} estado={orden?.estado_os ?? trabajo.estado} />
          </View>
          <Text variante="etiqueta" tono="muted">
            {trabajo.fecha}
            {trabajo.hora_programada ? ` · ${trabajo.hora_programada.slice(0, 5)}` : ""}
          </Text>
          {orden?.folio != null ? (
            <Text variante="etiqueta" tono="brand" weight="semibold">
              Orden N° {orden.folio}
            </Text>
          ) : null}
        </View>

        {/* Cliente: ir y llamar */}
        {(direccion || cli?.telefono) && (
          <Card plano style={{ gap: t.espacio(2.5) }}>
            {direccion ? (
              <View style={{ flexDirection: "row", gap: t.espacio(2), alignItems: "flex-start" }}>
                <Ionicons name="location-outline" size={18} color={t.colores.muted} style={{ marginTop: 1 }} />
                <Text variante="etiqueta" style={{ flex: 1 }}>
                  {direccion}
                </Text>
              </View>
            ) : null}
            <View style={{ flexDirection: "row", gap: t.espacio(2.5) }}>
              {direccion ? <Button titulo="Cómo llegar" variante="secundario" icono={<Ionicons name="navigate-outline" size={16} color={t.colores.foreground} />} onPress={abrirMapa} /> : null}
              {cli?.telefono ? (
                <Button
                  titulo="Llamar"
                  variante="secundario"
                  icono={<Ionicons name="call-outline" size={16} color={t.colores.foreground} />}
                  onPress={() => Linking.openURL(`tel:${cli.telefono}`)}
                />
              ) : null}
            </View>
          </Card>
        )}

        {finalizada && (
          <Card plano style={{ backgroundColor: t.colores.successSoft, borderColor: "transparent" }}>
            <Text variante="etiqueta" weight="semibold" style={{ color: t.colores.success }}>
              ✓ Trabajo finalizado — ya no se puede editar
            </Text>
          </Card>
        )}

        {/* Check-in / out */}
        <View style={{ gap: t.espacio(3) }}>
          <Text variante="etiqueta" tono="muted" weight="semibold" style={{ textTransform: "uppercase" }}>
            Check-in / Check-out
          </Text>
          <View style={{ flexDirection: "row", gap: t.espacio(2.5) }}>
            <Button
              titulo={checkIn?.hecho ? `Check-in ✓ ${checkIn.hora?.slice(11, 16) ?? ""}` : "Marcar check-in"}
              variante={checkIn?.hecho ? "secundario" : "primario"}
              onPress={() => marcar("Check-in")}
              disabled={Boolean(checkIn?.hecho) || finalizada}
              cargando={marcando === "Check-in"}
            />
            <Button
              titulo={checkOut?.hecho ? `Check-out ✓ ${checkOut.hora?.slice(11, 16) ?? ""}` : "Marcar check-out"}
              variante={checkOut?.hecho ? "secundario" : "primario"}
              onPress={() => marcar("Check-out")}
              disabled={Boolean(checkOut?.hecho) || finalizada}
              cargando={marcando === "Check-out"}
            />
          </View>
        </View>

        {trabajo.tipo_trabajo ? (
          <CamposDinamicos
            nombre={trabajo.tipo_trabajo.nombre}
            campos={trabajo.tipo_trabajo.campos}
            valores={datosForm}
            onCambiar={(k, v) => setDatosForm((p) => ({ ...p, [k]: v }))}
            onGuardar={guardarDatos}
            guardando={guardandoDatos}
            editable={!finalizada}
          />
        ) : null}

        <FotosSection
          fotos={fotos}
          pendientes={fotosPendientes}
          editable={!finalizada}
          onAgregar={(archivo) => void encolarFoto(trabajoId, archivo)}
          onQuitarPendiente={descartar}
        />

        <CierreFirma orden={orden} editable={!finalizada} onFirmar={(p) => encolarFirma(trabajoId, p)} />

        {!finalizada && (
          <>
            <Button
              titulo="Finalizar trabajo"
              tamano="lg"
              onPress={finalizar}
              disabled={!puedeFinalizar}
              cargando={finalizando}
              style={{ marginTop: t.espacio(2) }}
            />
            {!puedeFinalizar && (
              <Text variante="caption" tono="muted" style={{ textAlign: "center" }}>
                Para finalizar: marca el check-out y registra la firma del cliente.
              </Text>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}
