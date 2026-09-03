import { View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useTema } from "../../theme";
import { Card, Screen, Text } from "../../components/ui";
import { useAuth } from "../auth/AuthContext";
import type { GestionStackParamList } from "../../shell/navigation/types";

export function GestionInicioScreen({ navigation }: NativeStackScreenProps<GestionStackParamList, "GestionInicio">) {
  const t = useTema();
  const auth = useAuth();
  const verFinanciero = auth.fase === "listo" && auth.modulosVisibles.includes("financiero");

  const items: { titulo: string; sub: string; icono: keyof typeof Ionicons.glyphMap; ir: () => void }[] = [
    {
      titulo: "Clientes",
      sub: "Ver, crear y editar clientes",
      icono: "people-outline",
      ir: () => navigation.navigate("ClientesLista"),
    },
  ];
  if (verFinanciero) {
    items.push({
      titulo: "Cobros",
      sub: "Facturas y pagos de los clientes",
      icono: "cash-outline",
      ir: () => navigation.navigate("CobrosLista"),
    });
  }

  return (
    <Screen scroll style={{ gap: t.espacio(3) }}>
      {items.map((it) => (
        <Card key={it.titulo} onPress={it.ir}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: t.espacio(3) }}>
            <Ionicons name={it.icono} size={26} color={t.colores.brand} />
            <View style={{ flex: 1, gap: 2 }}>
              <Text variante="subtitulo">{it.titulo}</Text>
              <Text variante="caption" tono="muted">
                {it.sub}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={t.colores.faint} />
          </View>
        </Card>
      ))}
    </Screen>
  );
}
