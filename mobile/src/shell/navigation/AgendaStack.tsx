import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { tokens } from "@bitacora/design-tokens";
import { FUENTE_NATIVE } from "@bitacora/ui/native";
import type { AgendaStackParamList } from "./types";
import { AgendaScreen } from "../../features/agenda/AgendaScreen";
import { TareaDetalleScreen } from "../../features/agenda/TareaDetalleScreen";
import { NuevaCitaScreen } from "../../features/agenda/NuevaCitaScreen";
import { AsistenteScreen } from "../../features/asistente/AsistenteScreen";

const Stack = createNativeStackNavigator<AgendaStackParamList>();

export function AgendaStack() {
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
      {/* AgendaScreen y TareaDetalleScreen dibujan su propio ScreenHeader
          (sistema visual v2, con su propio botón de volver) — el header
          nativo del stack se apaga acá para no duplicarlo. NuevaCita sigue
          con el header nativo arriba (el formulario genérico no migró);
          la variante cosmetología (NuevaReservaCosmetologia) apaga ese
          header nativo a mano por instancia con `navigation.setOptions`. */}
      <Stack.Screen name="AgendaLista" component={AgendaScreen} options={{ headerShown: false }} />
      <Stack.Screen name="TareaDetalle" component={TareaDetalleScreen} options={{ headerShown: false }} />
      <Stack.Screen name="NuevaCita" component={NuevaCitaScreen} options={{ title: "Nueva cita", presentation: "modal" }} />
      <Stack.Screen name="Asistente" component={AsistenteScreen} options={{ title: "Asistente" }} />
    </Stack.Navigator>
  );
}
