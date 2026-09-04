import { View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useTema } from "../../theme";
import { Card, EmptyState, Screen, Text } from "../../components/ui";
import { useAuth } from "../auth/AuthContext";
import type { GestionStackParamList } from "../../shell/navigation/types";

export function GestionInicioScreen({ navigation }: NativeStackScreenProps<GestionStackParamList, "GestionInicio">) {
  const t = useTema();
  const auth = useAuth();
  const visibles = auth.fase === "listo" ? auth.modulosVisibles : [];
  const acciones = auth.fase === "listo" ? auth.acciones : [];

  const items: { titulo: string; sub: string; icono: keyof typeof Ionicons.glyphMap; ir: () => void }[] = [];
  if (visibles.includes("financiero")) {
    items.push({
      titulo: "Cobros",
      sub: "Facturas y pagos de los clientes",
      icono: "cash-outline",
      ir: () => navigation.navigate("CobrosLista"),
    });
    items.push({
      titulo: "Nuevo gasto",
      sub: "Registra un gasto con categoría, centro de costo y comprobante",
      icono: "wallet-outline",
      ir: () => navigation.navigate("GastoForm"),
    });
  }
  // ver_dashboard es la misma acción sensible que ya gatea el Dashboard
  // en la web (admin/supervisor/contador); se combina con el módulo
  // informes por si la empresa lo desactivó para ese rol — evita un tab
  // que siempre daría 403.
  if (acciones.includes("ver_dashboard") && visibles.includes("informes")) {
    items.push({
      titulo: "Informes",
      sub: "Visión general, financiero, ventas, operaciones, servicios, clientes y gastos",
      icono: "bar-chart-outline",
      ir: () => navigation.navigate("Informes"),
    });
  }
  if (visibles.includes("asistente")) {
    items.push({
      titulo: "Asistente IA",
      sub: "Pregunta sobre trabajos, viajes, clientes y cobros",
      icono: "sparkles-outline",
      ir: () => navigation.navigate("Asistente"),
    });
  }

  return (
    <Screen scroll style={{ gap: t.espacio(3) }}>
      {items.length === 0 ? (
        <EmptyState
          icono={<Ionicons name="briefcase-outline" size={40} color={t.colores.faint} />}
          titulo="Nada por acá todavía"
          mensaje="Cuando tu empresa active Cobros o el Asistente IA, aparecerán en esta pantalla."
        />
      ) : (
        items.map((it) => (
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
        ))
      )}
    </Screen>
  );
}
