import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Linking, Platform, ScrollView, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import type { EstadoTarea } from "@bitacora/shared";
import { useTema } from "../../theme";
import { Badge, Button, Card, ErrorState, LoadingScreen, Text } from "../../components/ui";
import { OfflineBanner } from "../../components/OfflineBanner";
import { useRed } from "../../services/sync/NetworkProvider";
import {
  encolarCancelarTarea,
  encolarEstadoTarea,
  obtenerTarea,
  type DetalleTarea,
} from "../../services/agenda";
import type { AgendaStackParamList } from "../../shell/navigation/types";

const ETIQUETA_ESTADO: Record<string, string> = {
  pendiente: "Sin confirmar",
  confirmada: "Confirmada",
  completada: "Completada",
  cancelada: "Cancelada",
  no_asistio: "No asistió",
  cancelada_anticipada: "Cancelada a tiempo",
};

const ACTIVA = new Set(["pendiente", "confirmada"]);

export function TareaDetalleScreen({ route }: NativeStackScreenProps<AgendaStackParamList, "TareaDetalle">) {
  const t = useTema();
  const { tareaId } = route.params;
  const { pendientes, enLinea } = useRed();
  const accionesAqui = useMemo(() => pendientes.filter((a) => a.recurso === `tarea:${tareaId}`), [pendientes, tareaId]);

  const [detalle, setDetalle] = useState<DetalleTarea | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [estadoLocal, setEstadoLocal] = useState<EstadoTarea | null>(null);
  const [enviando, setEnviando] = useState(false);

  const cargar = useCallback(async () => {
    setError(null);
    try {
      setDetalle(await obtenerTarea(tareaId));
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo cargar la cita");
    }
  }, [tareaId]);

  useEffect(() => {
    cargar();
  }, [cargar]);
  useFocusEffect(useCallback(() => void cargar(), [cargar]));

  if (!detalle && !error) return <LoadingScreen />;
  if (error && !detalle) return <ErrorState mensaje={error} onReintentar={cargar} />;
  if (!detalle) return null;

  const { tarea } = detalle;
  const cli = tarea.cliente;
  const estado = estadoLocal ?? tarea.estado;
  const activa = ACTIVA.has(estado) && accionesAqui.length === 0;
  const direccion = cli?.direccion ?? null;
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

  async function cambiar(estadoNuevo: EstadoTarea) {
    setEnviando(true);
    await encolarEstadoTarea(tareaId, estadoNuevo);
    setEstadoLocal(estadoNuevo);
    setEnviando(false);
    Alert.alert(
      estadoNuevo === "completada" ? "Cita completada" : "Cita confirmada",
      enLinea ? "Listo." : "Se enviará a la oficina cuando vuelvas a tener señal."
    );
  }

  function cancelar() {
    Alert.alert("Cancelar la cita", "El cliente no asistió o la cita no se realizará. ¿Confirmas?", [
      { text: "No", style: "cancel" },
      {
        text: "Sí, cancelar",
        style: "destructive",
        onPress: async () => {
          setEnviando(true);
          await encolarCancelarTarea(tareaId);
          setEstadoLocal("cancelada");
          setEnviando(false);
        },
      },
    ]);
  }

  return (
    <View style={{ flex: 1, backgroundColor: t.colores.bg }}>
      <OfflineBanner guardadoEn={detalle.desdeCache ? detalle.guardadoEn : undefined} />
      <ScrollView contentContainerStyle={{ padding: t.espacio(5), gap: t.espacio(4), paddingBottom: t.espacio(24) }}>
        <View style={{ gap: t.espacio(1.5) }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: t.espacio(2) }}>
            <Text variante="titulo" style={{ flex: 1 }}>
              {tarea.titulo}
            </Text>
            <Badge texto={ETIQUETA_ESTADO[estado] ?? estado} estado={estado} />
          </View>
          <Text variante="etiqueta" tono="muted">
            {tarea.fecha}
            {tarea.hora ? ` · ${tarea.hora.slice(0, 5)}` : ""}
          </Text>
          {tarea.prioridad === "alta" && ACTIVA.has(estado) ? (
            <Text variante="etiqueta" weight="semibold" tono="danger">
              Prioridad alta
            </Text>
          ) : null}
        </View>

        {tarea.descripcion ? (
          <Card plano>
            <Text variante="etiqueta">{tarea.descripcion}</Text>
          </Card>
        ) : null}

        {(direccion || cli?.telefono || cli?.nombre) && (
          <Card plano style={{ gap: t.espacio(2.5) }}>
            {cli?.nombre ? <Text variante="subtitulo">{cli.nombre}</Text> : null}
            {direccion ? (
              <View style={{ flexDirection: "row", gap: t.espacio(2), alignItems: "flex-start" }}>
                <Ionicons name="location-outline" size={18} color={t.colores.muted} style={{ marginTop: 1 }} />
                <Text variante="etiqueta" style={{ flex: 1 }}>
                  {direccion}
                </Text>
              </View>
            ) : null}
            <View style={{ flexDirection: "row", gap: t.espacio(2.5) }}>
              {direccion ? (
                <Button
                  titulo="Cómo llegar"
                  variante="secundario"
                  icono={<Ionicons name="navigate-outline" size={16} color={t.colores.foreground} />}
                  onPress={abrirMapa}
                />
              ) : null}
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

        {tarea.paquete_id ? (
          <Card plano style={{ backgroundColor: t.colores.brandSoft, borderColor: "transparent" }}>
            <Text variante="etiqueta" style={{ color: t.colores.brand }}>
              Esta cita es parte de un paquete de sesiones. Al completarla o marcar que no asistió, se descuenta 1 sesión.
            </Text>
          </Card>
        ) : null}

        {tarea.trabajo_id ? (
          <Card plano>
            <Text variante="caption" tono="muted">
              Tiene una orden de trabajo asociada — revísala en la pestaña Trabajos.
            </Text>
          </Card>
        ) : null}

        {accionesAqui.length > 0 && (
          <Card plano style={{ backgroundColor: t.colores.warningSoft, borderColor: "transparent" }}>
            <Text variante="caption" weight="semibold" style={{ color: t.colores.warning }}>
              Cambio sin sincronizar — se enviará cuando haya señal.
            </Text>
          </Card>
        )}

        {activa ? (
          <View style={{ gap: t.espacio(2.5), marginTop: t.espacio(1) }}>
            {estado === "pendiente" ? (
              <Button titulo="Confirmar cita" variante="secundario" onPress={() => cambiar("confirmada")} cargando={enviando} />
            ) : null}
            <Button titulo="Marcar completada" tamano="lg" onPress={() => cambiar("completada")} cargando={enviando} />
            <Button titulo="Canceló / no asistió" variante="peligro" onPress={cancelar} cargando={enviando} />
          </View>
        ) : (
          <Card plano style={{ backgroundColor: t.colores.surfaceAlt, borderColor: "transparent" }}>
            <Text variante="etiqueta" tono="muted">
              {accionesAqui.length > 0
                ? "Esperando a que se sincronice el último cambio."
                : `Esta cita está ${(ETIQUETA_ESTADO[estado] ?? estado).toLowerCase()} y ya no se puede modificar desde acá.`}
            </Text>
          </Card>
        )}
      </ScrollView>
    </View>
  );
}
