import { useEffect, useRef, useState } from "react";
import { Pressable, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { tokens } from "@bitacora/design-tokens";
import { Button, FUENTE_NATIVE, Input, Texto, useToast } from "@bitacora/ui/native";
import { supabase } from "../../lib/supabase";
import { apiJson } from "../../services/api";
import { entrarConGoogle } from "./googleAuth";
import { LogoMark } from "../../components/ui";
import { PantallaAuth } from "./PantallaAuth";
import { useActivarModoSuperAdmin } from "../superadmin/SuperAdminModeContext";
import type { RootStackParamList } from "../../shell/navigation/types";
import { registrarEvento } from "../../lib/analytics";
import { EVENTOS } from "@bitacora/shared";

// El botón de Google aparece solo cuando está configurado del lado
// servidor (Google Cloud + Supabase). Se prende en eas.json.
const GOOGLE_HABILITADO = process.env.EXPO_PUBLIC_GOOGLE_LOGIN === "true";

type RespuestaLogin =
  | { requiere_codigo: true; ticket: string; metodo: "totp" | "email" }
  | { requiere_codigo?: false; access_token: string; refresh_token: string };

// Toques seguidos sobre el título para entrar a Super-Admin — mismo
// truco que "tocar 7 veces el número de compilación" de los ajustes
// de Android: nada visible en la pantalla, solo funciona si sabés el
// gesto (22-sep-2026, pedido explícito: "esconder el botón... algo que
// solo yo lo sepa"). Antes había un link "¿Sos Super-Admin?" a la
// vista de cualquiera.
const TOQUES_SUPERADMIN = 7;
const VENTANA_TOQUES_MS = 3000;

// PASO 6 (sistema de diseño) — migrado. Ver docs/design-system.md.
export function LoginScreen({ navigation }: NativeStackScreenProps<RootStackParamList, "Login">) {
  const activarModoSuperAdmin = useActivarModoSuperAdmin();
  const toast = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [cargando, setCargando] = useState(false);
  const [conGoogle, setConGoogle] = useState(false);
  const [lento, setLento] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timerLento = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toques = useRef<{ cantidad: number; ultimoEn: number }>({ cantidad: 0, ultimoEn: 0 });

  function onTocarTitulo() {
    const ahora = Date.now();
    const dentroDeVentana = ahora - toques.current.ultimoEn < VENTANA_TOQUES_MS;
    toques.current = { cantidad: dentroDeVentana ? toques.current.cantidad + 1 : 1, ultimoEn: ahora };
    if (toques.current.cantidad >= TOQUES_SUPERADMIN) {
      toques.current = { cantidad: 0, ultimoEn: 0 };
      activarModoSuperAdmin();
    }
  }

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
    registrarEvento(EVENTOS.login, { metodo: "clave" });
  }

  async function entrarGoogle() {
    setError(null);
    setConGoogle(true);
    const r = await entrarConGoogle();
    setConGoogle(false);
    if (!r.ok && r.error !== "cancelado") setError(r.error);
    if (r.ok) registrarEvento(EVENTOS.login, { metodo: "google" });
    // Si r.ok, el AuthContext toma la sesión nueva y navega solo.
  }

  return (
    <PantallaAuth>
      <View style={{ alignItems: "center", gap: tokens.space["2"], marginBottom: tokens.space["4"] }}>
        <LogoMark size={56} />
        <Pressable onPress={onTocarTitulo}>
          <Texto tamano={tokens.size.h3} color={tokens.color.text} style={{ fontFamily: FUENTE_NATIVE.heading }}>
            Bitácora
          </Texto>
        </Pressable>
        <Texto tamano={tokens.size.small} color={`${tokens.color.text}b3`}>
          App de trabajo en terreno
        </Texto>
      </View>
      <Input
        etiqueta="Correo"
        tipo="email"
        autoCapitalizar={false}
        valor={email}
        onCambio={setEmail}
        onSubmit={entrar}
      />
      <Input etiqueta="Contraseña" tipo="password" valor={password} onCambio={setPassword} onSubmit={entrar} />
      {error ? (
        <Texto tamano={tokens.size.small} color={tokens.color.accentRamp["700"]} style={{ textAlign: "center" }}>
          {error}
        </Texto>
      ) : lento ? (
        <Texto tamano={tokens.size.small} color={`${tokens.color.text}b3`} style={{ textAlign: "center" }}>
          Conectando… puede tardar unos segundos si el servidor estuvo inactivo.
        </Texto>
      ) : null}
      <Button tamano="lg" bloque onPress={entrar} cargando={cargando} deshabilitado={!email.trim() || !password}>
        Entrar
      </Button>
      {GOOGLE_HABILITADO ? (
        <>
          <View style={{ flexDirection: "row", alignItems: "center", gap: tokens.space["2"] }}>
            <View style={{ flex: 1, height: 1, backgroundColor: tokens.color.divider }} />
            <Texto tamano={tokens.size.caption} color={tokens.color.textSecondary}>
              o
            </Texto>
            <View style={{ flex: 1, height: 1, backgroundColor: tokens.color.divider }} />
          </View>
          <Button variante="secundario" tamano="lg" bloque onPress={entrarGoogle} cargando={conGoogle}>
            Continuar con Google
          </Button>
        </>
      ) : null}
      <Pressable
        hitSlop={10}
        style={{ alignSelf: "center", paddingVertical: tokens.space["2"], minHeight: 44, justifyContent: "center" }}
        onPress={() =>
          toast("Pídele a quien administra Bitácora en tu empresa que te genere una clave nueva desde el panel web.", { tono: "info", duracionMs: 6000 })
        }
      >
        <Texto tamano={tokens.size.small} color={`${tokens.color.text}b3`}>
          ¿Olvidaste tu contraseña?
        </Texto>
      </Pressable>
    </PantallaAuth>
  );
}
