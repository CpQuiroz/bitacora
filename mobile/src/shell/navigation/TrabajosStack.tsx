import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { tokens } from "@bitacora/design-tokens";
import { FUENTE_NATIVE } from "@bitacora/ui/native";
import type { TrabajosStackParamList } from "./types";
import { TrabajosScreen } from "../../features/trabajos/TrabajosScreen";
import { TrabajoDetalleScreen } from "../../features/trabajos/TrabajoDetalleScreen";
import { TrabajoFormScreen } from "../../features/trabajos/TrabajoFormScreen";
import { RegistrarVentaScreen } from "../../features/ventas/RegistrarVentaScreen";

const Stack = createNativeStackNavigator<TrabajosStackParamList>();

// Sistema visual móvil v2 (14-sep-2026) — tarea 31: las 3 pantallas de
// este stack ya dibujan su propio ScreenHeader o son modal (TrabajoForm,
// sin ScreenHeader por convención de modal) — no queda ninguna con el
// header nativo del stack.
export function TrabajosStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: tokens.color.surface },
        headerTintColor: tokens.color.text,
        headerTitleStyle: { fontFamily: FUENTE_NATIVE.heading, fontWeight: "400" },
        headerShadowVisible: false,
        contentStyle: { backgroundColor: tokens.color.bg },
      }}
    >
      {/* TrabajosScreen dibuja su propio ScreenHeader (sistema visual v2,
          con filtros Lista/Mapa) — el header nativo se apaga acá. */}
      <Stack.Screen name="TrabajosLista" component={TrabajosScreen} options={{ headerShown: false }} />
      {/* TrabajoDetalleScreen dibuja su propio ScreenHeader (sistema visual
          v2, con su propio botón de volver) — el header nativo se apaga
          acá para no duplicarlo, igual que MasInicio/HoyInicio. */}
      <Stack.Screen name="TrabajoDetalle" component={TrabajoDetalleScreen} options={{ headerShown: false }} />
      <Stack.Screen name="TrabajoForm" component={TrabajoFormScreen} options={{ title: "Nueva orden de servicio", presentation: "modal" }} />
      {/* RegistrarVentaScreen dibuja su propio ScreenHeader (sistema visual
          v2, con su propio botón de volver) — el header nativo se apaga acá. */}
      <Stack.Screen name="RegistrarVenta" component={RegistrarVentaScreen} options={{ headerShown: false }} />
    </Stack.Navigator>
  );
}
