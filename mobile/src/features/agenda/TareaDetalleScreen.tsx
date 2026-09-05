import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Linking, Platform, ScrollView, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import type { EstadoTarea } from "@bitacora/shared";
import { ETIQUETA_ESTADO_TAREA } from "@bitacora/shared";
import { useTema } from "../../theme";
import { Badge, Button, Card, ErrorState, LoadingScreen, Text } from "../../components/ui";
import { OfflineBanner } from "../../components/OfflineBanner";
import { useRed } from "../../services/sync/NetworkProvider";
import { useAuth } from "../auth/AuthContext";
import {
  eliminarCita,
  encolarCancelarTarea,
  encolarEstadoTarea,
  obtenerTarea,
  type DetalleTarea,
} from "../../services/agenda";
import type { AgendaStackParamList } from "../../shell/navigation/types";
import { EstadoCitaRiel } from "./EstadoCitaRiel";
import { DetalleReservaCosmetologia } from "./DetalleReservaCosmetologia";

function soloDigitos(tel: string): string {
  return tel.replace(/[^\d]/g, "");
}

const ACTIVA = new Set(["pendiente", "confirmada"]);

export function TareaDetalleScreen({ route, navigation }: NativeStackScreenProps<AgendaStackParamList, "TareaDetalle">) {
  const t = useTema();
  const { tareaId } = route.params;
  const { pendientes, enLinea } = useRed();
  const auth = useAuth();
  const esGestion = auth.fase === "listo" && auth.usuario.rol !== "colaborador";
  const accionesAqui = useMemo(() => pendientes.filter((a) => a.recurso === `tarea:${tareaId}`), [pendientes, tareaId]);

  const [detalle, setDetalle] = useState<DetalleTarea | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [estadoLocal, setEstadoLocal] = useState<EstadoTarea | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [eliminando, setEliminando] = useState(false);

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

  function eliminar() {
    Alert.alert("Eliminar la cita", "Se borra de la agenda para siempre. ¿Seguro?", [
      { text: "No", style: "cancel" },
      {
        text: "Sí, eliminar",
        style: "destructive",
        onPress: async () => {
          if (!enLinea) {
            Alert.alert("Sin conexión", "Necesitas conexión para eliminar una cita.");
            return;
          }
          setEliminando(true);
          const r = await eliminarCita(tareaId);
          setEliminando(false);
          if (!r.ok) {
            Alert.alert("No se pudo eliminar", r.error ?? "Intenta de nuevo.");
            return;
          }
          navigation.goBack();
        },
      },
    ]);
  }

  function cancelar() {
    Alert.alert("Cancelar la reserva", "La cita no se va a realizar. ¿Confirmas?", [
      { text: "No", style: "cancel" },
      {
        text: "Sí, cancelar",
        style: "destructive",
        onPress: async () => {
          setEnviando(true);
          // El backend decide "cancelada" o "cancelada_anticipada" según
          // la ventana de aviso — ambas se ven como "Cancelado" acá.
          await encolarCancelarTarea(tareaId);
          setEstadoLocal("cancelada");
          setEnviando(false);
        },
      },
    ]);
  }

  function noAsistio() {
    Alert.alert("Marcar que no asistió", "Se descuenta 1 sesión del pack si esta cita tiene uno asociado. ¿Confirmas?", [
      { text: "No", style: "cancel" },
      {
        text: "Sí, no asistió",
        style: "destructive",
        onPress: async () => {
          setEnviando(true);
          await encolarEstadoTarea(tareaId, "no_asistio");
          setEstadoLocal("no_asistio");
          setEnviando(false);
        },
      },
    ]);
  }

  // Tema por rubro: cosmetología tiene su propia pantalla de detalle
  // ("Vino y eucalipto") — el resto de los rubros sigue con el layout
  // genérico de acá abajo.
  if (auth.fase === "listo" && auth.usuario.empresa.rubro === "cosmetologia") {
    return (
      <DetalleReservaCosmetologia
        tarea={{ ...tarea, estado }}
        esGestion={esGestion}
        enviando={enviando}
        eliminando={eliminando}
        navigation={navigation}
        onConfirmar={() => cambiar("confirmada")}
        onAsistio={() => cambiar("completada")}
        onNoAsistio={noAsistio}
        onCancelar={cancelar}
        onEditar={() => navigation.navigate("NuevaCita", { tareaId })}
        onEliminar={eliminar}
      />
    );
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
            <Badge texto={ETIQUETA_ESTADO_TAREA[estado] ?? estado} estado={estado} />
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
              {cli?.telefono ? (
                <Button
                  titulo="WhatsApp"
                  variante="secundario"
                  icono={<Ionicons name="logo-whatsapp" size={16} color={t.colores.foreground} />}
                  onPress={() => Linking.openURL(`https://wa.me/${soloDigitos(cli.telefono!)}`)}
                />
              ) : null}
            </View>
          </Card>
        )}

        {tarea.paquete_id ? (
          <Card plano style={{ backgroundColor: t.colores.brandSoft, borderColor: "transparent" }}>
            <Text variante="etiqueta" style={{ color: t.colores.brand }}>
              Esta cita es parte de un paquete de sesiones. Al marcar Asistió o No asistió se descuenta 1 sesión.
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

        <View style={{ gap: t.espacio(3), marginTop: t.espacio(1) }}>
          {activa ? <Button titulo="Marcar Asistió" tamano="lg" onPress={() => cambiar("completada")} cargando={enviando} /> : null}
          <EstadoCitaRiel
            estado={estado}
            activa={activa}
            cargando={enviando}
            onConfirmar={estado === "pendiente" ? () => cambiar("confirmada") : undefined}
            onNoAsistio={noAsistio}
            onCancelar={cancelar}
          />
        </View>

        {!activa && accionesAqui.length > 0 && (
          <Card plano style={{ backgroundColor: t.colores.surfaceAlt, borderColor: "transparent" }}>
            <Text variante="etiqueta" tono="muted">
              Esperando a que se sincronice el último cambio.
            </Text>
          </Card>
        )}

        {esGestion ? (
          <View style={{ gap: t.espacio(2.5), marginTop: t.espacio(2), borderTopWidth: 1, borderTopColor: t.colores.border, paddingTop: t.espacio(4) }}>
            <Text variante="caption" tono="muted" weight="semibold" style={{ textTransform: "uppercase" }}>
              Gestión
            </Text>
            <Button
              titulo="Editar / reprogramar"
              variante="secundario"
              icono={<Ionicons name="create-outline" size={16} color={t.colores.foreground} />}
              onPress={() => navigation.navigate("NuevaCita", { tareaId })}
            />
            <Button titulo="Eliminar cita" variante="peligro" onPress={eliminar} cargando={eliminando} />
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}
