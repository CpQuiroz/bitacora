import { useEffect, useState } from "react";
import { StatusBar } from "expo-status-bar";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./lib/supabase";
import LoginScreen from "./screens/LoginScreen";
import TrabajosScreen from "./screens/TrabajosScreen";
import TrabajoDetalleScreen from "./screens/TrabajoDetalleScreen";

export default function App() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [trabajoSeleccionado, setTrabajoSeleccionado] = useState<string | null>(null);
  const [senalRecarga, setSenalRecarga] = useState(0);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, nuevaSesion) => {
      setSession(nuevaSesion);
      setTrabajoSeleccionado(null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  if (session === undefined) {
    return (
      <View style={styles.centro}>
        <ActivityIndicator />
        <StatusBar style="auto" />
      </View>
    );
  }

  if (!session) {
    return (
      <View style={styles.container}>
        <LoginScreen />
        <StatusBar style="auto" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {trabajoSeleccionado ? (
        <TrabajoDetalleScreen
          trabajoId={trabajoSeleccionado}
          onVolver={() => {
            setTrabajoSeleccionado(null);
            setSenalRecarga((n) => n + 1);
          }}
        />
      ) : (
        <TrabajosScreen onSeleccionar={setTrabajoSeleccionado} senalRecarga={senalRecarga} />
      )}
      <StatusBar style="auto" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  centro: { flex: 1, backgroundColor: "#fff", alignItems: "center", justifyContent: "center" },
});
