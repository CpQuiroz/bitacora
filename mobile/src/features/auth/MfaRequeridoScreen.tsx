import { View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTema } from "../../theme";
import { Button, Screen, Text } from "../../components/ui";
import { useAuth } from "./AuthContext";

export function MfaRequeridoScreen() {
  const t = useTema();
  const { cerrarSesion, refrescar } = useAuth();

  return (
    <Screen>
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", gap: t.espacio(3) }}>
        <Ionicons name="shield-checkmark-outline" size={48} color={t.colores.brand} />
        <Text variante="subtitulo" style={{ textAlign: "center" }}>
          Verificación en dos pasos requerida
        </Text>
        <Text variante="cuerpo" tono="muted" style={{ textAlign: "center" }}>
          Tu rol requiere verificación en dos pasos. Se activa desde el panel web (Configuración → Seguridad). Si no tienes acceso
          al panel, pídele a quien administra Bitácora en tu empresa que lo haga por ti o que te cambie el rol.
        </Text>
        <Button titulo="Ya la activé" onPress={refrescar} />
        <Button titulo="Cerrar sesión" variante="ghost" onPress={cerrarSesion} />
      </View>
    </Screen>
  );
}
