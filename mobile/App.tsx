import { useEffect, useState } from "react";
import { StatusBar } from "expo-status-bar";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./lib/supabase";
import { apiFetch } from "./lib/api";
import LoginScreen from "./screens/LoginScreen";
import TrabajosScreen from "./screens/TrabajosScreen";
import TrabajoDetalleScreen from "./screens/TrabajoDetalleScreen";
import RutaScreen from "./screens/RutaScreen";

type Pantalla = { tipo: "trabajos" } | { tipo: "detalle"; trabajoId: string } | { tipo: "ruta" };

export default function App() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [pantalla, setPantalla] = useState<Pantalla>({ tipo: "trabajos" });
  const [senalRecarga, setSenalRecarga] = useState(0);
  // admin/supervisor sin 2FA activo (obligatorio para su rol, ver
  // requiereEmpresa en el backend) — undefined mientras se resuelve,
  // true bloquea la app entera salvo el mensaje de abajo. La app no
  // tiene pantalla de Configuración, así que activarlo se hace desde
  // el dashboard web — acá solo se avisa.
  const [mfaPendiente, setMfaPendiente] = useState<boolean | undefined>(undefined);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, nuevaSesion) => {
      setSession(nuevaSesion);
      setPantalla({ tipo: "trabajos" });
      setMfaPendiente(undefined);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) return;
    (async () => {
      const [resMe, resMfa] = await Promise.all([apiFetch("/api/me"), apiFetch("/api/usuarios/me/mfa")]);
      if (!resMe.ok || !resMfa.ok) {
        setMfaPendiente(false);
        return;
      }
      const { usuario } = await resMe.json();
      const { activado } = await resMfa.json();
      const rolExigeMfa = usuario?.rol === "admin" || usuario?.rol === "supervisor";
      setMfaPendiente(rolExigeMfa && !activado);
    })();
  }, [session]);

  if (session === undefined || (session && mfaPendiente === undefined)) {
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

  if (mfaPendiente) {
    return (
      <View style={styles.centro}>
        <Text style={styles.mfaTitulo}>Verificación en dos pasos requerida</Text>
        <Text style={styles.mfaTexto}>
          Tu rol requiere activar la verificación en dos pasos antes de continuar. Actívala desde el panel web, en
          Configuración → Seguridad.
        </Text>
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
  centro: { flex: 1, backgroundColor: "#fff", alignItems: "center", justifyContent: "center", padding: 24 },
  mfaTitulo: { fontSize: 18, fontWeight: "600", textAlign: "center", marginBottom: 8 },
  mfaTexto: { fontSize: 14, textAlign: "center", color: "#666" },
});
