import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { useTema } from "../../theme";
import type { AgendaStackParamList } from "./types";
import { AgendaScreen } from "../../features/agenda/AgendaScreen";
import { TareaDetalleScreen } from "../../features/agenda/TareaDetalleScreen";

const Stack = createNativeStackNavigator<AgendaStackParamList>();

export function AgendaStack() {
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
      <Stack.Screen name="AgendaLista" component={AgendaScreen} options={{ title: "Agenda" }} />
      <Stack.Screen
        name="TareaDetalle"
        component={TareaDetalleScreen}
        options={({ route }) => ({ title: route.params.titulo ?? "Cita" })}
      />
    </Stack.Navigator>
  );
}
