import { useCallback, useState } from "react";
import { FlatList, RefreshControl, View } from "react-native";
import { CalendarClock, Car, ClipboardList, Search, Sun } from "lucide-react-native";
import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { tokens } from "@bitacora/design-tokens";
import { FUNCIONES_LEVANTAMIENTOS } from "@bitacora/shared";
import { AsistenteButton, Card, EmptyState, ErrorState, ESPACIO_ASISTENTE_FLOTANTE, LoadingState, ScreenHeader, Skeleton, StatusBadge, Texto, useMarca } from "@bitacora/ui/native";
import { OfflineBanner } from "../../components/OfflineBanner";
import { formatearFechaLarga } from "../../lib/horario";
import { useAuth } from "../auth/AuthContext";
import { cargarHoy, type ItemHoy } from "../../services/hoy";
import type { HoyStackParamList } from "../../shell/navigation/types";

const ICONO: Record<ItemHoy["tipo"], typeof ClipboardList> = {
  trabajo: ClipboardList,
  cita: CalendarClock,
  viaje: Car,
  levantamiento: Search,
};

// Color del ícono + del tag de folio, por tipo (18-sep-2026) — antes
// los 4 tipos se veían con el mismo ícono gris, difícil de distinguir
// de un vistazo (pedido real). Con solo 2 acentos de marca en el
// sistema (terracota/oliva) más neutral, "Cita" combina fondo de un
// acento con texto del otro — no hay un 4° tono propio todavía.
const COLOR_TIPO: Record<ItemHoy["tipo"], { fondo: string; texto: string }> = {
  trabajo: { fondo: tokens.color.accentRamp["200"], texto: tokens.color.accentRamp["700"] },
  levantamiento: { fondo: tokens.color.accent2Ramp["200"], texto: tokens.color.accent2Ramp["800"] },
  viaje: { fondo: tokens.color.neutral["200"], texto: tokens.color.neutral["800"] },
  cita: { fondo: tokens.color.accent2Ramp["200"], texto: tokens.color.accentRamp["700"] },
};

const ETIQUETA_ESTADO: Record<string, string> = {
  pendiente: "Pendiente",
  enviada: "Enviada",
  en_proceso: "En proceso",
  completada: "Completada",
  firmada: "Firmada",
  cancelada: "Cancelado",
  cancelada_anticipada: "Cancelado",
  confirmada: "Confirmada",
  no_asistio: "No asistió",
  borrador: "Borrador",
  confirmado: "Confirmado",
  facturado: "Facturado",
  // Levantamientos (18-sep-2026) — los 3 estados que aparecen en la
  // Pizarra (los demás ya se filtran antes en services/hoy.ts).
  creado: "Creado",
  asignado: "Por completar",
  en_terreno: "En terreno",
};

// "Hoy" siempre muestra la fecha del día como antetítulo del
// ScreenHeader — misma fecha local que usa cargarHoy()/hoyISO(), no
// UTC (toISOString se corre en día equivocado cerca de medianoche).
function fechaDeHoy(): string {
  const d = new Date();
  const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return formatearFechaLarga(iso);
}

