import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { useTema } from "../../theme";
import type { MasStackParamList } from "./types";
import { MasScreen } from "../../features/mas/MasScreen";
import { CobrosListaScreen } from "../../features/gestion/CobrosListaScreen";
import { CobroFormScreen } from "../../features/gestion/CobroFormScreen";
import { CobroDetalleScreen } from "../../features/gestion/CobroDetalleScreen";
import { NuevoGastoScreen } from "../../features/gastos/NuevoGastoScreen";
import { InformesScreen } from "../../features/informes/InformesScreen";
import { AsistenteScreen } from "../../features/asistente/AsistenteScreen";
import { PerfilScreen } from "../../features/perfil/PerfilScreen";
import { CatalogoScreen } from "../../features/agenda/CatalogoScreen";
import { MantencionVehiculoScreen } from "../../features/mantencion/MantencionVehiculoScreen";
import { ChecklistMantencionScreen } from "../../features/mantencion/ChecklistMantencionScreen";
import { MantencionHistorialScreen } from "../../features/mantencion/MantencionHistorialScreen";
import { MantencionDetalleScreen } from "../../features/mantencion/MantencionDetalleScreen";
import { TrabajosStack } from "./TrabajosStack";
import { ViajesStack } from "./ViajesStack";

const Stack = createNativeStackNavigator<MasStackParamList>();

export function MasStack() {
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
      <Stack.Screen name="MasInicio" component={MasScreen} options={{ title: "Más" }} />
      <Stack.Screen name="Catalogo" component={CatalogoScreen} options={{ title: "Servicios y packs" }} />
      <Stack.Screen name="MantencionVehiculo" component={MantencionVehiculoScreen} options={{ title: "Mantención" }} />
      <Stack.Screen name="ChecklistMantencion" component={ChecklistMantencionScreen} options={{ title: "Mantención" }} />
      <Stack.Screen name="MantencionHistorial" component={MantencionHistorialScreen} options={{ title: "Historial" }} />
      <Stack.Screen name="MantencionDetalle" component={MantencionDetalleScreen} options={{ title: "Detalle" }} />
      <Stack.Screen name="CobrosLista" component={CobrosListaScreen} options={{ title: "Cobros" }} />
      <Stack.Screen name="CobroForm" component={CobroFormScreen} options={{ title: "Nuevo cobro", presentation: "modal" }} />
      <Stack.Screen name="CobroDetalle" component={CobroDetalleScreen} options={{ title: "Cobro" }} />
      <Stack.Screen name="GastoForm" component={NuevoGastoScreen} options={{ title: "Nuevo gasto", presentation: "modal" }} />
      <Stack.Screen name="Informes" component={InformesScreen} options={{ title: "Informes" }} />
      <Stack.Screen name="Asistente" component={AsistenteScreen} options={{ title: "Asistente" }} />
      <Stack.Screen name="Perfil" component={PerfilScreen} options={{ title: "Perfil" }} />
      <Stack.Screen name="Trabajos" component={TrabajosStack} options={{ headerShown: false }} />
      <Stack.Screen name="Viajes" component={ViajesStack} options={{ headerShown: false }} />
    </Stack.Navigator>
  );
}
