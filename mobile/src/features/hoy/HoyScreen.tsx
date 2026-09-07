import { useCallback, useLayoutEffect, useState } from "react";
import { FlatList, Pressable, RefreshControl, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useTema } from "../../theme";
import { Badge, Card, EmptyState, ErrorState, LoadingScreen, Text } from "../../components/ui";
import { OfflineBanner } from "../../components/OfflineBanner";
import { useAuth } from "../auth/AuthContext";
import { cargarHoy, type ItemHoy } from "../../services/hoy";
import type { HoyStackParamList } from "../../shell/navigation/types";

const ICONO: Record<ItemHoy["tipo"], keyof typeof Ionicons.glyphMap> = {
  trabajo: "clipboard-outline",
  cita: "calendar-outline",
  viaje: "car-outline",
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

export function HoyScreen({ navigation }: NativeStackScreenProps<HoyStackParamList, "HoyInicio">) {
  const t = useTema();
  const auth = useAuth();
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
          <Ionicons name="sparkles-outline" size={22} color={t.colores.brand} />
        </Pressable>
      ),
    });
  }, [navigation, t.colores.brand]);

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

  if (items === null && !error) return <LoadingScreen />;
  if (error && !items) return <ErrorState mensaje={error} onReintentar={cargar} />;

  return (
    <View style={{ flex: 1, backgroundColor: t.colores.bg }}>
      <OfflineBanner guardadoEn={guardadoEn} />
      {esGestion && (
        <View
          style={{
            flexDirection: "row",
            gap: t.espacio(2),
            paddingHorizontal: t.espacio(4),
            paddingBottom: t.espacio(2),
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
                  borderRadius: t.radio.md,
                  backgroundColor: activo ? t.colores.surfaceAlt : "transparent",
                  borderWidth: 1,
                  borderColor: activo ? t.colores.border : "transparent",
                }}
              >
                <Text variante="caption" weight="semibold" tono={activo ? "normal" : "muted"}>
                  {op}
                </Text>
              </Pressable>
            );
          })}
        </View>
      )}
      <FlatList
        data={items ?? []}
        keyExtractor={(item) => `${item.tipo}:${item.id}`}
        contentContainerStyle={{ padding: t.espacio(4), paddingTop: t.espacio(2), paddingBottom: t.espacio(10), gap: t.espacio(3), flexGrow: 1 }}
        refreshControl={<RefreshControl refreshing={refrescando} onRefresh={onRefresh} tintColor={t.colores.brand} />}
        ListEmptyComponent={
          <EmptyState
            icono={<Ionicons name="sunny-outline" size={40} color={t.colores.faint} />}
            titulo="Nada para hoy"
            mensaje={equipo ? "El equipo no tiene nada agendado hoy." : "No tienes trabajos, citas ni viajes hoy."}
          />
        }
        renderItem={({ item }) => (
          <Card onPress={() => abrir(item)}>
            <View style={{ flexDirection: "row", alignItems: "flex-start", gap: t.espacio(3) }}>
              <View style={{ width: 44, alignItems: "center", gap: 2 }}>
                <Text variante="etiqueta" weight="bold">
                  {item.hora ?? "—"}
                </Text>
                <Ionicons name={ICONO[item.tipo]} size={16} color={t.colores.faint} />
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <Text variante="subtitulo">{item.titulo}</Text>
                {item.subtitulo ? (
                  <Text variante="caption" tono="muted" numberOfLines={1}>
                    {item.subtitulo}
                  </Text>
                ) : null}
              </View>
              {item.estado ? (
                <Badge
                  estado={String(item.estado)}
                  texto={ETIQUETA_ESTADO[String(item.estado)] ?? String(item.estado)}
                />
              ) : null}
            </View>
          </Card>
        )}
      />
    </View>
  );
}
