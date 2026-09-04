import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { useTema } from "../../theme";
import type { GestionStackParamList } from "./types";
import { GestionInicioScreen } from "../../features/gestion/GestionInicioScreen";
import { CobrosListaScreen } from "../../features/gestion/CobrosListaScreen";
import { CobroFormScreen } from "../../features/gestion/CobroFormScreen";
import { CobroDetalleScreen } from "../../features/gestion/CobroDetalleScreen";
import { NuevoGastoScreen } from "../../features/gastos/NuevoGastoScreen";
import { AsistenteScreen } from "../../features/asistente/AsistenteScreen";

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
      <Stack.Screen name="CobrosLista" component={CobrosListaScreen} options={{ title: "Cobros" }} />
      <Stack.Screen name="CobroForm" component={CobroFormScreen} options={{ title: "Nuevo cobro", presentation: "modal" }} />
      <Stack.Screen name="CobroDetalle" component={CobroDetalleScreen} options={{ title: "Cobro" }} />
      <Stack.Screen name="GastoForm" component={NuevoGastoScreen} options={{ title: "Nuevo gasto", presentation: "modal" }} />
      <Stack.Screen name="Asistente" component={AsistenteScreen} options={{ title: "Asistente" }} />
    </Stack.Navigator>
  );
}
