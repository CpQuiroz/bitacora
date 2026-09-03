import { useCallback, useEffect, useState } from "react";
import { Linking, ScrollView, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { useTema } from "../../theme";
import { EmptyState, ErrorState, LoadingScreen, Screen, Text } from "../../components/ui";
import { OfflineBanner } from "../../components/OfflineBanner";
import { obtenerRutaDelDia, type Parada } from "../../services/ruta";
import { MapaRuta } from "./MapaRuta";

const wazeUrl = (lat: number, lng: number) => `https://waze.com/ul?ll=${lat},${lng}&navigate=yes`;

export function RutaScreen() {
  const t = useTema();
  const [paradas, setParadas] = useState<Parada[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [guardadoEn, setGuardadoEn] = useState<number | undefined>();

  const cargar = useCallback(async () => {
    setError(null);
    try {
      const r = await obtenerRutaDelDia();
      setParadas(r.paradas);
      setGuardadoEn(r.desdeCache ? r.guardadoEn : undefined);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo cargar tu ruta de hoy");
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);
  useFocusEffect(useCallback(() => void cargar(), [cargar]));

  if (!paradas && !error) return <LoadingScreen />;
  if (error && !paradas) return <ErrorState mensaje={error} onReintentar={cargar} />;
  if (!paradas) return null;

  const conCoords = paradas.filter((p): p is Parada & { lat: number; lng: number } => p.lat != null && p.lng != null);
  const centro =
    conCoords.length > 0
      ? {
          latitude: conCoords.reduce((s, p) => s + p.lat, 0) / conCoords.length,
          longitude: conCoords.reduce((s, p) => s + p.lng, 0) / conCoords.length,
        }
      : { latitude: -33.45, longitude: -70.66 };
  const markers = conCoords.map((p) => ({ id: p.trabajo_id, coordinates: { latitude: p.lat, longitude: p.lng }, title: p.cliente_nombre }));

  return (
    <Screen padding={false}>
      <OfflineBanner guardadoEn={guardadoEn} />
      <View style={{ padding: t.espacio(5), paddingBottom: t.espacio(3) }}>
        <Text variante="titulo">Mi ruta de hoy</Text>
      </View>

      {conCoords.length > 0 ? <MapaRuta centro={centro} markers={markers} /> : null}

      <ScrollView contentContainerStyle={{ padding: t.espacio(5), gap: t.espacio(3), flexGrow: 1 }}>
        {paradas.length === 0 ? (
          <EmptyState
            icono={<Ionicons name="map-outline" size={40} color={t.colores.faint} />}
            titulo="Sin ruta hoy"
            mensaje="No tienes trabajos programados para hoy."
          />
        ) : (
          <>
            {conCoords.map((p, i) => (
              <View key={p.trabajo_id} style={{ flexDirection: "row", gap: t.espacio(3), paddingVertical: t.espacio(2) }}>
                <View
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: 12,
                    backgroundColor: t.colores.brand,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Text variante="caption" weight="bold" style={{ color: t.colores.brandForeground }}>
                    {i + 1}
                  </Text>
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text variante="subtitulo">{p.cliente_nombre}</Text>
                  <Text variante="etiqueta" tono="muted">
                    {p.direccion}
                  </Text>
                  <Text variante="etiqueta" tono="brand" weight="semibold" onPress={() => Linking.openURL(wazeUrl(p.lat, p.lng))}>
                    Abrir en Waze →
                  </Text>
                </View>
              </View>
            ))}
            {paradas
              .filter((p) => p.lat == null || p.lng == null)
              .map((p) => (
                <View key={p.trabajo_id} style={{ paddingVertical: t.espacio(2) }}>
                  <Text variante="subtitulo">{p.cliente_nombre}</Text>
                  <Text variante="etiqueta" tono="faint">
                    {p.direccion || "Sin dirección"} — sin coordenadas
                  </Text>
                </View>
              ))}
          </>
        )}
      </ScrollView>
    </Screen>
  );
}
