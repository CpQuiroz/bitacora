import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { useTema } from "../../theme";
import type { ClientesStackParamList } from "./types";
import { ClientesListaScreen } from "../../features/clientes/ClientesListaScreen";
import { ClienteFormScreen } from "../../features/clientes/ClienteFormScreen";
import { ClienteDetalleScreen } from "../../features/clientes/ClienteDetalleScreen";

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
      <Stack.Screen name="ClientesLista" component={ClientesListaScreen} options={{ title: "Clientes" }} />
      <Stack.Screen name="ClienteForm" component={ClienteFormScreen} options={{ title: "Cliente" }} />
      <Stack.Screen name="ClienteDetalle" component={ClienteDetalleScreen} options={{ title: "Cliente" }} />
    </Stack.Navigator>
  );
}
