import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { tokens } from "@bitacora/design-tokens";
import { FUENTE_NATIVE } from "@bitacora/ui/native";
import type { TrabajosStackParamList } from "./types";
import { TrabajosScreen } from "../../features/trabajos/TrabajosScreen";
import { TrabajoDetalleScreen } from "../../features/trabajos/TrabajoDetalleScreen";
import { TrabajoFormScreen } from "../../features/trabajos/TrabajoFormScreen";
import { RegistrarVentaScreen } from "../../features/ventas/RegistrarVentaScreen";

const Stack = createNativeStackNavigator<TrabajosStackParamList>();

// PASO 6 (sistema de diseño) — migrado a tokens ds-. Solo el header;
// TrabajoForm/RegistrarVenta no forman parte de este bucket, su
// contenido sigue Faena por ahora (seam conocido).
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
      <Stack.Screen name="TrabajosLista" component={TrabajosScreen} options={{ title: "Órdenes de servicio" }} />
      {/* TrabajoDetalleScreen dibuja su propio ScreenHeader (sistema visual
          v2, con su propio botón de volver) — el header nativo se apaga
          acá para no duplicarlo, igual que MasInicio/HoyInicio. */}
      <Stack.Screen name="TrabajoDetalle" component={TrabajoDetalleScreen} options={{ headerShown: false }} />
      <Stack.Screen name="TrabajoForm" component={TrabajoFormScreen} options={{ title: "Nueva orden de servicio", presentation: "modal" }} />
      <Stack.Screen name="RegistrarVenta" component={RegistrarVentaScreen} options={{ title: "Registrar venta" }} />
    </Stack.Navigator>
  );
}
