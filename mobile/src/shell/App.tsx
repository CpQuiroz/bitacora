import { StatusBar } from "expo-status-bar";
import { NavigationContainer } from "@react-navigation/native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider, useAuth } from "../features/auth/AuthContext";
import { NetworkProvider } from "../services/sync/NetworkProvider";
import { ThemeProvider } from "../theme";
import { RootNavigator } from "./navigation/RootNavigator";
import { BloqueoBiometrico } from "./BloqueoBiometrico";

// El ThemeProvider necesita la marca de la empresa, que sale del
// AuthProvider — por eso va anidado adentro.
function ConTema({ children }: { children: React.ReactNode }) {
  const auth = useAuth();
  const empresa = auth.fase === "listo" || auth.fase === "mfa-requerido" ? auth.usuario.empresa : null;
  return (
    <ThemeProvider
      marca={
        empresa
          ? {
              color_primario: empresa.color_primario,
              color_primario_foreground: empresa.color_primario_foreground,
              fuente: empresa.fuente,
            }
          : null
      }
    >
      {children}
    </ThemeProvider>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <NetworkProvider>
          <ConTema>
            <BloqueoBiometrico>
              <NavigationContainer>
                <RootNavigator />
                <StatusBar style="dark" />
              </NavigationContainer>
            </BloqueoBiometrico>
          </ConTema>
        </NetworkProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
