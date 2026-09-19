import { useEffect } from "react";
import { View } from "react-native";
import { createMaterialTopTabNavigator } from "@react-navigation/material-top-tabs";
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

const Tab = createMaterialTopTabNavigator();

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
//
// Deslizar entre pestañas (19-sep-2026, pedido explícito — destraba a
// propósito la regla "tabs congeladas"): `createBottomTabNavigator` no
// soporta gesto de deslizar, solo tocar. `material-top-tabs` con
// `tabBarPosition="bottom"` es el mecanismo que React Navigation arma
// para justamente esto — misma barra abajo, misma API de
// tabBarIcon/tabBarLabel/screenOptions, pero el contenido desliza
// (react-native-pager-view por debajo). Al deslizar, cada pestaña
// queda donde estaba (no resetea su stack) — mismo comportamiento que
// ya tenía tocar entre pestañas, deslizar es solo otro gesto para lo
// mismo, no un comportamiento nuevo que aprender.
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
      tabBarPosition="bottom"
      keyboardDismissMode="none"
      screenOptions={{
        // headerShown no existe en material-top-tabs (nunca dibuja
        // header) — cada Stack sigue con el suyo propio, sin cambios.
        tabBarActiveTintColor: marca.base,
        tabBarInactiveTintColor: `${tokens.color.text}99`,
        tabBarStyle: { backgroundColor: tokens.color.surface, borderTopColor: tokens.color.divider, borderTopWidth: 1, elevation: 0, shadowOpacity: 0 },
        // Sin esto se ve como pestañas de arriba: solo texto, en
        // MAYÚSCULA, con la rayita indicadora de deslizado. Barra de
        // abajo = ícono + label, sin rayita, texto tal cual.
        tabBarShowIcon: true,
        tabBarIndicatorStyle: { height: 0 },
        tabBarLabelStyle: { textTransform: "none", fontSize: 11, fontWeight: "600", marginTop: 0 },
        tabBarItemStyle: { flexDirection: "column" },
        tabBarPressColor: "transparent",
      }}
    >
      {TABS.map((tab) => (
        <Tab.Screen
          key={tab.key}
          name={tab.key}
          component={tab.componente}
          options={{
            tabBarLabel: tab.label,
            // material-top-tabs no manda `size` acá (a diferencia de
            // bottom-tabs) — mismo tamaño fijo que ya se veía antes.
            tabBarIcon: ({ color }) => (
              <View>
                <tab.Icono size={24} strokeWidth={2.75} color={color} />
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
