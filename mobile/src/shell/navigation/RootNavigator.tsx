import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { useAuth } from "../../features/auth/AuthContext";
import { LoadingScreen } from "../../components/ui";
import type { RootStackParamList } from "./types";
import { LoginScreen } from "../../features/auth/LoginScreen";
import { Verify2faScreen } from "../../features/auth/Verify2faScreen";
import { MfaRequeridoScreen } from "../../features/auth/MfaRequeridoScreen";
import { SinEmpresaScreen } from "../../features/auth/SinEmpresaScreen";
import { PruebaVencidaScreen } from "../../features/plan/PruebaVencidaScreen";
import { MiPlanScreen } from "../../features/plan/MiPlanScreen";
import { PerfilScreen } from "../../features/perfil/PerfilScreen";
import type { PruebaVencidaStackParamList } from "./types";
import { AppTabs } from "./AppTabs";

const Stack = createNativeStackNavigator<RootStackParamList>();
const StackPruebaVencida = createNativeStackNavigator<PruebaVencidaStackParamList>();

export function RootNavigator() {
  const auth = useAuth();

  if (auth.fase === "cargando") return <LoadingScreen />;

  if (auth.fase === "sin-sesion") {
    return (
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="Verify2fa" component={Verify2faScreen} />
      </Stack.Navigator>
    );
  }

  if (auth.fase === "sin-empresa") return <SinEmpresaScreen />;

  if (auth.fase === "mfa-requerido") return <MfaRequeridoScreen />;

  if (auth.fase === "prueba-vencida") {
    return (
      <StackPruebaVencida.Navigator screenOptions={{ headerShown: false }}>
        <StackPruebaVencida.Screen name="PruebaVencida" component={PruebaVencidaScreen} />
        <StackPruebaVencida.Screen name="MiPlan" component={MiPlanScreen} />
        <StackPruebaVencida.Screen name="Perfil" component={PerfilScreen} />
      </StackPruebaVencida.Navigator>
    );
  }

  return <AppTabs />;
}
