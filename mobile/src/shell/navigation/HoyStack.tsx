import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { tokens } from "@bitacora/design-tokens";
import { FUENTE_NATIVE } from "@bitacora/ui/native";
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
//
// PASO 6 (sistema de diseño) — migrado a tokens ds-. Los stacks anidados
// (Trabajos/Agenda/Viajes) tienen headerShown: false y su propio
// screenOptions — este cambio solo toca el header de HoyInicio/Asistente.
export function HoyStack() {
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
      <Stack.Screen name="HoyInicio" component={HoyScreen} options={{ title: "Hoy" }} />
      <Stack.Screen name="Asistente" component={AsistenteScreen} options={{ title: "Asistente" }} />
      <Stack.Screen name="Trabajos" component={TrabajosStack} options={{ headerShown: false }} />
      <Stack.Screen name="Agenda" component={AgendaStack} options={{ headerShown: false }} />
      <Stack.Screen name="Viajes" component={ViajesStack} options={{ headerShown: false }} />
    </Stack.Navigator>
  );
}
