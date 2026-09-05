import { View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useTema } from "../../theme";
import { Card, Screen, Text } from "../../components/ui";
import { useAuth } from "../auth/AuthContext";
import type { MasStackParamList } from "../../shell/navigation/types";

// "Más": todo lo que no cabe en las 3 primeras pestañas. Las listas
// completas de trabajos/viajes (histórico), la gestión de oficina
// (cobros, gastos, informes, asistente) y el perfil con la cola de
// sincronización. Ya no puede quedar vacía → sin EmptyState.

type Item = { titulo: string; sub: string; icono: keyof typeof Ionicons.glyphMap; ir: () => void };

export function MasScreen({ navigation }: NativeStackScreenProps<MasStackParamList, "MasInicio">) {
  const t = useTema();
  const auth = useAuth();
  const listo = auth.fase === "listo";
  const visibles = listo ? auth.modulosVisibles : [];
  const acciones = listo ? auth.acciones : [];
  const deshabilitados = listo ? auth.modulosDeshabilitados : [];

  const grupos: { titulo: string; items: Item[] }[] = [];

  const trabajo: Item[] = [
    {
      titulo: "Todos los trabajos",
      sub: "El historial completo, no solo lo de hoy",
      icono: "clipboard-outline",
      ir: () => navigation.navigate("Trabajos"),
    },
  ];
  if (!deshabilitados.includes("viajes")) {
    trabajo.push({
      titulo: "Todos los viajes",
      sub: "El historial completo de viajes",
      icono: "car-outline",
      ir: () => navigation.navigate("Viajes"),
    });
  }
  grupos.push({ titulo: "Terreno", items: trabajo });

  const oficina: Item[] = [];
  if (visibles.includes("financiero")) {
    oficina.push({
      titulo: "Cobros",
      sub: "Facturas y pagos de los clientes",
      icono: "cash-outline",
      ir: () => navigation.navigate("CobrosLista"),
    });
    oficina.push({
      titulo: "Nuevo gasto",
      sub: "Registra un gasto con categoría, centro de costo y comprobante",
      icono: "wallet-outline",
      ir: () => navigation.navigate("GastoForm"),
    });
  }
  if (acciones.includes("ver_dashboard") && visibles.includes("informes")) {
    oficina.push({
      titulo: "Informes",
      sub: "Visión general, financiero, ventas, operaciones, servicios, clientes y gastos",
      icono: "bar-chart-outline",
      ir: () => navigation.navigate("Informes"),
    });
  }
  if (visibles.includes("asistente")) {
    oficina.push({
      titulo: "Asistente IA",
      sub: "Pregunta sobre trabajos, viajes, clientes y cobros",
      icono: "sparkles-outline",
      ir: () => navigation.navigate("Asistente"),
    });
  }
  if (oficina.length > 0) grupos.push({ titulo: "Oficina", items: oficina });

  grupos.push({
    titulo: "Tu cuenta",
    items: [
      {
        titulo: "Perfil y sincronización",
        sub: "Tus datos, el bloqueo con huella y la cola de acciones sin enviar",
        icono: "person-circle-outline",
        ir: () => navigation.navigate("Perfil"),
      },
    ],
  });

  return (
    <Screen scroll style={{ gap: t.espacio(4) }}>
      {grupos.map((g) => (
        <View key={g.titulo} style={{ gap: t.espacio(2) }}>
          <Text variante="caption" tono="muted" weight="semibold" style={{ textTransform: "uppercase" }}>
            {g.titulo}
          </Text>
          {g.items.map((it) => (
            <Card key={it.titulo} onPress={it.ir}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: t.espacio(3) }}>
                <Ionicons name={it.icono} size={24} color={t.colores.brand} />
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
        </View>
      ))}
    </Screen>
  );
}
