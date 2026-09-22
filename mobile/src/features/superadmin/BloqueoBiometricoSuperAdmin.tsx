import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { AppState, View } from "react-native";
import { tokens } from "@bitacora/design-tokens";
import { Button, FUENTE_NATIVE, Texto } from "@bitacora/ui/native";
import { biometriaDisponible, pedirBiometria } from "../../lib/biometria";
import { useSuperAdminAuth } from "./SuperAdminAuthContext";

const RELOCK_MS = 60_000;

// Pedido 22-sep-2026: "necesito que el superadmin tenga inicio con
// huella". A diferencia de BloqueoBiometrico.tsx (empresa) esto NO es
// opt-in — el token de super-admin da acceso a TODOS los clientes, así
// que si el dispositivo tiene huella/Face ID configurada, se exige
// siempre (al abrir en frío y al volver de segundo plano), sin
// depender de que alguien lo haya activado a mano en un Perfil que
// todavía no existe para esta identidad (fase 2). Si el dispositivo no
// tiene biometría configurada, no bloquea — mismo criterio de no
// dejar a nadie afuera sin alternativa.
export function BloqueoBiometricoSuperAdmin({ children }: { children: ReactNode }) {
  const auth = useSuperAdminAuth();
  const [bloqueado, setBloqueado] = useState(false);
  const [verificando, setVerificando] = useState(false);
  const chequeado = useRef(false);
  const fondoEn = useRef<number | null>(null);

  const desbloquear = useCallback(async () => {
    setVerificando(true);
    const ok = await pedirBiometria("Desbloquea el panel de Super-Admin");
    setVerificando(false);
    if (ok) setBloqueado(false);
  }, []);

  useEffect(() => {
    if (chequeado.current) return;
    chequeado.current = true;
    biometriaDisponible().then((disponible) => {
      if (disponible) {
        setBloqueado(true);
        void desbloquear();
      }
    });
  }, [desbloquear]);

  useEffect(() => {
    const sub = AppState.addEventListener("change", (estado) => {
      if (estado === "background" || estado === "inactive") {
        fondoEn.current = Date.now();
        return;
      }
      if (estado === "active" && fondoEn.current && Date.now() - fondoEn.current > RELOCK_MS) {
        fondoEn.current = null;
        biometriaDisponible().then((disponible) => {
          if (disponible) {
            setBloqueado(true);
            void desbloquear();
          }
        });
      }
    });
    return () => sub.remove();
  }, [desbloquear]);

  if (!bloqueado) return <>{children}</>;

  return (
    <View style={{ flex: 1, backgroundColor: tokens.color.bg, alignItems: "center", justifyContent: "center", gap: tokens.space["4"], padding: tokens.space["6"] }}>
      <Texto tamano={tokens.size.h3} color={tokens.color.text} style={{ fontFamily: FUENTE_NATIVE.heading }}>
        Panel bloqueado
      </Texto>
      <Texto tamano={tokens.size.small} color={`${tokens.color.text}b3`} style={{ textAlign: "center" }}>
        Verifica tu identidad para ver los datos de todas las empresas.
      </Texto>
      <View style={{ alignSelf: "stretch", gap: tokens.space["2"], marginTop: tokens.space["2"] }}>
        <Button tamano="lg" bloque onPress={desbloquear} cargando={verificando}>
          Desbloquear
        </Button>
        <Button variante="ghost" bloque onPress={auth.cerrarSesion}>
          Cerrar sesión
        </Button>
      </View>
    </View>
  );
}
