import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { useTema } from "../../theme";
import type { ViajesStackParamList } from "./types";
import { ViajesScreen } from "../../features/viajes/ViajesScreen";
import { ViajeFormScreen } from "../../features/viajes/ViajeFormScreen";

const Stack = createNativeStackNavigator<ViajesStackParamList>();

export function ViajesStack() {
  const t = useTema();
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: t.colores.bg },
        headerTintColor: t.colores.foreground,
        headerTitleStyle: { fontWeight: "600" },
        headerShadowVisible: false,
        contentStyle: { backgroundColor: t.colores.bg },
      }}
    >
      <Stack.Screen name="ViajesLista" component={ViajesScreen} options={{ title: "Mis viajes" }} />
      <Stack.Screen
        name="ViajeForm"
        component={ViajeFormScreen}
        options={({ route }) => ({ title: route.params?.viajeId ? "Editar viaje" : "Nuevo viaje" })}
      />
    </Stack.Navigator>
  );
}
