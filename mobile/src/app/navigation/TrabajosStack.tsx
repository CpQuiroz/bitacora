import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { useTema } from "../../theme";
import type { TrabajosStackParamList } from "./types";
import { TrabajosScreen } from "../../features/trabajos/TrabajosScreen";
import { TrabajoDetalleScreen } from "../../features/trabajos/TrabajoDetalleScreen";

const Stack = createNativeStackNavigator<TrabajosStackParamList>();

export function TrabajosStack() {
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
      <Stack.Screen name="TrabajosLista" component={TrabajosScreen} options={{ title: "Trabajos" }} />
      <Stack.Screen
        name="TrabajoDetalle"
        component={TrabajoDetalleScreen}
        options={({ route }) => ({ title: route.params.titulo ?? "Trabajo" })}
      />
    </Stack.Navigator>
  );
}
