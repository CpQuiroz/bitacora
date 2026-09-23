import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { tokens } from "@bitacora/design-tokens";
import { FUENTE_NATIVE } from "@bitacora/ui/native";
import type { MasStackParamList } from "./types";
import { MasScreen } from "../../features/mas/MasScreen";
import { CobrosListaScreen } from "../../features/gestion/CobrosListaScreen";
import { CobroFormScreen } from "../../features/gestion/CobroFormScreen";
import { CobroDetalleScreen } from "../../features/gestion/CobroDetalleScreen";
import { NuevoGastoScreen } from "../../features/gastos/NuevoGastoScreen";
import { RendicionesListScreen } from "../../features/rendiciones/RendicionesListScreen";
import { RendicionFormScreen } from "../../features/rendiciones/RendicionFormScreen";
import { RendicionDetalleScreen } from "../../features/rendiciones/RendicionDetalleScreen";
import { InformesScreen } from "../../features/informes/InformesScreen";
import { AsistenteScreen } from "../../features/asistente/AsistenteScreen";
import { PerfilScreen } from "../../features/perfil/PerfilScreen";
import { CatalogoScreen } from "../../features/agenda/CatalogoScreen";
import { MantencionVehiculoScreen } from "../../features/mantencion/MantencionVehiculoScreen";
import { ChecklistMantencionScreen } from "../../features/mantencion/ChecklistMantencionScreen";
import { MantencionHistorialScreen } from "../../features/mantencion/MantencionHistorialScreen";
import { MantencionDetalleScreen } from "../../features/mantencion/MantencionDetalleScreen";
import { EventosFlotaScreen } from "../../features/mantencion/EventosFlotaScreen";
import { LevantamientosListScreen } from "../../features/levantamientos/LevantamientosListScreen";
import { LevantamientoDetalleScreen } from "../../features/levantamientos/LevantamientoDetalleScreen";
import { MisTrabajosScreen } from "../../features/mis-trabajos/MisTrabajosScreen";
import { MiPlanScreen } from "../../features/plan/MiPlanScreen";
import { TrabajosStack } from "./TrabajosStack";
import { ViajesStack } from "./ViajesStack";

const Stack = createNativeStackNavigator<MasStackParamList>();

export function MasStack() {
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
      {/* MasScreen dibuja su propio ScreenHeader (sistema visual v2) — el header
          nativo del stack se apaga acá para no duplicarlo. Las demás pantallas
          de este stack todavía no migran, siguen con el header nativo de arriba. */}
      <Stack.Screen name="MasInicio" component={MasScreen} options={{ headerShown: false }} />
      <Stack.Screen name="Catalogo" component={CatalogoScreen} options={{ headerShown: false }} />
      {/* Mantención + Levantamientos: las 6 pantallas ya dibujan su propio
          ScreenHeader (sistema visual v2, con su propio botón de volver) —
          el header nativo se apaga para no duplicarlo. Bug real encontrado
          al migrar ChecklistMantencion/MantencionDetalle/LevantamientoDetalle
          (14-sep-2026): Vehiculo/Historial/Levantamientos-lista ya se habían
          migrado a ScreenHeader en sesiones anteriores pero esta línea nunca
          se actualizó — quedaban con doble header (nativo + ScreenHeader).
          Corregido junto con las 3 pantallas nuevas. */}
      <Stack.Screen name="MantencionVehiculo" component={MantencionVehiculoScreen} options={{ headerShown: false }} />
      <Stack.Screen name="ChecklistMantencion" component={ChecklistMantencionScreen} options={{ headerShown: false }} />
      <Stack.Screen name="MantencionHistorial" component={MantencionHistorialScreen} options={{ headerShown: false }} />
      <Stack.Screen name="MantencionDetalle" component={MantencionDetalleScreen} options={{ headerShown: false }} />
      <Stack.Screen name="EventosFlota" component={EventosFlotaScreen} options={{ headerShown: false }} />
      <Stack.Screen name="Levantamientos" component={LevantamientosListScreen} options={{ headerShown: false }} />
      <Stack.Screen name="LevantamientoDetalle" component={LevantamientoDetalleScreen} options={{ headerShown: false }} />
      <Stack.Screen name="MisTrabajos" component={MisTrabajosScreen} options={{ headerShown: false }} />
      <Stack.Screen name="MiPlan" component={MiPlanScreen} options={{ headerShown: false }} />
      <Stack.Screen name="CobrosLista" component={CobrosListaScreen} options={{ headerShown: false }} />
      <Stack.Screen name="CobroForm" component={CobroFormScreen} options={{ title: "Nuevo cobro", presentation: "modal" }} />
      {/* CobroDetalleScreen dibuja su propio ScreenHeader — mismo criterio. */}
      <Stack.Screen name="CobroDetalle" component={CobroDetalleScreen} options={{ headerShown: false }} />
      <Stack.Screen name="GastoForm" component={NuevoGastoScreen} options={{ title: "Nuevo gasto", presentation: "modal" }} />
      {/* Rendiciones (Más → Rendiciones, 21-sep-2026) — mismo criterio que
          Levantamientos: ScreenHeader propio, header nativo apagado. */}
      <Stack.Screen name="RendicionesLista" component={RendicionesListScreen} options={{ headerShown: false }} />
      <Stack.Screen name="RendicionForm" component={RendicionFormScreen} options={{ title: "Nueva rendición", presentation: "modal" }} />
      <Stack.Screen name="RendicionDetalle" component={RendicionDetalleScreen} options={{ headerShown: false }} />
      <Stack.Screen name="Informes" component={InformesScreen} options={{ headerShown: false }} />
      {/* AsistenteScreen mantiene el header nativo a propósito: es el
          destino del botón flotante desde 4 stacks distintos (Hoy/Agenda/
          Clientes/Más), ninguno de los cuales apaga su header nativo para
          llegar acá, y no tiene ParamList propio con volver tipado. */}
      <Stack.Screen name="Asistente" component={AsistenteScreen} options={{ title: "Asistente" }} />
      <Stack.Screen name="Perfil" component={PerfilScreen} options={{ headerShown: false }} />
      <Stack.Screen name="Trabajos" component={TrabajosStack} options={{ headerShown: false }} />
      <Stack.Screen name="Viajes" component={ViajesStack} options={{ headerShown: false }} />
    </Stack.Navigator>
  );
}
