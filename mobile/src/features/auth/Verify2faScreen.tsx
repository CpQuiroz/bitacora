import { useState } from "react";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { tokens } from "@bitacora/design-tokens";
import { Button, FUENTE_NATIVE, Input, Texto } from "@bitacora/ui/native";
import { supabase } from "../../lib/supabase";
import { apiJson } from "../../services/api";
import { PantallaAuth } from "./PantallaAuth";
import type { RootStackParamList } from "../../shell/navigation/types";

// PASO 6 (sistema de diseño) — migrado. Ver docs/design-system.md.
export function Verify2faScreen({ route, navigation }: NativeStackScreenProps<RootStackParamList, "Verify2fa">) {
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
    <PantallaAuth>
      <Texto tamano={tokens.size.h3} color={tokens.color.text} style={{ fontFamily: FUENTE_NATIVE.heading, textAlign: "center" }}>
        Verificación en dos pasos
      </Texto>
      <Texto tamano={tokens.size.small} color={`${tokens.color.text}b3`} style={{ textAlign: "center" }}>
        {metodo === "totp" ? "Ingresa el código de tu app de autenticación" : "Te enviamos un código a tu correo"}
      </Texto>
      <Input
        etiqueta="Código de 6 dígitos"
        tipo="codigo"
        maxLongitud={6}
        valor={codigo}
        onCambio={(v) => setCodigo(v.replace(/\D/g, ""))}
        onSubmit={verificar}
      />
      {error ? (
        <Texto tamano={tokens.size.small} color={tokens.color.accentRamp["700"]} style={{ textAlign: "center" }}>
          {error}
        </Texto>
      ) : null}
      <Button tamano="lg" bloque onPress={verificar} cargando={cargando} deshabilitado={codigo.length !== 6}>
        Verificar
      </Button>
      <Button variante="ghost" bloque onPress={() => navigation.goBack()}>
        Volver
      </Button>
    </PantallaAuth>
  );
}
