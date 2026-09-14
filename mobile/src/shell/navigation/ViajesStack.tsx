import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { tokens } from "@bitacora/design-tokens";
import type { ViajesStackParamList } from "./types";
import { ViajesScreen } from "../../features/viajes/ViajesScreen";
import { ViajeFormScreen } from "../../features/viajes/ViajeFormScreen";
import { ViajeDetalleScreen } from "../../features/viajes/ViajeDetalleScreen";

const Stack = createNativeStackNavigator<ViajesStackParamList>();

// Sistema visual móvil v2 (14-sep-2026) — las 3 pantallas dibujan su
// propio ScreenHeader, así que el header nativo del stack se apaga en
// todas (era el único stack de los 4 tabs sin ninguna migración).
export function ViajesStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: tokens.color.surface },
        headerTintColor: tokens.color.text,
        headerShadowVisible: false,
        contentStyle: { backgroundColor: tokens.color.bg },
      }}
    >
      <Stack.Screen name="ViajesLista" component={ViajesScreen} options={{ headerShown: false }} />
      <Stack.Screen name="ViajeForm" component={ViajeFormScreen} options={{ headerShown: false }} />
      <Stack.Screen name="ViajeDetalle" component={ViajeDetalleScreen} options={{ headerShown: false }} />
    </Stack.Navigator>
  );
}
