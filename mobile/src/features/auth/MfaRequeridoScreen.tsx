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
          Tu rol requiere activar la verificación en dos pasos antes de continuar. Actívala desde el panel web, en Configuración →
          Seguridad, y volvé a esta pantalla.
        </Text>
        <Button titulo="Ya la activé" onPress={refrescar} />
        <Button titulo="Cerrar sesión" variante="ghost" onPress={cerrarSesion} />
      </View>
    </Screen>
  );
}
