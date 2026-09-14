import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { tokens } from "@bitacora/design-tokens";
import { FUENTE_NATIVE } from "@bitacora/ui/native";
import type { ClientesStackParamList } from "./types";
import { ClientesListaScreen } from "../../features/clientes/ClientesListaScreen";
import { ClienteFormScreen } from "../../features/clientes/ClienteFormScreen";
import { ClienteDetalleScreen } from "../../features/clientes/ClienteDetalleScreen";
import { RegistrarVentaScreen } from "../../features/ventas/RegistrarVentaScreen";
import { AsistenteScreen } from "../../features/asistente/AsistenteScreen";

const Stack = createNativeStackNavigator<ClientesStackParamList>();

export function ClientesStack() {
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
      {/* ClientesListaScreen dibuja su propio ScreenHeader (sistema visual
          v2) — el header nativo se apaga acá para no duplicarlo. */}
      <Stack.Screen name="ClientesLista" component={ClientesListaScreen} options={{ headerShown: false }} />
      {/* ClienteFormScreen dibuja su propio ScreenHeader (sistema visual v2,
          con su propio botón de volver) — el header nativo se apaga acá. */}
      <Stack.Screen name="ClienteForm" component={ClienteFormScreen} options={{ headerShown: false }} />
      {/* ClienteDetalleScreen dibuja su propio ScreenHeader (sistema visual
          v2, con su propio botón de volver) — el header nativo se apaga acá. */}
      <Stack.Screen name="ClienteDetalle" component={ClienteDetalleScreen} options={{ headerShown: false }} />
      {/* RegistrarVentaScreen dibuja su propio ScreenHeader (sistema visual
          v2, con su propio botón de volver) — el header nativo se apaga acá. */}
      <Stack.Screen name="RegistrarVenta" component={RegistrarVentaScreen} options={{ headerShown: false }} />
      <Stack.Screen name="Asistente" component={AsistenteScreen} options={{ title: "Asistente" }} />
    </Stack.Navigator>
  );
}
