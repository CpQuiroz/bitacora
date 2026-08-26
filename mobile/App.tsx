import { useEffect, useState } from "react";
import { StatusBar } from "expo-status-bar";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./lib/supabase";
import LoginScreen from "./screens/LoginScreen";
import TrabajosScreen from "./screens/TrabajosScreen";
import TrabajoDetalleScreen from "./screens/TrabajoDetalleScreen";
import RutaScreen from "./screens/RutaScreen";

type Pantalla = { tipo: "trabajos" } | { tipo: "detalle"; trabajoId: string } | { tipo: "ruta" };

export default function App() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [pantalla, setPantalla] = useState<Pantalla>({ tipo: "trabajos" });
  const [senalRecarga, setSenalRecarga] = useState(0);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, nuevaSesion) => {
      setSession(nuevaSesion);
      setPantalla({ tipo: "trabajos" });
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
      {pantalla.tipo === "detalle" ? (
        <TrabajoDetalleScreen
          trabajoId={pantalla.trabajoId}
          onVolver={() => {
            setPantalla({ tipo: "trabajos" });
            setSenalRecarga((n) => n + 1);
          }}
        />
      ) : pantalla.tipo === "ruta" ? (
        <RutaScreen onVolver={() => setPantalla({ tipo: "trabajos" })} />
      ) : (
        <TrabajosScreen
          onSeleccionar={(trabajoId) => setPantalla({ tipo: "detalle", trabajoId })}
          onVerRuta={() => setPantalla({ tipo: "ruta" })}
          senalRecarga={senalRecarga}
        />
      )}
      <StatusBar style="auto" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  centro: { flex: 1, backgroundColor: "#fff", alignItems: "center", justifyContent: "center" },
});
