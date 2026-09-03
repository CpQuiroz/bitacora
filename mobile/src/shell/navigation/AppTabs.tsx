import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";
import { useTema } from "../../theme";
import { useAuth } from "../../features/auth/AuthContext";
import { tabsPara } from "./tabsPara";
import type { TabKey } from "./types";
import { TrabajosStack } from "./TrabajosStack";
import { AgendaStack } from "./AgendaStack";
import { ViajesStack } from "./ViajesStack";
import { GestionStack } from "./GestionStack";
import { RutaScreen } from "../../features/ruta/RutaScreen";
import { PerfilScreen } from "../../features/perfil/PerfilScreen";

const Tab = createBottomTabNavigator();

const ICONO: Record<TabKey, keyof typeof Ionicons.glyphMap> = {
  Trabajos: "clipboard-outline",
  Agenda: "calendar-outline",
  Ruta: "map-outline",
  Viajes: "car-outline",
  Gestion: "briefcase-outline",
  Perfil: "person-circle-outline",
};

const COMPONENTE: Record<TabKey, React.ComponentType> = {
  Trabajos: TrabajosStack,
  Agenda: AgendaStack,
  Ruta: RutaScreen,
  Viajes: ViajesStack,
  Gestion: GestionStack,
  Perfil: PerfilScreen,
};

export function AppTabs() {
  const t = useTema();
  const auth = useAuth();
  if (auth.fase !== "listo") return null;

  const { tabs, inicial } = tabsPara(
    auth.usuario,
    auth.usuario.empresa,
    auth.modulosDeshabilitados,
    auth.modulosVisibles
  );

  return (
    <Tab.Navigator
      initialRouteName={inicial}
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: t.colores.brand,
        tabBarInactiveTintColor: t.colores.faint,
        tabBarStyle: { backgroundColor: t.colores.surface, borderTopColor: t.colores.border },
      }}
    >
      {tabs.map((tab) => (
        <Tab.Screen
          key={tab}
          name={tab}
          component={COMPONENTE[tab]}
          options={{
            tabBarLabel: tab === "Gestion" ? "Gestión" : tab,
            tabBarIcon: ({ color, size }) => <Ionicons name={ICONO[tab]} size={size} color={color} />,
          }}
        />
      ))}
    </Tab.Navigator>
  );
}
