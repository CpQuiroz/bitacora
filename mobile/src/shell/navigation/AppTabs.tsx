import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";
import { useTema } from "../../theme";
import { useAuth } from "../../features/auth/AuthContext";
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
            tabBarIcon: ({ color, size }) => <Ionicons name={tab.icono} size={size} color={color} />,
          }}
        />
      ))}
    </Tab.Navigator>
  );
}
