import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { useTema } from "../../theme";
import type { ClientesStackParamList } from "./types";
import { ClientesListaScreen } from "../../features/clientes/ClientesListaScreen";
import { ClienteFormScreen } from "../../features/clientes/ClienteFormScreen";
import { ClienteDetalleScreen } from "../../features/clientes/ClienteDetalleScreen";
import { RegistrarVentaScreen } from "../../features/ventas/RegistrarVentaScreen";
import { AsistenteScreen } from "../../features/asistente/AsistenteScreen";

const Stack = createNativeStackNavigator<ClientesStackParamList>();

export function ClientesStack() {
  const t = useTema();
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: t.colores.surface },
        headerTintColor: t.colores.foreground,
        headerTitleStyle: { fontWeight: "600" },
        headerShadowVisible: false,
        contentStyle: { backgroundColor: t.colores.bg },
      }}
    >
      {/* ClientesListaScreen dibuja su propio ScreenHeader (sistema visual
          v2) — el header nativo se apaga acá para no duplicarlo. */}
      <Stack.Screen name="ClientesLista" component={ClientesListaScreen} options={{ headerShown: false }} />
      <Stack.Screen name="ClienteForm" component={ClienteFormScreen} options={{ title: "Cliente" }} />
      {/* ClienteDetalleScreen dibuja su propio ScreenHeader (sistema visual
          v2, con su propio botón de volver) — el header nativo se apaga acá. */}
      <Stack.Screen name="ClienteDetalle" component={ClienteDetalleScreen} options={{ headerShown: false }} />
      <Stack.Screen name="RegistrarVenta" component={RegistrarVentaScreen} options={{ title: "Registrar venta" }} />
      <Stack.Screen name="Asistente" component={AsistenteScreen} options={{ title: "Asistente" }} />
    </Stack.Navigator>
  );
}
