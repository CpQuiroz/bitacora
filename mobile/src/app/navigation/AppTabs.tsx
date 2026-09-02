import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";
import { useTema } from "../../theme";
import { useAuth } from "../../features/auth/AuthContext";
import { tabsPara } from "./tabsPara";
import type { TabKey } from "./types";
import { TrabajosStack } from "./TrabajosStack";
import { ViajesStack } from "./ViajesStack";
import { RutaScreen } from "../../features/ruta/RutaScreen";
import { PerfilScreen } from "../../features/perfil/PerfilScreen";

const Tab = createBottomTabNavigator();

const ICONO: Record<TabKey, keyof typeof Ionicons.glyphMap> = {
  Trabajos: "clipboard-outline",
  Ruta: "map-outline",
  Viajes: "car-outline",
  Perfil: "person-circle-outline",
};

const COMPONENTE: Record<TabKey, React.ComponentType> = {
  Trabajos: TrabajosStack,
  Ruta: RutaScreen,
  Viajes: ViajesStack,
  Perfil: PerfilScreen,
};

export function AppTabs() {
  const t = useTema();
  const auth = useAuth();
  if (auth.fase !== "listo") return null;

  const { tabs, inicial } = tabsPara(auth.usuario, auth.usuario.empresa, auth.modulosDeshabilitados);

  return (
    <Tab.Navigator
      initialRouteName={inicial}
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: t.colores.brand,
        tabBarInactiveTintColor: t.colores.faint,
        tabBarStyle: { backgroundColor: t.colores.bg, borderTopColor: t.colores.border },
      }}
    >
      {tabs.map((tab) => (
        <Tab.Screen
          key={tab}
          name={tab}
          component={COMPONENTE[tab]}
          options={{
            tabBarIcon: ({ color, size }) => <Ionicons name={ICONO[tab]} size={size} color={color} />,
          }}
        />
      ))}
    </Tab.Navigator>
  );
}
