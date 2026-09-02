import { useState } from "react";
import { View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { supabase } from "../../lib/supabase";
import { apiJson } from "../../services/api";
import { useTema } from "../../theme";
import { Button, Input, Screen, Text } from "../../components/ui";
import type { RootStackParamList } from "../../shell/navigation/types";

type RespuestaLogin =
  | { requiere_codigo: true; ticket: string; metodo: "totp" | "email" }
  | { requiere_codigo?: false; access_token: string; refresh_token: string };

export function LoginScreen({ navigation }: NativeStackScreenProps<RootStackParamList, "Login">) {
  const t = useTema();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function entrar() {
    setError(null);
    setCargando(true);
    const res = await apiJson<RespuestaLogin>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email: email.trim(), password }),
    });
    setCargando(false);
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

  return (
    <Screen>
      <View style={{ flex: 1, justifyContent: "center", gap: t.espacio(3) }}>
        <Text variante="titulo" style={{ textAlign: "center", marginBottom: t.espacio(4) }}>
          Bitácora
        </Text>
        <Input
          etiqueta="Correo"
          autoCapitalize="none"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
          returnKeyType="next"
        />
        <Input etiqueta="Contraseña" secureTextEntry value={password} onChangeText={setPassword} returnKeyType="go" onSubmitEditing={entrar} />
        {error ? (
          <Text variante="etiqueta" tono="danger" style={{ textAlign: "center" }}>
            {error}
          </Text>
        ) : null}
        <Button titulo="Entrar" tamano="lg" onPress={entrar} cargando={cargando} disabled={!email.trim() || !password} />
      </View>
    </Screen>
  );
}
