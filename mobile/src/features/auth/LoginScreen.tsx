import { useEffect, useRef, useState } from "react";
import { Alert, KeyboardAvoidingView, Platform, Pressable, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { supabase } from "../../lib/supabase";
import { apiJson } from "../../services/api";
import { entrarConGoogle } from "./googleAuth";
import { useTema } from "../../theme";
import { Button, Input, LogoMark, Screen, Text } from "../../components/ui";
import type { RootStackParamList } from "../../shell/navigation/types";

// El botón de Google aparece solo cuando está configurado del lado
// servidor (Google Cloud + Supabase). Se prende en eas.json.
const GOOGLE_HABILITADO = process.env.EXPO_PUBLIC_GOOGLE_LOGIN === "true";

type RespuestaLogin =
  | { requiere_codigo: true; ticket: string; metodo: "totp" | "email" }
  | { requiere_codigo?: false; access_token: string; refresh_token: string };

export function LoginScreen({ navigation }: NativeStackScreenProps<RootStackParamList, "Login">) {
  const t = useTema();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [cargando, setCargando] = useState(false);
  const [conGoogle, setConGoogle] = useState(false);
  const [lento, setLento] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timerLento = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timerLento.current) clearTimeout(timerLento.current);
    };
  }, []);

  async function entrar() {
    setError(null);
    setCargando(true);
    setLento(false);
    // El backend en Render puede tardar si estuvo inactivo: avisamos.
    timerLento.current = setTimeout(() => setLento(true), 4000);
    const res = await apiJson<RespuestaLogin>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email: email.trim(), password }),
    });
    if (timerLento.current) clearTimeout(timerLento.current);
    setCargando(false);
    setLento(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    if (res.data.requiere_codigo) {
      navigation.navigate("Verify2fa", { ticket: res.data.ticket, metodo: res.data.metodo });
      return;
    }
    await supabase.auth.setSession({ access_token: res.data.access_token, refresh_token: res.data.refresh_token });
  }

  async function entrarGoogle() {
    setError(null);
    setConGoogle(true);
    const r = await entrarConGoogle();
    setConGoogle(false);
    if (!r.ok && r.error !== "cancelado") setError(r.error);
    // Si r.ok, el AuthContext toma la sesión nueva y navega solo.
  }

  return (
    <Screen>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <View style={{ flex: 1, justifyContent: "center", gap: t.espacio(3) }}>
          <View style={{ alignItems: "center", gap: t.espacio(2.5), marginBottom: t.espacio(4) }}>
            <LogoMark size={56} />
            <Text variante="titulo">Bitácora</Text>
            <Text variante="etiqueta" tono="muted">
              App de trabajo en terreno
            </Text>
          </View>
          <Input
            etiqueta="Correo"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            textContentType="emailAddress"
            value={email}
            onChangeText={setEmail}
            returnKeyType="next"
          />
          <Input
            etiqueta="Contraseña"
            secureTextEntry
            textContentType="password"
            value={password}
            onChangeText={setPassword}
            returnKeyType="go"
            onSubmitEditing={entrar}
          />
          {error ? (
            <Text variante="etiqueta" tono="danger" style={{ textAlign: "center" }}>
              {error}
            </Text>
          ) : lento ? (
            <Text variante="etiqueta" tono="muted" style={{ textAlign: "center" }}>
              Conectando… puede tardar unos segundos si el servidor estuvo inactivo.
            </Text>
          ) : null}
          <Button
            titulo="Entrar"
            tamano="lg"
            onPress={entrar}
            cargando={cargando}
            disabled={!email.trim() || !password}
          />
          {GOOGLE_HABILITADO ? (
            <>
              <View style={{ flexDirection: "row", alignItems: "center", gap: t.espacio(2) }}>
                <View style={{ flex: 1, height: 1, backgroundColor: t.colores.border }} />
                <Text variante="caption" tono="muted">
                  o
                </Text>
                <View style={{ flex: 1, height: 1, backgroundColor: t.colores.border }} />
              </View>
              <Button
                titulo="Continuar con Google"
                variante="secundario"
                tamano="lg"
                onPress={entrarGoogle}
                cargando={conGoogle}
              />
            </>
          ) : null}
          <Pressable
            hitSlop={10}
            style={{ alignSelf: "center", paddingVertical: t.espacio(2), minHeight: 44, justifyContent: "center" }}
            onPress={() =>
              Alert.alert(
                "¿Olvidaste tu contraseña?",
                "Pídele a quien administra Bitácora en tu empresa que te genere una clave nueva desde el panel web."
              )
            }
          >
            <Text variante="etiqueta" tono="muted">
              ¿Olvidaste tu contraseña?
            </Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}
