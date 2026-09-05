import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { useTema } from "../../theme";
import type { HoyStackParamList } from "./types";
import { HoyScreen } from "../../features/hoy/HoyScreen";
import { AsistenteScreen } from "../../features/asistente/AsistenteScreen";
import { TrabajosStack } from "./TrabajosStack";
import { AgendaStack } from "./AgendaStack";
import { ViajesStack } from "./ViajesStack";

const Stack = createNativeStackNavigator<HoyStackParamList>();

// "Hoy" es la landing de todos los roles. Los stacks anidados existen
// solo para abrir el detalle de un ítem del día sin salir de la pestaña
// (volver = tocar de nuevo la pestaña Hoy, que resetea el stack).
export function HoyStack() {
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
      <Stack.Screen name="HoyInicio" component={HoyScreen} options={{ title: "Hoy" }} />
      <Stack.Screen name="Asistente" component={AsistenteScreen} options={{ title: "Asistente" }} />
      <Stack.Screen name="Trabajos" component={TrabajosStack} options={{ headerShown: false }} />
      <Stack.Screen name="Agenda" component={AgendaStack} options={{ headerShown: false }} />
      <Stack.Screen name="Viajes" component={ViajesStack} options={{ headerShown: false }} />
    </Stack.Navigator>
  );
}
