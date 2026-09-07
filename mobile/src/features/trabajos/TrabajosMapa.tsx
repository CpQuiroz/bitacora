import { useCallback, useEffect, useMemo, useState } from "react";
import { Linking, Platform, Pressable, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { useTema } from "../../theme";
import { Button, ErrorState, LoadingScreen, Text } from "../../components/ui";
import { obtenerRutaDelDia, type Parada } from "../../services/ruta";
import { distanciaMetros, ubicacionActual } from "../../lib/geo";
import { MapaLienzo, type PuntoMapa } from "./MapaLienzo";

function abrirNavegacion(p: { lat?: number | null; lng?: number | null; direccion?: string | null }) {
  const destino = p.lat != null && p.lng != null ? `${p.lat},${p.lng}` : p.direccion ? encodeURIComponent(p.direccion) : null;
  if (!destino) return;
  const url = Platform.select({
    ios: `http://maps.apple.com/?daddr=${destino}`,
    default: `https://www.google.com/maps/dir/?api=1&destination=${destino}`,
  });
  Linking.openURL(url!);
}

function textoDistancia(m: number): string {
  return m < 1000 ? `${m} m` : `${(m / 1000).toFixed(1)} km`;
}

// Velocidad urbana promedio para el estimado — deliberadamente
// conservadora, sin tráfico en vivo (no hay API de ruteo).
function textoTiempo(m: number): string {
  const min = Math.max(1, Math.round((m / 1000 / 24) * 60));
  return min < 60 ? `${min} min` : `${Math.floor(min / 60)} h ${min % 60} min`;
}

export function TrabajosMapa({ onVerOS }: { onVerOS: (trabajoId: string) => void }) {
  const t = useTema();
  const [paradas, setParadas] = useState<Parada[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [yo, setYo] = useState<{ lat: number; lng: number } | null>(null);
  const [seleccion, setSeleccion] = useState<string | undefined>();

  const cargar = useCallback(async () => {
    setError(null);
    try {
      const r = await obtenerRutaDelDia();
      setParadas(r.paradas);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo cargar tu ruta de hoy");
    }
  }, []);

  useEffect(() => {
    void cargar();
    void ubicacionActual().then((u) => u && setYo({ lat: u.lat, lng: u.lng }));
  }, [cargar]);
  useFocusEffect(useCallback(() => void cargar(), [cargar]));

  const conCoords = useMemo(
    () => (paradas ?? []).filter((p): p is Parada & { lat: number; lng: number } => p.lat != null && p.lng != null),
    [paradas]
  );

  const puntos: PuntoMapa[] = useMemo(
    () => conCoords.map((p, i) => ({ id: p.trabajo_id, lat: p.lat, lng: p.lng, numero: i + 1, activo: i === 0 })),
    [conCoords]
  );

  if (!paradas && !error) return <LoadingScreen />;
  if (error && !paradas) return <ErrorState mensaje={error} onReintentar={cargar} />;

  const seleccionada = conCoords.find((p) => p.trabajo_id === seleccion) ?? conCoords[0] ?? null;
  const distancia = seleccionada && yo ? distanciaMetros(yo, { lat: seleccionada.lat, lng: seleccionada.lng }) : null;

  return (
    <View style={{ flex: 1, backgroundColor: t.colores.bg }}>
      <MapaLienzo puntos={puntos} posicionPropia={yo} seleccionId={seleccionada?.trabajo_id} onSeleccionar={setSeleccion} />

      {seleccionada ? (
        <View
          style={{
            position: "absolute",
            left: t.espacio(3),
            right: t.espacio(3),
            bottom: t.espacio(3),
            backgroundColor: t.colores.surface,
            borderRadius: t.radio.lg,
            borderWidth: 1,
            borderColor: t.colores.border,
            padding: t.espacio(4),
            gap: t.espacio(3),
            ...t.sombra.flotante,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: t.espacio(2) }}>
            <View
              style={{
                width: 24,
                height: 24,
                borderRadius: 12,
                backgroundColor: t.colores.accent,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Text variante="caption" weight="bold" tono="inverso">
                {(conCoords.findIndex((p) => p.trabajo_id === seleccionada.trabajo_id) ?? 0) + 1}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text variante="subtitulo" numberOfLines={1}>
                {seleccionada.cliente_nombre}
              </Text>
              {seleccionada.direccion ? (
                <Text variante="caption" tono="muted" numberOfLines={1}>
                  {seleccionada.direccion}
                </Text>
              ) : null}
            </View>
          </View>

          {distancia != null ? (
            <View style={{ flexDirection: "row", gap: t.espacio(4) }}>
              <View>
                <Text variante="caption" tono="faint" style={{ textTransform: "uppercase", letterSpacing: 0.8 }}>
                  Distancia
                </Text>
                <Text variante="cifra" style={{ fontSize: 18 }}>
                  {textoDistancia(distancia)}
                </Text>
              </View>
              <View>
                <Text variante="caption" tono="faint" style={{ textTransform: "uppercase", letterSpacing: 0.8 }}>
                  Estimado
                </Text>
                <Text variante="cifra" style={{ fontSize: 18 }}>
                  {textoTiempo(distancia)}
                </Text>
              </View>
            </View>
          ) : null}

          <View style={{ flexDirection: "row", gap: t.espacio(2) }}>
            <Button
              titulo="Navegar"
              onPress={() => abrirNavegacion(seleccionada)}
              icono={<Ionicons name="navigate" size={16} color={t.colores.brandForeground} />}
              style={{ flex: 1 }}
            />
            <Button titulo="Ver OS" variante="secundario" onPress={() => onVerOS(seleccionada.trabajo_id)} style={{ flex: 1 }} />
          </View>
        </View>
      ) : (
        <View
          style={{
            position: "absolute",
            left: t.espacio(3),
            right: t.espacio(3),
            bottom: t.espacio(3),
            backgroundColor: t.colores.surface,
            borderRadius: t.radio.lg,
            borderWidth: 1,
            borderColor: t.colores.border,
            padding: t.espacio(4),
          }}
        >
          <Text variante="etiqueta" tono="muted">
            No hay paradas con ubicación para hoy.
          </Text>
        </View>
      )}
    </View>
  );
}