// Sistema visual móvil v2 (13-sep-2026, tarea #21, piloto 2) — antes
// PASO 6 del sistema de diseño ya la había migrado a @bitacora/ui/native
// + Lucide, pero con header nativo + fila de chips a mano. Ahora usa
// ScreenHeader (con antetítulo=fecha y los chips Míos/Equipo como
// `filtros`) y el Asistente se mueve del ícono del header al
// AsistenteButton flotante, gateado igual que en "Más" (antes el ícono
// del header no tenía ningún gating por plan — se corrige de paso).
//
// "Pizarra Digital" (18-sep-2026): solo cambia el título visible del
// ScreenHeader y la etiqueta de la tab bar (AppTabs.tsx) — el nombre
// interno (route key "Hoy", este componente, services/hoy.ts) no se
// tocó, no hacía falta.
export function HoyScreen({ navigation }: NativeStackScreenProps<HoyStackParamList, "HoyInicio">) {
  const auth = useAuth();
  const marca = useMarca();
  const esGestion = auth.fase === "listo" && auth.usuario.rol !== "colaborador";
  const incluirViajes = auth.fase === "listo" && !auth.modulosDeshabilitados.includes("viajes");
  const veAsistente = auth.fase === "listo" && auth.modulosVisibles.includes("asistente");
  // Mismo eje que en MasScreen.tsx: usuarios.funcion, no rol/módulo.
  const funcion = auth.fase === "listo" ? auth.usuario.funcion : null;
  const incluirLevantamientos = funcion != null && FUNCIONES_LEVANTAMIENTOS.includes(funcion);

  const [equipo, setEquipo] = useState(false);
  const [items, setItems] = useState<ItemHoy[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refrescando, setRefrescando] = useState(false);
  const [guardadoEn, setGuardadoEn] = useState<number | undefined>();

  const cargar = useCallback(async () => {
    setError(null);
    try {
      const r = await cargarHoy(esGestion && equipo, incluirViajes, incluirLevantamientos);
      setItems(r.items);
      setGuardadoEn(r.desdeCache ? r.guardadoEn : undefined);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo cargar el día");
    }
  }, [esGestion, equipo, incluirViajes, incluirLevantamientos]);

  useFocusEffect(
    useCallback(() => {
      void cargar();
    }, [cargar])
  );

  async function onRefresh() {
    setRefrescando(true);
    await cargar();
    setRefrescando(false);
  }

  function abrir(item: ItemHoy) {
    if (item.tipo === "trabajo") {
      navigation.navigate("Trabajos", { screen: "TrabajoDetalle", params: { trabajoId: item.id, titulo: item.titulo } });
    } else if (item.tipo === "cita") {
      navigation.navigate("Agenda", { screen: "TareaDetalle", params: { tareaId: item.id, titulo: item.titulo } });
    } else if (item.tipo === "viaje") {
      navigation.navigate("Viajes", { screen: "ViajeDetalle", params: { viajeId: item.id } });
    } else {
      navigation.navigate("LevantamientoDetalle", { id: item.id });
    }
  }

  const filtros = esGestion
    ? {
        opciones: [
          { valor: "mios", etiqueta: "Míos" },
          { valor: "equipo", etiqueta: "Equipo" },
        ],
        valor: equipo ? "equipo" : "mios",
        onCambio: (v: string) => setEquipo(v === "equipo"),
      }
    : undefined;

  // Esqueletos con la forma real de las tarjetas de la lista — nunca un
  // spinner de pantalla completa. El ScreenHeader se muestra igual
  // (misma fecha, mismos chips) para que la pantalla no "salte" al
  // terminar de cargar.
  if (items === null && !error) {
    return (
      <View style={{ flex: 1, backgroundColor: tokens.color.bg }}>
        <ScreenHeader antetitulo={fechaDeHoy()} titulo="Pizarra Digital" filtros={filtros} />
        <View style={{ padding: tokens.space["4"], gap: tokens.space["3"] }}>
          <LoadingState>
            <Skeleton alto={72} radio={32} />
            <Skeleton alto={72} radio={32} />
            <Skeleton alto={72} radio={32} />
          </LoadingState>
        </View>
        <AsistenteButton visible={veAsistente} onPress={() => navigation.navigate("Asistente")} />
      </View>
    );
  }
  if (error && !items) {
    return (
      <View style={{ flex: 1, backgroundColor: tokens.color.bg }}>
        <ScreenHeader antetitulo={fechaDeHoy()} titulo="Pizarra Digital" filtros={filtros} />
        <ErrorState mensaje={error} onReintentar={cargar} />
        <AsistenteButton visible={veAsistente} onPress={() => navigation.navigate("Asistente")} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: tokens.color.bg }}>
      <ScreenHeader antetitulo={fechaDeHoy()} titulo="Pizarra Digital" filtros={filtros} />
      <OfflineBanner guardadoEn={guardadoEn} />
      <FlatList
        data={items ?? []}
        keyExtractor={(item) => `${item.tipo}:${item.id}`}
        contentContainerStyle={{
          padding: tokens.space["4"],
          paddingTop: tokens.space["2"],
          paddingBottom: ESPACIO_ASISTENTE_FLOTANTE,
          gap: tokens.space["3"],
          flexGrow: 1,
        }}
        refreshControl={<RefreshControl refreshing={refrescando} onRefresh={onRefresh} tintColor={marca.base} />}
        ListEmptyComponent={
          <EmptyState
            icono={<Sun size={32} strokeWidth={2.75} color={tokens.color.accent2Ramp["800"]} />}
            titulo="Nada para hoy"
            mensaje={equipo ? "El equipo no tiene nada agendado hoy." : "No tienes trabajos, citas ni viajes hoy."}
          />
        }
        renderItem={({ item }) => {
          const Icono = ICONO[item.tipo];
          const color = COLOR_TIPO[item.tipo];
          return (
            <Card onPress={() => abrir(item)}>
              <View style={{ flexDirection: "row", alignItems: "flex-start", gap: tokens.space["3"] }}>
                <View style={{ width: 44, alignItems: "center", gap: 2 }}>
                  <Texto tamano={tokens.size.caption} color={tokens.color.text} peso="semibold">
                    {item.hora ?? "—"}
                  </Texto>
                  <Icono size={16} strokeWidth={2.75} color={color.texto} />
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <Texto tamano={tokens.size.body} color={tokens.color.text} peso="semibold">
                    {item.titulo}
                  </Texto>
                  {item.folio ? (
                    <View
                      style={{
                        alignSelf: "flex-start",
                        backgroundColor: color.fondo,
                        borderRadius: 5,
                        paddingHorizontal: 6,
                        paddingVertical: 1,
                      }}
                    >
                      <Texto tamano={tokens.size.micro} color={color.texto} peso="semibold">
                        {item.folio}
                      </Texto>
                    </View>
                  ) : null}
                  {item.subtitulo ? (
                    <Texto tamano={tokens.size.caption} color={`${tokens.color.text}99`} numberOfLines={1}>
                      {item.subtitulo}
                    </Texto>
                  ) : null}
                </View>
                {item.estado ? (
                  <StatusBadge estado={String(item.estado)} etiqueta={ETIQUETA_ESTADO[String(item.estado)] ?? String(item.estado)} />
                ) : null}
              </View>
            </Card>
          );
        }}
      />
      <AsistenteButton visible={veAsistente} onPress={() => navigation.navigate("Asistente")} />
    </View>
  );
}
