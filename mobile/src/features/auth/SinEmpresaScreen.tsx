import { View } from "react-native";
import { UserX } from "lucide-react-native";
import { tokens } from "@bitacora/design-tokens";
import { Button, Texto } from "@bitacora/ui/native";
import { PantallaAuth } from "./PantallaAuth";
import { useAuth } from "./AuthContext";

// PASO 6 (sistema de diseño) — migrado. Ver docs/design-system.md.
export function SinEmpresaScreen() {
  const auth = useAuth();
  const correo = auth.session?.user?.email ?? "tu cuenta";

  return (
    <PantallaAuth>
      <View style={{ alignItems: "center", gap: tokens.space["3"] }}>
        <UserX size={44} strokeWidth={2.75} color={`${tokens.color.text}b3`} />
        <Texto tamano={tokens.size.h4} color={tokens.color.text} style={{ textAlign: "center" }}>
          Sin empresa asociada
        </Texto>
        <Texto tamano={tokens.size.small} color={`${tokens.color.text}b3`} style={{ textAlign: "center" }}>
          {correo} inició sesión, pero ese correo no está registrado en ninguna empresa de Bitácora. Pídele a quien
          administra Bitácora en tu empresa que te agregue con ese mismo correo.
        </Texto>
      </View>
      <Button variante="peligro" bloque onPress={auth.cerrarSesion}>
        Cerrar sesión
      </Button>
    </PantallaAuth>
  );
}
