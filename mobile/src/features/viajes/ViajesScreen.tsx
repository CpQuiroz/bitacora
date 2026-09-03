import { useCallback, useEffect, useState } from "react";
import { FlatList, RefreshControl, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useTema } from "../../theme";
import { Badge, Button, Card, EmptyState, ErrorState, LoadingScreen, Text } from "../../components/ui";
import { OfflineBanner } from "../../components/OfflineBanner";
import { useRed } from "../../services/sync/NetworkProvider";
import { listarViajesPropios, type ViajeConDatos } from "../../services/viajes";
import type { ViajesStackParamList } from "../../shell/navigation/types";

export function ViajesScreen({ navigation }: NativeStackScreenProps<ViajesStackParamList, "ViajesLista">) {
  const t = useTema();
  const red = useRed();
  const pendientes = red.pendientes.filter((a) => a.recurso === "viajes").length;
  const fallidos = red.fallidas.filter((a) => a.recurso === "viajes").length;

  const [viajes, setViajes] = useState<ViajeConDatos[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refrescando, setRefrescando] = useState(false);
  const [guardadoEn, setGuardadoEn] = useState<number | undefined>();

  const cargar = useCallback(async () => {
    setError(null);
    try {
      const r = await listarViajesPropios();
      setViajes(r.viajes);
      setGuardadoEn(r.desdeCache ? r.guardadoEn : undefined);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudieron cargar tus viajes");
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);
  useFocusEffect(useCallback(() => void cargar(), [cargar]));

  async function onRefresh() {
    setRefrescando(true);
    await cargar();
    setRefrescando(false);
  }

  if (viajes === null && !error) return <LoadingScreen />;
  if (error && !viajes) return <ErrorState mensaje={error} onReintentar={cargar} />;

  return (
    <View style={{ flex: 1, backgroundColor: t.colores.bg }}>
      <OfflineBanner guardadoEn={guardadoEn} />
      <View style={{ padding: t.espacio(4) }}>
        <Button titulo="Nuevo viaje" onPress={() => navigation.navigate("ViajeForm")} />
        {fallidos > 0 ? (
          <Text variante="caption" tono="danger" style={{ marginTop: t.espacio(2) }}>
            {fallidos} viaje{fallidos === 1 ? "" : "s"} no se pudo enviar — revísalo en Perfil
          </Text>
        ) : pendientes > 0 ? (
          <Text variante="caption" tono="muted" style={{ marginTop: t.espacio(2) }}>
            {pendientes} viaje{pendientes === 1 ? "" : "s"} sin sincronizar
          </Text>
        ) : null}
      </View>
      <FlatList
        data={viajes ?? []}
        keyExtractor={(v) => v.id}
        contentContainerStyle={{ padding: t.espacio(4), paddingTop: 0, paddingBottom: t.espacio(10), gap: t.espacio(3), flexGrow: 1 }}
        refreshControl={<RefreshControl refreshing={refrescando} onRefresh={onRefresh} tintColor={t.colores.brand} />}
        ListEmptyComponent={
          <EmptyState
            icono={<Ionicons name="car-outline" size={40} color={t.colores.faint} />}
            titulo="Sin viajes"
            mensaje="Registra tu primer viaje con el botón de arriba."
          />
        }
        renderItem={({ item }) => (
          <Card>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: t.espacio(3) }}>
              <View style={{ flex: 1, gap: 2 }}>
                <Text variante="subtitulo">{item.cliente_info?.nombre ?? item.cliente}</Text>
                <Text variante="etiqueta" tono="muted">
                  {item.fecha} · Guía {item.numero_guia}
                </Text>
                <Text variante="caption" tono="muted">
                  {item.origen} → {item.destino}
                </Text>
              </View>
              <View style={{ alignItems: "flex-end", gap: 4 }}>
                <Badge estado={item.estado} />
                <Text variante="etiqueta" weight="semibold">
                  ${Math.round(item.total).toLocaleString("es-CL")}
                </Text>
              </View>
            </View>
          </Card>
        )}
      />
    </View>
  );
}
