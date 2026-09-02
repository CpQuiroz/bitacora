import { useState } from "react";
import { View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { supabase } from "../../lib/supabase";
import { apiJson } from "../../services/api";
import { useTema } from "../../theme";
import { Button, Input, Screen, Text } from "../../components/ui";
import type { RootStackParamList } from "../../shell/navigation/types";

export function Verify2faScreen({ route, navigation }: NativeStackScreenProps<RootStackParamList, "Verify2fa">) {
  const t = useTema();
  const { ticket, metodo } = route.params;
  const [codigo, setCodigo] = useState("");
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function verificar() {
    setError(null);
    setCargando(true);
    const res = await apiJson<{ access_token: string; refresh_token: string }>("/api/auth/login/verificar", {
      method: "POST",
      body: JSON.stringify({ ticket, codigo }),
    });
    setCargando(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    await supabase.auth.setSession({ access_token: res.data.access_token, refresh_token: res.data.refresh_token });
  }

  return (
    <Screen>
      <View style={{ flex: 1, justifyContent: "center", gap: t.espacio(3) }}>
        <Text variante="titulo" style={{ textAlign: "center" }}>
          Verificación en dos pasos
        </Text>
        <Text variante="cuerpo" tono="muted" style={{ textAlign: "center" }}>
          {metodo === "totp" ? "Ingresa el código de tu app de autenticación" : "Te enviamos un código a tu correo"}
        </Text>
        <Input
          etiqueta="Código de 6 dígitos"
          keyboardType="number-pad"
          maxLength={6}
          value={codigo}
          onChangeText={(v) => setCodigo(v.replace(/\D/g, ""))}
          onSubmitEditing={verificar}
        />
        {error ? (
          <Text variante="etiqueta" tono="danger" style={{ textAlign: "center" }}>
            {error}
          </Text>
        ) : null}
        <Button titulo="Verificar" tamano="lg" onPress={verificar} cargando={cargando} disabled={codigo.length !== 6} />
        <Button titulo="Volver" variante="ghost" onPress={() => navigation.goBack()} />
      </View>
    </Screen>
  );
}
