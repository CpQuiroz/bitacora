import { useEffect, useState } from "react";
import { AppleMaps, GoogleMaps } from "expo-maps";
import {
  ActivityIndicator,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { apiFetch } from "../lib/api";

type Parada = {
  trabajo_id: string;
  cliente_nombre: string;
  direccion: string;
  lat: number | null;
  lng: number | null;
};

function wazeUrl(lat: number, lng: number) {
  return `https://waze.com/ul?ll=${lat},${lng}&navigate=yes`;
}

export default function RutaScreen({ onVolver }: { onVolver: () => void }) {
  const [paradas, setParadas] = useState<Parada[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const res = await apiFetch("/api/rutas");
      if (!res.ok) {
        setError("No se pudo cargar tu ruta de hoy");
        return;
      }
      const body = await res.json();
      setParadas(body.paradas);
    })();
  }, []);

  if (error) {
    return (
      <View style={styles.centro}>
        <Text style={styles.error}>{error}</Text>
        <TouchableOpacity onPress={onVolver}>
          <Text style={styles.volver}>← Mis trabajos</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!paradas) {
    return (
      <View style={styles.centro}>
        <ActivityIndicator />
      </View>
    );
  }

  const conCoords = paradas.filter(
    (p): p is Parada & { lat: number; lng: number } => p.lat != null && p.lng != null
  );

  const markers = conCoords.map((p) => ({
    id: p.trabajo_id,
    coordinates: { latitude: p.lat, longitude: p.lng },
    title: p.cliente_nombre,
  }));

  const centro =
    conCoords.length > 0
      ? {
          latitude: conCoords.reduce((s, p) => s + p.lat, 0) / conCoords.length,
          longitude: conCoords.reduce((s, p) => s + p.lng, 0) / conCoords.length,
        }
      : { latitude: -33.45, longitude: -70.66 };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onVolver}>
          <Text style={styles.volver}>← Mis trabajos</Text>
        </TouchableOpacity>
        <Text style={styles.titulo}>Mi ruta de hoy</Text>
      </View>

      {conCoords.length > 0 ? (
        Platform.OS === "ios" ? (
          <AppleMaps.View
            style={styles.mapa}
            cameraPosition={{ coordinates: centro, zoom: 11 }}
            markers={markers}
          />
        ) : (
          <GoogleMaps.View
            style={styles.mapa}
            cameraPosition={{ coordinates: centro, zoom: 11 }}
            markers={markers}
          />
        )
      ) : (
        <View style={[styles.mapa, styles.centro]}>
          <Text style={styles.vacio}>Ningún trabajo de hoy tiene dirección con coordenadas.</Text>
        </View>
      )}

      <ScrollView style={styles.lista}>
        {paradas.length === 0 && <Text style={styles.vacio}>No tienes trabajos para hoy.</Text>}
        {conCoords.map((p, i) => (
          <View key={p.trabajo_id} style={styles.parada}>
            <View style={styles.numero}>
              <Text style={styles.numeroTexto}>{i + 1}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.cliente}>{p.cliente_nombre}</Text>
              <Text style={styles.direccion}>{p.direccion}</Text>
              <TouchableOpacity onPress={() => Linking.openURL(wazeUrl(p.lat, p.lng))}>
                <Text style={styles.link}>Abrir en Waze →</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))}
        {paradas
          .filter((p) => p.lat == null || p.lng == null)
          .map((p) => (
            <View key={p.trabajo_id} style={styles.parada}>
              <View style={{ flex: 1 }}>
                <Text style={styles.cliente}>{p.cliente_nombre}</Text>
                <Text style={styles.direccion}>
                  {p.direccion || "Sin dirección"} — sin coordenadas
                </Text>
              </View>
            </View>
          ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff", paddingTop: 60 },
  centro: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#fff", gap: 12, padding: 20 },
  header: { paddingHorizontal: 20, marginBottom: 12 },
  volver: { color: "#007aff" },
  titulo: { fontSize: 22, fontWeight: "600", marginTop: 8 },
  mapa: { height: 260, marginHorizontal: 20, borderRadius: 12, overflow: "hidden" },
  lista: { flex: 1, marginTop: 16, paddingHorizontal: 20 },
  parada: { flexDirection: "row", gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "#eee" },
  numero: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#000",
    alignItems: "center",
    justifyContent: "center",
  },
  numeroTexto: { color: "#fff", fontSize: 12, fontWeight: "600" },
  cliente: { fontWeight: "600" },
  direccion: { color: "#666", fontSize: 12, marginTop: 1 },
  link: { color: "#007aff", fontSize: 12, marginTop: 4, fontWeight: "500" },
  error: { color: "#c00" },
  vacio: { color: "#666", textAlign: "center" },
});
