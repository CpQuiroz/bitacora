import { useCallback, useEffect, useState } from "react";
import { Linking, Platform, Pressable, ScrollView, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { useTema } from "../../theme";
import { EmptyState, ErrorState, LoadingScreen, Screen, Text } from "../../components/ui";
import { OfflineBanner } from "../../components/OfflineBanner";
import { obtenerRutaDelDia, type Parada } from "../../services/ruta";
import { MapaRuta } from "./MapaRuta";

function abrirNavegacion(p: { lat?: number | null; lng?: number | null; direccion?: string | null }) {
  const destino =
    p.lat != null && p.lng != null ? `${p.lat},${p.lng}` : p.direccion ? encodeURIComponent(p.direccion) : null;
  if (!destino) return;
  const url = Platform.select({
    ios: `http://maps.apple.com/?daddr=${destino}`,
    default: `https://www.google.com/maps/dir/?api=1&destination=${destino}`,
  });
  Linking.openURL(url!);
}

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
  const sinCoords = paradas.filter((p) => p.lat == null || p.lng == null);
  const centro =
    conCoords.length > 0
      ? {
          latitude: conCoords.reduce((s, p) => s + p.lat, 0) / conCoords.length,
          longitude: conCoords.reduce((s, p) => s + p.lng, 0) / conCoords.length,
        }
      : { latitude: -33.45, longitude: -70.66 };
  const markers = conCoords.map((p) => ({
    id: p.trabajo_id,
    coordinates: { latitude: p.lat, longitude: p.lng },
    title: p.cliente_nombre,
  }));

  return (
    <Screen padding={false}>
      <OfflineBanner guardadoEn={guardadoEn} />
      <View style={{ padding: t.espacio(5), paddingBottom: t.espacio(3) }}>
        <Text variante="titulo">Mi ruta de hoy</Text>
        {paradas.length > 0 ? (
          <Text variante="etiqueta" tono="muted" style={{ marginTop: 2 }}>
            {paradas.length} {paradas.length === 1 ? "parada" : "paradas"}
          </Text>
        ) : null}
      </View>

      {conCoords.length > 0 ? <MapaRuta centro={centro} markers={markers} /> : null}

      <ScrollView contentContainerStyle={{ padding: t.espacio(5), gap: t.espacio(2), flexGrow: 1 }}>
        {paradas.length === 0 ? (
          <EmptyState
            icono={<Ionicons name="map-outline" size={40} color={t.colores.faint} />}
            titulo="Sin ruta hoy"
            mensaje="No tienes trabajos programados para hoy."
          />
        ) : (
          <>
            {conCoords.map((p, i) => {
              const actual = i === 0; // la primera parada = "siguiente a visitar"
              return (
              <Pressable
                key={p.trabajo_id}
                onPress={() => abrirNavegacion(p)}
                style={({ pressed }) => ({
                  flexDirection: "row",
                  gap: t.espacio(3),
                  paddingVertical: t.espacio(3),
                  paddingLeft: actual ? t.espacio(2.5) : 0,
                  borderLeftWidth: actual ? 3 : 0,
                  borderLeftColor: t.colores.accent,
                  minHeight: 56,
                  opacity: pressed ? 0.6 : 1,
                })}
              >
                <View
                  style={{
                    width: 26,
                    height: 26,
                    borderRadius: 13,
                    backgroundColor: actual ? t.colores.accent : t.colores.brand,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Text variante="caption" weight="bold" tono="inverso">
                    {i + 1}
                  </Text>
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text variante="subtitulo">{p.cliente_nombre}</Text>
                  {p.direccion ? (
                    <Text variante="etiqueta" tono="muted">
                      {p.direccion}
                    </Text>
                  ) : null}
                </View>
                <Ionicons name="navigate-outline" size={20} color={t.colores.brand} style={{ alignSelf: "center" }} />
              </Pressable>
              );
            })}
            {sinCoords.length > 0 && (
              <View style={{ marginTop: t.espacio(3), gap: t.espacio(2) }}>
                <Text variante="caption" tono="muted" weight="semibold" style={{ textTransform: "uppercase" }}>
                  Sin ubicación en el mapa
                </Text>
                {sinCoords.map((p) => (
                  <Pressable
                    key={p.trabajo_id}
                    onPress={() => p.direccion && abrirNavegacion(p)}
                    style={{ paddingVertical: t.espacio(2.5), minHeight: 44 }}
                  >
                    <Text variante="subtitulo">{p.cliente_nombre}</Text>
                    <Text variante="etiqueta" tono="muted">
                      {p.direccion || "Sin dirección registrada"}
                    </Text>
                  </Pressable>
                ))}
              </View>
            )}
          </>
        )}
      </ScrollView>
    </Screen>
  );
}
