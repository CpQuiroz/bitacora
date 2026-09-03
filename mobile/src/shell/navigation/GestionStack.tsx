import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { useTema } from "../../theme";
import type { GestionStackParamList } from "./types";
import { GestionInicioScreen } from "../../features/gestion/GestionInicioScreen";
import { ClientesListaScreen } from "../../features/gestion/ClientesListaScreen";
import { ClienteFormScreen } from "../../features/gestion/ClienteFormScreen";
import { ClienteDetalleScreen } from "../../features/gestion/ClienteDetalleScreen";
import { CobrosListaScreen } from "../../features/gestion/CobrosListaScreen";
import { CobroFormScreen } from "../../features/gestion/CobroFormScreen";
import { CobroDetalleScreen } from "../../features/gestion/CobroDetalleScreen";

const Stack = createNativeStackNavigator<GestionStackParamList>();

export function GestionStack() {
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
      <Stack.Screen name="GestionInicio" component={GestionInicioScreen} options={{ title: "Gestión" }} />
      <Stack.Screen name="ClientesLista" component={ClientesListaScreen} options={{ title: "Clientes" }} />
      <Stack.Screen name="ClienteForm" component={ClienteFormScreen} options={{ title: "Cliente" }} />
      <Stack.Screen name="ClienteDetalle" component={ClienteDetalleScreen} options={{ title: "Cliente" }} />
      <Stack.Screen name="CobrosLista" component={CobrosListaScreen} options={{ title: "Cobros" }} />
      <Stack.Screen name="CobroForm" component={CobroFormScreen} options={{ title: "Nuevo cobro", presentation: "modal" }} />
      <Stack.Screen name="CobroDetalle" component={CobroDetalleScreen} options={{ title: "Cobro" }} />
    </Stack.Navigator>
  );
}
