import { useEffect } from "react";
import { View } from "react-native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { CalendarClock, Ellipsis, LayoutDashboard, User, type LucideIcon } from "lucide-react-native";
import { tokens } from "@bitacora/design-tokens";
import { useMarca } from "@bitacora/ui/native";
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
//
// Íconos Lucide + colores del sistema visual nuevo (sistema visual
// móvil v2, 13-sep-2026, tarea #21) — antes Ionicons + paleta Faena.
// Se cambian las 4 pestañas juntas a propósito: la tab bar es una sola
// fila visual, no tiene sentido dejar un ícono nuevo al lado de 3
// viejos mientras el resto de "Más" se pilotea con contenido real.
//
// "Pizarra" (18-sep-2026): la pestaña "Hoy" se renombra visualmente —
// el `key: "Hoy"` interno, el stack y la pantalla siguen llamándose
// igual (HoyStack/HoyScreen/services/hoy.ts) para no tocar código que
// no hace falta tocar. Nombre corto para que entre en la tab bar; el
// nombre completo "Pizarra Digital" queda como título de la pantalla.
const TABS: { key: TabKey; label: string; Icono: LucideIcon; componente: React.ComponentType }[] = [
  { key: "Hoy", label: "Pizarra", Icono: LayoutDashboard, componente: HoyStack },
  { key: "Agenda", label: "Agenda", Icono: CalendarClock, componente: AgendaStack },
  { key: "Clientes", label: "Clientes", Icono: User, componente: ClientesStack },
  { key: "Mas", label: "Más", Icono: Ellipsis, componente: MasStack },
];

export function AppTabs() {
  const marca = useMarca();
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
        tabBarActiveTintColor: marca.base,
        tabBarInactiveTintColor: `${tokens.color.text}99`,
        tabBarStyle: { backgroundColor: tokens.color.surface, borderTopColor: tokens.color.divider },
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
                <tab.Icono size={size} strokeWidth={2.75} color={color} />
                {tab.key === "Mas" && pendientes.length > 0 ? (
                  <View
                    style={{
                      position: "absolute",
                      top: -2,
                      right: -4,
                      width: 8,
                      height: 8,
                      borderRadius: 4,
                      backgroundColor: tokens.color.accent,
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
