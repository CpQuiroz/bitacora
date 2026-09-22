import { useState } from "react";
import { Pressable, View } from "react-native";
import { tokens } from "@bitacora/design-tokens";
import { Button, FUENTE_NATIVE, Input, Texto } from "@bitacora/ui/native";
import { loginSuperAdmin } from "../../services/superadmin";
import { PantallaAuth } from "../auth/PantallaAuth";
import { useSuperAdminAuth } from "./SuperAdminAuthContext";

// Login de Super-Admin (Fase 1, 22-sep-2026) — identidad separada de
// un usuario de empresa, mismo criterio que /superadmin/login en la
// web: correo + contraseña + código TOTP, los 3 en una sola request
// (no hay paso intermedio de "ticket" como el 2FA de empresa).
export function SuperAdminLoginScreen({ onVolver }: { onVolver: () => void }) {
  const auth = useSuperAdminAuth();
  const [correo, setCorreo] = useState("");
  const [password, setPassword] = useState("");
  const [codigo, setCodigo] = useState("");
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function entrar() {
    setError(null);
    setCargando(true);
    const r = await loginSuperAdmin(correo.trim().toLowerCase(), password, codigo.trim());
    setCargando(false);
    if (!r.ok) {
      setError(r.error);
      return;
    }
    await auth.refrescar();
  }

  return (
    <PantallaAuth>
      <View style={{ alignItems: "center", gap: tokens.space["2"], marginBottom: tokens.space["4"] }}>
        <Texto tamano={tokens.size.h3} color={tokens.color.text} style={{ fontFamily: FUENTE_NATIVE.heading }}>
          Super-Admin
        </Texto>
        <Texto tamano={tokens.size.small} color={`${tokens.color.text}b3`} style={{ textAlign: "center" }}>
          Acceso interno — gestión de todas las empresas
        </Texto>
      </View>
      <Input etiqueta="Correo" tipo="email" autoCapitalizar={false} valor={correo} onCambio={setCorreo} />
      <Input etiqueta="Contraseña" tipo="password" valor={password} onCambio={setPassword} />
      <Input etiqueta="Código (app de autenticación)" tipo="codigo" valor={codigo} onCambio={setCodigo} onSubmit={entrar} />
      {error ? (
        <Texto tamano={tokens.size.small} color={tokens.color.accentRamp["700"]} style={{ textAlign: "center" }}>
          {error}
        </Texto>
      ) : null}
      <Button tamano="lg" bloque onPress={entrar} cargando={cargando} deshabilitado={!correo.trim() || !password || !codigo.trim()}>
        Entrar
      </Button>
      <Pressable
        hitSlop={10}
        style={{ alignSelf: "center", paddingVertical: tokens.space["2"], minHeight: 44, justifyContent: "center" }}
        onPress={onVolver}
      >
        <Texto tamano={tokens.size.small} color={`${tokens.color.text}b3`}>
          Volver al login normal
        </Texto>
      </Pressable>
    </PantallaAuth>
  );
}
