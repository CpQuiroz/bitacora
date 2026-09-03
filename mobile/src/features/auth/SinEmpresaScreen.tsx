import { View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTema } from "../../theme";
import { Button, Screen, Text } from "../../components/ui";
import { useAuth } from "./AuthContext";

export function SinEmpresaScreen() {
  const t = useTema();
  const auth = useAuth();
  const correo = auth.session?.user?.email ?? "tu cuenta";

  return (
    <Screen style={{ flex: 1, justifyContent: "center", gap: t.espacio(4) }}>
      <View style={{ alignItems: "center", gap: t.espacio(3) }}>
        <Ionicons name="person-remove-outline" size={44} color={t.colores.muted} />
        <Text variante="titulo" style={{ textAlign: "center" }}>
          Sin empresa asociada
        </Text>
        <Text variante="etiqueta" tono="muted" style={{ textAlign: "center" }}>
          {correo} inició sesión, pero ese correo no está registrado en ninguna empresa de Bitácora. Pídele a quien administra
          Bitácora en tu empresa que te agregue con ese mismo correo.
        </Text>
      </View>
      <Button titulo="Cerrar sesión" variante="peligro" onPress={auth.cerrarSesion} />
    </Screen>
  );
}
