import { View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTema } from "../../theme";
import { Text } from "../../components/ui";

type Marker = { id: string; coordinates: { latitude: number; longitude: number }; title: string };

// El mapa nativo (expo-maps) se quitó por ahora: en Android necesita una
// Google Maps API key en el build y sin ella tumbaba la app con un crash
// nativo (que el ErrorBoundary de React no atrapa). La utilidad real de
// la pantalla —la lista de paradas y el botón "abrir navegación" de cada
// una— vive en RutaScreen y sigue funcionando. Cuando haya una API key,
// se puede reponer expo-maps acá.
export function MapaRuta({ markers, alto = 140 }: { centro?: unknown; markers: Marker[]; alto?: number }) {
  const t = useTema();
  return (
    <View
      style={{
        minHeight: alto,
        marginHorizontal: t.espacio(5),
        borderRadius: t.radio.lg,
        backgroundColor: t.colores.surface,
        borderWidth: 1,
        borderColor: t.colores.border,
        alignItems: "center",
        justifyContent: "center",
        gap: t.espacio(2),
        padding: t.espacio(4),
      }}
    >
      <Ionicons name="navigate-circle-outline" size={28} color={t.colores.muted} />
      <Text variante="etiqueta" tono="muted" style={{ textAlign: "center" }}>
        {markers.length} parada{markers.length === 1 ? "" : "s"} con ubicación. Toca cada una abajo para abrir la
        navegación.
      </Text>
    </View>
  );
}
