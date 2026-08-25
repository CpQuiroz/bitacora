import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import type { Trabajo } from "@bitacora/shared";
import { apiFetch } from "../lib/api";
import { supabase } from "../lib/supabase";

export default function TrabajosScreen({
  onSeleccionar,
  senalRecarga,
}: {
  onSeleccionar: (id: string) => void;
  senalRecarga: number;
}) {
  const [trabajos, setTrabajos] = useState<Trabajo[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setError(null);
    const res = await apiFetch("/api/trabajos?propio=true");
    if (!res.ok) {
      setError("No se pudieron cargar tus trabajos");
      setCargando(false);
      return;
    }
    setTrabajos(await res.json());
    setCargando(false);
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar, senalRecarga]);

  async function cerrarSesion() {
    await supabase.auth.signOut();
  }

  if (cargando) {
    return (
      <View style={styles.centro}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.titulo}>Mis trabajos</Text>
        <TouchableOpacity onPress={cerrarSesion}>
          <Text style={styles.salir}>Salir</Text>
        </TouchableOpacity>
      </View>
      {error && <Text style={styles.error}>{error}</Text>}
      <FlatList
        data={trabajos}
        keyExtractor={(t) => t.id}
        refreshControl={<RefreshControl refreshing={false} onRefresh={cargar} />}
        ListEmptyComponent={<Text style={styles.vacio}>No tienes trabajos asignados.</Text>}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.fila} onPress={() => onSeleccionar(item.id)}>
            <View>
              <Text style={styles.cliente}>{item.cliente}</Text>
              <Text style={styles.detalle}>
                {item.fecha} · ${item.monto.toLocaleString("es-CL")}
              </Text>
            </View>
            <Text style={styles.estado}>{item.estado}</Text>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff", paddingTop: 60 },
  centro: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#fff" },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  titulo: { fontSize: 24, fontWeight: "600" },
  salir: { color: "#c00" },
  error: { color: "#c00", textAlign: "center", marginBottom: 8 },
  vacio: { textAlign: "center", color: "#666", marginTop: 40 },
  fila: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  cliente: { fontSize: 16, fontWeight: "500" },
  detalle: { color: "#666", marginTop: 2 },
  estado: { color: "#666", textTransform: "capitalize" },
});
