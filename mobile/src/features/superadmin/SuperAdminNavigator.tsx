import { createNativeStackNavigator } from "@react-navigation/native-stack";
import type { SuperAdminStackParamList } from "./types";
import { SuperAdminEmpresasListScreen } from "./SuperAdminEmpresasListScreen";
import { SuperAdminEmpresaDetalleScreen } from "./SuperAdminEmpresaDetalleScreen";

const Stack = createNativeStackNavigator<SuperAdminStackParamList>();

// Fase 1 del panel de Super-Admin en mobile (22-sep-2026) — ambas
// pantallas dibujan su propio ScreenHeader, el header nativo se apaga
// (mismo criterio que el resto de la app, ver MasStack.tsx).
export function SuperAdminNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="EmpresasLista" component={SuperAdminEmpresasListScreen} />
      <Stack.Screen name="EmpresaDetalle" component={SuperAdminEmpresaDetalleScreen} />
    </Stack.Navigator>
  );
}
