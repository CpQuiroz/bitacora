import { useState } from "react";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { supabase } from "../lib/supabase";
import { API_URL } from "../lib/api";

export default function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Paso 2 — solo si el usuario tiene 2FA activo (ver POST /api/auth/login).
  const [ticket, setTicket] = useState<string | null>(null);
  const [metodo, setMetodo] = useState<"totp" | "email" | null>(null);
  const [codigo, setCodigo] = useState("");

  async function entrar() {
    setError(null);
    setCargando(true);
    const res = await fetch(`${API_URL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const body = await res.json().catch(() => ({}));
    setCargando(false);
    if (!res.ok) {
      setError(body.error ?? "No se pudo iniciar sesión");
      return;
    }
    if (body.requiere_codigo) {
      setTicket(body.ticket);
      setMetodo(body.metodo);
      return;
    }
    // Si funciona, el listener onAuthStateChange en App.tsx cambia de pantalla solo.
    await supabase.auth.setSession({ access_token: body.access_token, refresh_token: body.refresh_token });
  }

  async function verificarCodigo() {
    setError(null);
    setCargando(true);
    const res = await fetch(`${API_URL}/api/auth/login/verificar`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ticket, codigo }),
    });
    const body = await res.json().catch(() => ({}));
    setCargando(false);
    if (!res.ok) {
      setError(body.error ?? "Código incorrecto");
      return;
    }
    await supabase.auth.setSession({ access_token: body.access_token, refresh_token: body.refresh_token });
  }

  if (ticket) {
    return (
      <View style={styles.container}>
        <Text style={styles.titulo}>Verificación en dos pasos</Text>
        <Text style={styles.subtitulo}>
          {metodo === "totp" ? "Ingresa el código de tu app de autenticación" : "Te enviamos un código a tu correo"}
        </Text>
        <TextInput
          style={styles.input}
          placeholder="Código de 6 dígitos"
          keyboardType="number-pad"
          maxLength={6}
          value={codigo}
          onChangeText={(v) => setCodigo(v.replace(/\D/g, ""))}
        />
        {error && <Text style={styles.error}>{error}</Text>}
        <TouchableOpacity style={styles.boton} onPress={verificarCodigo} disabled={cargando || codigo.length !== 6}>
          {cargando ? <ActivityIndicator color="#fff" /> : <Text style={styles.botonTexto}>Verificar</Text>}
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => {
            setTicket(null);
            setMetodo(null);
            setCodigo("");
            setError(null);
          }}
        >
          <Text style={styles.link}>Volver a intentar con otra cuenta</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.titulo}>Bitácora</Text>
      <TextInput
        style={styles.input}
        placeholder="Correo"
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />
      <TextInput
        style={styles.input}
        placeholder="Contraseña"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />
      {error && <Text style={styles.error}>{error}</Text>}
      <TouchableOpacity style={styles.boton} onPress={entrar} disabled={cargando}>
        {cargando ? <ActivityIndicator color="#fff" /> : <Text style={styles.botonTexto}>Entrar</Text>}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", padding: 24, gap: 12, backgroundColor: "#fff" },
  titulo: { fontSize: 28, fontWeight: "600", textAlign: "center", marginBottom: 24 },
  subtitulo: { fontSize: 14, textAlign: "center", color: "#666", marginTop: -16, marginBottom: 8 },
  input: { borderWidth: 1, borderColor: "#ccc", borderRadius: 8, padding: 12 },
  boton: { backgroundColor: "#000", borderRadius: 8, padding: 14, alignItems: "center", marginTop: 8 },
  botonTexto: { color: "#fff", fontWeight: "600" },
  error: { color: "#c00", textAlign: "center" },
  link: { color: "#666", textAlign: "center", marginTop: 8, fontSize: 13 },
});
