import { useFonts } from "expo-font";
import { StatusBar } from "expo-status-bar";
import { NavigationContainer } from "@react-navigation/native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider, useAuth } from "../features/auth/AuthContext";
import { NetworkProvider } from "../services/sync/NetworkProvider";
import { ThemeProvider, fuentesCosmetologia } from "../theme";
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
              rubro: empresa.rubro,
            }
          : null
      }
    >
      {children}
    </ThemeProvider>
  );
}

export default function App() {
  // Karla + Bodoni Moda del tema "Vino y eucalipto" (cosmetología) — se
  // cargan siempre (pesan poco, ~300KB) para no bifurcar el arranque
  // según rubro; el resto de la app no las referencia si no está en ese
  // tema. Mientras cargan no se pinta nada (mismo criterio que el splash
  // nativo de Expo, sin agregar expo-splash-screen).
  const [fuentesListas, errorFuentes] = useFonts(fuentesCosmetologia);
  if (!fuentesListas && !errorFuentes) return null;

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
