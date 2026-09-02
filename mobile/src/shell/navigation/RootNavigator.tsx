import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { useAuth } from "../../features/auth/AuthContext";
import { LoadingScreen } from "../../components/ui";
import type { RootStackParamList } from "./types";
import { LoginScreen } from "../../features/auth/LoginScreen";
import { Verify2faScreen } from "../../features/auth/Verify2faScreen";
import { MfaRequeridoScreen } from "../../features/auth/MfaRequeridoScreen";
import { AppTabs } from "./AppTabs";

const Stack = createNativeStackNavigator<RootStackParamList>();

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

  if (auth.fase === "mfa-requerido") return <MfaRequeridoScreen />;

  return <AppTabs />;
}
