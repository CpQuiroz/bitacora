import { Component, type ReactNode } from "react";
import { Platform, View } from "react-native";
import Constants from "expo-constants";
import { AppleMaps, GoogleMaps } from "expo-maps";
import { useTema } from "../../theme";
import { Text } from "../../components/ui";

type Marker = { id: string; coordinates: { latitude: number; longitude: number }; title: string };

// expo-maps es un módulo nativo — NO funciona en Expo Go, solo en un
// development build o en la app compilada. En Expo Go se muestra un
// placeholder para que la pantalla igual sea usable (la lista de
// paradas + los links a Waze siguen andando).
const enExpoGo = Constants.appOwnership === "expo";

class LimiteError extends Component<{ children: ReactNode; fallback: ReactNode }, { fallo: boolean }> {
  state = { fallo: false };
  static getDerivedStateFromError() {
    return { fallo: true };
  }
  render() {
    return this.state.fallo ? this.props.fallback : this.props.children;
  }
}

export function MapaRuta({
  centro,
  markers,
  alto = 260,
}: {
  centro: { latitude: number; longitude: number };
  markers: Marker[];
  alto?: number;
}) {
  const t = useTema();

  const placeholder = (
    <View
      style={{
        height: alto,
        marginHorizontal: t.espacio(5),
        borderRadius: t.radio.lg,
        backgroundColor: t.colores.surface,
        borderWidth: 1,
        borderColor: t.colores.border,
        alignItems: "center",
        justifyContent: "center",
        padding: t.espacio(4),
      }}
    >
      <Text variante="etiqueta" tono="muted" style={{ textAlign: "center" }}>
        El mapa se ve en la app instalada (no en Expo Go).
      </Text>
    </View>
  );

  if (enExpoGo) return placeholder;

  return (
    <LimiteError fallback={placeholder}>
      <View style={{ height: alto, marginHorizontal: t.espacio(5), borderRadius: t.radio.lg, overflow: "hidden" }}>
        {Platform.OS === "ios" ? (
          <AppleMaps.View style={{ flex: 1 }} cameraPosition={{ coordinates: centro, zoom: 11 }} markers={markers} />
        ) : (
          <GoogleMaps.View style={{ flex: 1 }} cameraPosition={{ coordinates: centro, zoom: 11 }} markers={markers} />
        )}
      </View>
    </LimiteError>
  );
}
