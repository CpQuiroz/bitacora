import { View } from "react-native";
import { ShieldCheck } from "lucide-react-native";
import { tokens } from "@bitacora/design-tokens";
import { Button, Texto, useMarca } from "@bitacora/ui/native";
import { PantallaAuth } from "./PantallaAuth";
import { useAuth } from "./AuthContext";

// PASO 6 (sistema de diseño) — migrado. Ver docs/design-system.md.
export function MfaRequeridoScreen() {
  const { cerrarSesion, refrescar } = useAuth();
  const marca = useMarca();

  return (
    <PantallaAuth>
      <View style={{ alignItems: "center", gap: tokens.space["3"] }}>
        <ShieldCheck size={48} strokeWidth={2.75} color={marca.base} />
        <Texto tamano={tokens.size.h5} color={tokens.color.text} style={{ textAlign: "center" }}>
          Verificación en dos pasos requerida
        </Texto>
        <Texto tamano={tokens.size.small} color={`${tokens.color.text}b3`} style={{ textAlign: "center" }}>
          Tu rol requiere verificación en dos pasos. Se activa desde el panel web (Configuración → Seguridad). Si no
          tienes acceso al panel, pídele a quien administra Bitácora en tu empresa que lo haga por ti o que te cambie
          el rol.
        </Texto>
      </View>
      <Button bloque onPress={refrescar}>
        Ya la activé
      </Button>
      <Button variante="ghost" bloque onPress={cerrarSesion}>
        Cerrar sesión
      </Button>
    </PantallaAuth>
  );
}
