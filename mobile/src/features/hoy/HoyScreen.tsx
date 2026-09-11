import { useCallback, useLayoutEffect, useState } from "react";
import { FlatList, Pressable, RefreshControl, View } from "react-native";
import { Sparkles, CalendarClock, Car, ClipboardList, Sun } from "lucide-react-native";
import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { tokens } from "@bitacora/design-tokens";
import { Card, EmptyState, ErrorState, LoadingState, Skeleton, StatusBadge, Texto, useMarca } from "@bitacora/ui/native";
import { OfflineBanner } from "../../components/OfflineBanner";
import { useAuth } from "../auth/AuthContext";
import { cargarHoy, type ItemHoy } from "../../services/hoy";
import type { HoyStackParamList } from "../../shell/navigation/types";

const ICONO: Record<ItemHoy["tipo"], typeof ClipboardList> = {
  trabajo: ClipboardList,
  cita: CalendarClock,
  viaje: Car,
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
};

// PASO 6 (sistema de diseño) — migrado. Ver docs/design-system.md.
export function HoyScreen({ navigation }: NativeStackScreenProps<HoyStackParamList, "HoyInicio">) {
  const auth = useAuth();
  const marca = useMarca();
  const esGestion = auth.fase === "listo" && auth.usuario.rol !== "colaborador";
  const incluirViajes = auth.fase === "listo" && !auth.modulosDeshabilitados.includes("viajes");

  const [equipo, setEquipo] = useState(false);
  const [items, setItems] = useState<ItemHoy[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refrescando, setRefrescando] = useState(false);
  const [guardadoEn, setGuardadoEn] = useState<number | undefined>();

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <Pressable
          onPress={() => navigation.navigate("Asistente")}
          hitSlop={10}
          accessibilityLabel="Asistente IA"
          style={{ paddingHorizontal: 4 }}
        >
          <Sparkles size={22} strokeWidth={2.75} color={marca.base} />
        </Pressable>
      ),
    });
  }, [navigation, marca.base]);

  const cargar = useCallback(async () => {
    setError(null);
    try {
      const r = await cargarHoy(esGestion && equipo, incluirViajes);
      setItems(r.items);
      setGuardadoEn(r.desdeCache ? r.guardadoEn : undefined);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo cargar el día");
    }
  }, [esGestion, equipo, incluirViajes]);

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
    } else {
      navigation.navigate("Viajes", { screen: "ViajeDetalle", params: { viajeId: item.id } });
    }
  }

  // Esqueletos con la forma real de las tarjetas de la lista — nunca un
  // spinner de pantalla completa.
  if (items === null && !error) {
    return (
      <View style={{ flex: 1, backgroundColor: tokens.color.bg, padding: tokens.space["4"], gap: tokens.space["3"] }}>
        <LoadingState>
          <Skeleton alto={72} radio={32} />
          <Skeleton alto={72} radio={32} />
          <Skeleton alto={72} radio={32} />
        </LoadingState>
      </View>
    );
  }
  if (error && !items) {
    return (
      <View style={{ flex: 1, backgroundColor: tokens.color.bg }}>
        <ErrorState mensaje={error} onReintentar={cargar} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: tokens.color.bg }}>
      <OfflineBanner guardadoEn={guardadoEn} />
      {esGestion ? (
        <View
          style={{
            flexDirection: "row",
            gap: tokens.space["2"],
            paddingHorizontal: tokens.space["4"],
            paddingBottom: tokens.space["2"],
          }}
        >
          {(["Míos", "Equipo"] as const).map((op, i) => {
            const activo = (i === 1) === equipo;
            return (
              <Pressable
                key={op}
                onPress={() => setEquipo(i === 1)}
                style={{
                  flex: 1,
                  minHeight: 40,
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: tokens.radius.pill,
                  backgroundColor: activo ? tokens.color.surface : "transparent",
                  borderWidth: 1,
                  borderColor: activo ? tokens.color.divider : "transparent",
                }}
              >
                <Texto tamano={tokens.size.caption} color={activo ? tokens.color.text : `${tokens.color.text}99`} peso="semibold">
                  {op}
                </Texto>
              </Pressable>
            );
          })}
        </View>
      ) : null}
      <FlatList
        data={items ?? []}
        keyExtractor={(item) => `${item.tipo}:${item.id}`}
        contentContainerStyle={{
          padding: tokens.space["4"],
          paddingTop: tokens.space["2"],
          paddingBottom: tokens.space["8"],
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
          return (
            <Card onPress={() => abrir(item)}>
              <View style={{ flexDirection: "row", alignItems: "flex-start", gap: tokens.space["3"] }}>
                <View style={{ width: 44, alignItems: "center", gap: 2 }}>
                  <Texto tamano={tokens.size.caption} color={tokens.color.text} peso="semibold">
                    {item.hora ?? "—"}
                  </Texto>
                  <Icono size={16} strokeWidth={2.75} color={`${tokens.color.text}66`} />
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <Texto tamano={tokens.size.body} color={tokens.color.text} peso="semibold">
                    {item.titulo}
                  </Texto>
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
    </View>
  );
}
