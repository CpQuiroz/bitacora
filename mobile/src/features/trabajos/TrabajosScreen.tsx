import { useCallback, useEffect, useState } from "react";
import { FlatList, Pressable, RefreshControl, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { Trabajo } from "@bitacora/shared";
import { useTema } from "../../theme";
import { Badge, Card, EmptyState, ErrorState, LoadingScreen, Text } from "../../components/ui";
import { OfflineBanner } from "../../components/OfflineBanner";
import { useAuth } from "../auth/AuthContext";
import { listarTrabajos } from "../../services/trabajos";
import type { TrabajosStackParamList } from "../../shell/navigation/types";

export function TrabajosScreen({ navigation }: NativeStackScreenProps<TrabajosStackParamList, "TrabajosLista">) {
  const t = useTema();
  const auth = useAuth();
  const esGestion = auth.fase === "listo" && auth.usuario.rol !== "colaborador";

  const [equipo, setEquipo] = useState(false);
  const [trabajos, setTrabajos] = useState<Trabajo[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refrescando, setRefrescando] = useState(false);
  const [guardadoEn, setGuardadoEn] = useState<number | undefined>();

  const cargar = useCallback(async () => {
    setError(null);
    try {
      const r = await listarTrabajos(esGestion && equipo);
      setTrabajos(r.trabajos);
      setGuardadoEn(r.desdeCache ? r.guardadoEn : undefined);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudieron cargar tus trabajos");
    }
  }, [esGestion, equipo]);

  useEffect(() => {
    setTrabajos(null);
    cargar();
  }, [cargar]);

  useFocusEffect(useCallback(() => void cargar(), [cargar]));

  async function onRefresh() {
    setRefrescando(true);
    await cargar();
    setRefrescando(false);
  }

  if (trabajos === null && !error) return <LoadingScreen />;
  if (error && !trabajos) return <ErrorState mensaje={error} onReintentar={cargar} />;

  return (
    <View style={{ flex: 1, backgroundColor: t.colores.bg }}>
      <OfflineBanner guardadoEn={guardadoEn} />
      {esGestion && (
        <View
          style={{
            flexDirection: "row",
            gap: t.espacio(2),
            padding: t.espacio(4),
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
                  minHeight: 44,
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: t.radio.md,
                  backgroundColor: activo ? t.colores.brand : t.colores.surface,
                  borderWidth: 1,
                  borderColor: activo ? t.colores.brand : t.colores.border,
                }}
              >
                <Text variante="etiqueta" weight="semibold" tono={activo ? "inverso" : "muted"}>
                  {op}
                </Text>
              </Pressable>
            );
          })}
        </View>
      )}
      <FlatList
        data={trabajos ?? []}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: t.espacio(4), paddingBottom: t.espacio(10), gap: t.espacio(3), flexGrow: 1 }}
        refreshControl={<RefreshControl refreshing={refrescando} onRefresh={onRefresh} tintColor={t.colores.brand} />}
        ListEmptyComponent={
          <EmptyState
            icono={<Ionicons name="clipboard-outline" size={40} color={t.colores.faint} />}
            titulo="Sin trabajos"
            mensaje={equipo ? "El equipo no tiene trabajos asignados." : "No tienes trabajos asignados."}
          />
        }
        renderItem={({ item }) => (
          <Card onPress={() => navigation.navigate("TrabajoDetalle", { trabajoId: item.id, titulo: item.cliente })}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: t.espacio(3) }}>
              <View style={{ flex: 1, gap: t.espacio(1) }}>
                <Text variante="subtitulo">{item.cliente}</Text>
                <Text variante="etiqueta" tono="muted">
                  {item.fecha}
                  {item.hora_programada ? ` · ${item.hora_programada.slice(0, 5)}` : ""}
                </Text>
                {item.ubicacion ? (
                  <Text variante="caption" tono="muted" numberOfLines={1}>
                    {item.ubicacion}
                  </Text>
                ) : null}
              </View>
              <Badge estado={item.estado} />
            </View>
          </Card>
        )}
      />
    </View>
  );
}
