import { useEffect } from "react";
import { View } from "react-native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";
import { useTema } from "../../theme";
import { useAuth } from "../../features/auth/AuthContext";
import { useRed } from "../../services/sync/NetworkProvider";
import { preferencias } from "../../lib/preferencias";
import { cargarHoy } from "../../services/hoy";
import type { TabKey } from "./types";
import { HoyStack } from "./HoyStack";
import { AgendaStack } from "./AgendaStack";
import { ClientesStack } from "./ClientesStack";
import { MasStack } from "./MasStack";

const Tab = createBottomTabNavigator();

// Barra IDÉNTICA para todos los roles. El rol cambia el CONTENIDO de
// cada pestaña (sobre todo "Hoy"), no qué pestañas existen.
const TABS: { key: TabKey; label: string; icono: keyof typeof Ionicons.glyphMap; componente: React.ComponentType }[] = [
  { key: "Hoy", label: "Hoy", icono: "today-outline", componente: HoyStack },
  { key: "Agenda", label: "Agenda", icono: "calendar-outline", componente: AgendaStack },
  { key: "Clientes", label: "Clientes", icono: "people-outline", componente: ClientesStack },
  { key: "Mas", label: "Más", icono: "ellipsis-horizontal", componente: MasStack },
];

export function AppTabs() {
  const t = useTema();
  const auth = useAuth();
  const { pendientes } = useRed();

  const esGestion = auth.fase === "listo" && auth.usuario.rol !== "colaborador";
  useEffect(() => {
    // "Descargar el día al abrir": precarga el cache de Hoy al entrar.
    if (preferencias().descargarDiaAlAbrir) void cargarHoy(false, true).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [esGestion]);

  if (auth.fase !== "listo") return null;

  return (
    <Tab.Navigator
      initialRouteName="Hoy"
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: t.colores.brand,
        tabBarInactiveTintColor: t.colores.faint,
        tabBarStyle: { backgroundColor: t.colores.surface, borderTopColor: t.colores.border },
      }}
    >
      {TABS.map((tab) => (
        <Tab.Screen
          key={tab.key}
          name={tab.key}
          component={tab.componente}
          options={{
            tabBarLabel: tab.label,
            tabBarIcon: ({ color, size }) => (
              <View>
                <Ionicons name={tab.icono} size={size} color={color} />
                {tab.key === "Mas" && pendientes.length > 0 ? (
                  <View
                    style={{
                      position: "absolute",
                      top: -2,
                      right: -4,
                      width: 8,
                      height: 8,
                      borderRadius: 4,
                      backgroundColor: t.colores.accent,
                    }}
                  />
                ) : null}
              </View>
            ),
          }}
        />
      ))}
    </Tab.Navigator>
  );
}
