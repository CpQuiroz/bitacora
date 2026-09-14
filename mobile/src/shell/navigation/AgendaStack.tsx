import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { useTema } from "../../theme";
import type { AgendaStackParamList } from "./types";
import { AgendaScreen } from "../../features/agenda/AgendaScreen";
import { TareaDetalleScreen } from "../../features/agenda/TareaDetalleScreen";
import { NuevaCitaScreen } from "../../features/agenda/NuevaCitaScreen";
import { AsistenteScreen } from "../../features/asistente/AsistenteScreen";

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
      {/* AgendaScreen dibuja su propio ScreenHeader (sistema visual v2) — el
          header nativo del stack se apaga acá para no duplicarlo. TareaDetalle/
          NuevaCita todavía no migran, siguen con el header nativo de arriba. */}
      <Stack.Screen name="AgendaLista" component={AgendaScreen} options={{ headerShown: false }} />
      <Stack.Screen
        name="TareaDetalle"
        component={TareaDetalleScreen}
        options={({ route }) => ({ title: route.params.titulo ?? "Cita" })}
      />
      <Stack.Screen name="NuevaCita" component={NuevaCitaScreen} options={{ title: "Nueva cita", presentation: "modal" }} />
      <Stack.Screen name="Asistente" component={AsistenteScreen} options={{ title: "Asistente" }} />
    </Stack.Navigator>
  );
}
