import { createNativeStackNavigator } from "@react-navigation/native-stack";
import type { SuperAdminStackParamList } from "./types";
import { SuperAdminEmpresasListScreen } from "./SuperAdminEmpresasListScreen";
import { SuperAdminEmpresaDetalleScreen } from "./SuperAdminEmpresaDetalleScreen";
import { SuperAdminNuevaEmpresaScreen } from "./SuperAdminNuevaEmpresaScreen";

const Stack = createNativeStackNavigator<SuperAdminStackParamList>();

// Fase 1 del panel de Super-Admin en mobile (22-sep-2026) — EmpresasLista
// y EmpresaDetalle dibujan su propio ScreenHeader, el header nativo se
// apaga (mismo criterio que el resto de la app, ver MasStack.tsx).
// NuevaEmpresa es un modal simple, con el header nativo (no tiene
// tabs/navegación propia que duplicar).
export function SuperAdminNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="EmpresasLista" component={SuperAdminEmpresasListScreen} />
      <Stack.Screen name="EmpresaDetalle" component={SuperAdminEmpresaDetalleScreen} />
      <Stack.Screen name="NuevaEmpresa" component={SuperAdminNuevaEmpresaScreen} options={{ headerShown: true, title: "Nueva empresa", presentation: "modal" }} />
    </Stack.Navigator>
  );
}
