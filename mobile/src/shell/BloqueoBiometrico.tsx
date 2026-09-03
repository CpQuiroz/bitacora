import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { AppState, View } from "react-native";
import { useTema } from "../theme";
import { Button, LogoMark, Text } from "../components/ui";
import { useAuth } from "../features/auth/AuthContext";
import { biometriaActivada, pedirBiometria } from "../lib/biometria";

// Tiempo en segundo plano tras el cual se vuelve a pedir la biometría.
const RELOCK_MS = 60_000;

/**
 * Si el usuario activó "Bloquear con huella" (Perfil) y hay sesión,
 * tapa la app con una pantalla de desbloqueo:
 *  - al abrir en frío,
 *  - al volver de segundo plano después de RELOCK_MS.
 * Sin sesión (pantalla de login) nunca bloquea.
 */
export function BloqueoBiometrico({ children }: { children: ReactNode }) {
  const t = useTema();
  const { session, cerrarSesion } = useAuth();
  const [bloqueado, setBloqueado] = useState(false);
  const [verificando, setVerificando] = useState(false);
  const chequeado = useRef(false);
  const fondoEn = useRef<number | null>(null);

  const desbloquear = useCallback(async () => {
    setVerificando(true);
    const ok = await pedirBiometria("Desbloquea Bitácora");
    setVerificando(false);
    if (ok) setBloqueado(false);
  }, []);

  // Chequeo inicial: ¿arrancamos bloqueados?
  useEffect(() => {
    if (chequeado.current || !session) return;
    chequeado.current = true;
    biometriaActivada().then((activa) => {
      if (activa) {
        setBloqueado(true);
        void desbloquear();
      }
    });
  }, [session, desbloquear]);

  // Re-bloqueo al volver de segundo plano.
  useEffect(() => {
    const sub = AppState.addEventListener("change", (estado) => {
      if (estado === "background" || estado === "inactive") {
        fondoEn.current = Date.now();
        return;
      }
      if (estado === "active" && fondoEn.current && Date.now() - fondoEn.current > RELOCK_MS) {
        fondoEn.current = null;
        biometriaActivada().then((activa) => {
          if (activa && session) {
            setBloqueado(true);
            void desbloquear();
          }
        });
      }
    });
    return () => sub.remove();
  }, [session, desbloquear]);

  if (!session || !bloqueado) return <>{children}</>;

  return (
    <View style={{ flex: 1, backgroundColor: t.colores.bg, alignItems: "center", justifyContent: "center", gap: t.espacio(4), padding: t.espacio(6) }}>
      <LogoMark size={56} />
      <Text variante="titulo">Bitácora está bloqueada</Text>
      <Text variante="etiqueta" tono="muted" style={{ textAlign: "center" }}>
        Verifica tu identidad para continuar.
      </Text>
      <View style={{ alignSelf: "stretch", gap: t.espacio(2.5), marginTop: t.espacio(2) }}>
        <Button titulo="Desbloquear" tamano="lg" onPress={desbloquear} cargando={verificando} />
        <Button titulo="Usar contraseña" variante="ghost" onPress={cerrarSesion} />
      </View>
    </View>
  );
}
