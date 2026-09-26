import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Linking, Platform, ScrollView, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { ArrowLeft, MapPin, MessageCircle, Navigation, Pencil, Phone } from "lucide-react-native";
import type { EstadoTarea } from "@bitacora/shared";
import { ETIQUETA_ESTADO_TAREA, formatearFolio } from "@bitacora/shared";
import { tokens } from "@bitacora/design-tokens";
import { Button, Card, ErrorState, LoadingState, ScreenHeader, StatusBadge, Texto } from "@bitacora/ui/native";
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

// Sistema visual móvil v2 (14-sep-2026) — ScreenHeader propio con
// `accion`=volver (antetítulo = fecha/hora, título = tarea.titulo);
// StatusBadge en vez del <Badge> viejo (estado "pendiente" no cae en
// ninguno de los 4 tonos de MAPA_ESTADO_TONO, se fuerza a "en_progreso"
// — es el que necesita acción, mismo criterio que ya usa AgendaScreen
// con `marca.base` para ese mismo estado en el calendario). El header
// nativo del stack se apaga en AgendaStack.tsx para esta ruta.
export function TareaDetalleScreen({ route, navigation }: NativeStackScreenProps<AgendaStackParamList, "TareaDetalle">) {
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

  const volver = { icono: <ArrowLeft size={20} strokeWidth={2.5} color={tokens.color.text} />, onPress: () => navigation.goBack(), etiquetaAccesible: "Volver" };

  if (!detalle && !error) {
    return (
      <View style={{ flex: 1, backgroundColor: tokens.color.bg }}>
        <ScreenHeader titulo="Cita" accion={volver} />
        <View style={{ padding: tokens.space["4"] }}>
          <LoadingState />
        </View>
      </View>
    );
  }
  if (error && !detalle) {
    return (
      <View style={{ flex: 1, backgroundColor: tokens.color.bg }}>
        <ScreenHeader titulo="Cita" accion={volver} />
        <ErrorState mensaje={error} onReintentar={cargar} />
      </View>
    );
  }
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
    <View style={{ flex: 1, backgroundColor: tokens.color.bg }}>
      <ScreenHeader
        antetitulo={`${formatearFolio("CIT", tarea.folio) ? `${formatearFolio("CIT", tarea.folio)} · ` : ""}${tarea.fecha}${tarea.hora ? ` · ${tarea.hora.slice(0, 5)}` : ""}`}
        titulo={tarea.titulo}
        accion={volver}
      />
      <OfflineBanner guardadoEn={detalle.desdeCache ? detalle.guardadoEn : undefined} />
      <ScrollView contentContainerStyle={{ padding: tokens.space["6"], gap: tokens.space["4"], paddingBottom: tokens.space["8"] * 3 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: tokens.space["2"], flexWrap: "wrap" }}>
          <StatusBadge estado={estado} etiqueta={ETIQUETA_ESTADO_TAREA[estado] ?? estado} tonoForzado={estado === "pendiente" ? "en_progreso" : undefined} />
          {tarea.prioridad === "alta" && ACTIVA.has(estado) ? (
            <Texto tamano={tokens.size.small} peso="semibold" color={tokens.color.accentRamp["700"]}>
              Prioridad alta
            </Texto>
          ) : null}
        </View>

        {tarea.descripcion ? (
          <Card>
            <Texto tamano={tokens.size.small} color={tokens.color.text}>
              {tarea.descripcion}
            </Texto>
          </Card>
        ) : null}

        {(direccion || cli?.telefono || cli?.nombre) && (
          <Card>
            <View style={{ gap: tokens.space["2"] * 1.25 }}>
              {cli?.nombre ? (
                <Texto tamano={tokens.size.h5} peso="semibold" color={tokens.color.text}>
                  {cli.nombre}
                </Texto>
              ) : null}
              {direccion ? (
                <View style={{ flexDirection: "row", gap: tokens.space["2"], alignItems: "flex-start" }}>
                  <MapPin size={18} strokeWidth={2.25} color={tokens.color.textSecondary} style={{ marginTop: 1 }} />
                  <Texto tamano={tokens.size.small} color={tokens.color.text} style={{ flex: 1 }}>
                    {direccion}
                  </Texto>
                </View>
              ) : null}
              <View style={{ flexDirection: "row", gap: tokens.space["2"] * 1.25, flexWrap: "wrap" }}>
                {direccion ? (
                  <Button
                    variante="secundario"
                    iconoIzq={<Navigation size={16} strokeWidth={2.5} color={tokens.color.text} />}
                    onPress={abrirMapa}
                  >
                    Cómo llegar
                  </Button>
                ) : null}
                {cli?.telefono ? (
                  <Button
                    variante="secundario"
                    iconoIzq={<Phone size={16} strokeWidth={2.5} color={tokens.color.text} />}
                    onPress={() => Linking.openURL(`tel:${cli.telefono}`)}
                  >
                    Llamar
                  </Button>
                ) : null}
                {cli?.telefono ? (
                  <Button
                    variante="secundario"
                    iconoIzq={<MessageCircle size={16} strokeWidth={2.5} color={tokens.color.accent2Ramp["700"]} />}
                    onPress={() => Linking.openURL(`https://wa.me/${soloDigitos(cli.telefono!)}`)}
                  >
                    WhatsApp
                  </Button>
                ) : null}
              </View>
            </View>
          </Card>
        )}

        {tarea.paquete_id ? (
          <View style={{ backgroundColor: tokens.color.accent2Ramp["200"], borderRadius: tokens.radius.lg, padding: tokens.space["4"] }}>
            <Texto tamano={tokens.size.small} color={tokens.color.accent2Ramp["800"]}>
              Esta cita es parte de un paquete de sesiones. Al marcar Asistió o No asistió se descuenta 1 sesión.
            </Texto>
          </View>
        ) : null}

        {tarea.trabajo_id ? (
          <Card>
            <Texto tamano={tokens.size.caption} color={tokens.color.textSecondary}>
              Tiene una orden de trabajo asociada — revísala en la pestaña Trabajos.
            </Texto>
          </Card>
        ) : null}

        {accionesAqui.length > 0 && (
          <View style={{ backgroundColor: tokens.color.accentRamp["200"], borderRadius: tokens.radius.lg, padding: tokens.space["4"] }}>
            <Texto tamano={tokens.size.caption} peso="semibold" color={tokens.color.accentRamp["800"]}>
              Cambio sin sincronizar — se enviará cuando haya señal.
            </Texto>
          </View>
        )}

        <View style={{ gap: tokens.space["3"], marginTop: tokens.space["1"] }}>
          {activa ? (
            <Button tamano="lg" bloque onPress={() => cambiar("completada")} cargando={enviando}>
              Marcar Asistió
            </Button>
          ) : null}
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
          <View style={{ backgroundColor: tokens.color.neutral["200"], borderRadius: tokens.radius.md, padding: tokens.space["4"] }}>
            <Texto tamano={tokens.size.small} color={tokens.color.textSecondary}>
              Esperando a que se sincronice el último cambio.
            </Texto>
          </View>
        )}

        {esGestion ? (
          <View style={{ gap: tokens.space["2"] * 1.25, marginTop: tokens.space["2"], borderTopWidth: 1, borderTopColor: tokens.color.divider, paddingTop: tokens.space["4"] }}>
            <Texto tamano={tokens.size.caption} color={tokens.color.textSecondary} peso="semibold" style={{ textTransform: "uppercase" }}>
              Gestión
            </Texto>
            <Button
              variante="secundario"
              iconoIzq={<Pencil size={16} strokeWidth={2.5} color={tokens.color.text} />}
              onPress={() => navigation.navigate("NuevaCita", { tareaId })}
            >
              Editar / reprogramar
            </Button>
            <Button variante="peligro" onPress={eliminar} cargando={eliminando}>
              Eliminar cita
            </Button>
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}
