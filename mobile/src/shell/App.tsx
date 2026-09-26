import { useFonts } from "expo-font";
import { StatusBar } from "expo-status-bar";
import { NavigationContainer } from "@react-navigation/native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider, useAuth } from "../features/auth/AuthContext";
import { SuperAdminGate } from "../features/superadmin/SuperAdminGate";
import { NetworkProvider } from "../services/sync/NetworkProvider";
import { useEffect } from "react";
import { ConfirmarProvider, ProveedorMarca, ToastProvider } from "@bitacora/ui/native";
import { ThemeProvider, fuentesFaena, fuentesDS } from "../theme";
import { cargarPreferencias } from "../lib/preferencias";
import { RootNavigator } from "./navigation/RootNavigator";
import { BloqueoBiometrico } from "./BloqueoBiometrico";
import { aplicarTemaMobile } from "../theme/aplicarTema";

// El ThemeProvider (tema.ds — Faena en migración) y el ProveedorMarca de
// @bitacora/ui (primitivas nuevas) necesitan la misma marca de la
// empresa, que sale del AuthProvider — por eso van anidados adentro,
// con el mismo color_primario/foreground para no divergir.
function ConTema({ children }: { children: React.ReactNode }) {
  const auth = useAuth();
  const empresa = auth.fase === "listo" || auth.fase === "mfa-requerido" || auth.fase === "prueba-vencida" ? auth.usuario.empresa : null;
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
      <ProveedorMarca
        colorPrimario={empresa?.color_primario}
        colorForeground={empresa?.color_primario_foreground}
        colorSecundario={empresa?.color_secundario}
      >
        {/* Otro ConfirmarProvider acá adentro, para que el botón del
            diálogo lleve la marca de la empresa; el de la raíz queda para
            el modo Super-Admin. */}
        <ConfirmarProvider>{children}</ConfirmarProvider>
      </ProveedorMarca>
    </ThemeProvider>
  );
}

// Mutar tokens.color (ver theme/aplicarTema.ts) no repinta sola una
// pantalla ya montada — RN no tiene cascada, cada componente solo vuelve
// a leer el estilo si vuelve a renderizar por otro motivo. Cambiar de
// tema es una acción de admin, deliberada y rara (no un toggle que se
// use todo el tiempo), así que el trade-off aceptable es: al cambiar,
// remonta TODA la navegación (key={tema}) — se pierde la pantalla en la
// que estabas (vuelve al inicio), pero toda pantalla queda 100%
// consistente con la paleta nueva, sin tener que tocar los ~72 archivos
// que leen tokens.color.* directo.
function NavegacionConTema() {
  const auth = useAuth();
  const tema =
    auth.fase === "listo" || auth.fase === "mfa-requerido" || auth.fase === "prueba-vencida" ? (auth.usuario.empresa.tema ?? "faena") : "faena";
  // Se llama en el cuerpo del render (no en un useEffect): tokens.color es
  // un singleton externo a React, no estado de este componente, así que
  // sincronizarlo acá — ANTES de que <RootNavigator> (recién montado por
  // el key de abajo) haga su primer render — evita el frame con colores
  // viejos que saldría si esto corriera después del commit, en un efecto.
  // Es la misma técnica que "adjusting state during render" de los docs
  // de React para sincronizar con algo externo: idempotente (no-op si el
  // tema no cambió) y no dispara un setState de otro componente.
  aplicarTemaMobile(tema);
  return (
    <NavigationContainer>
      <RootNavigator key={tema} />
      <StatusBar style="dark" />
    </NavigationContainer>
  );
}

export default function App() {
  // Faena (IBM Plex) + sistema nuevo (Caprasimo/Figtree). Mientras cargan
  // no se pinta nada (mismo criterio que el splash nativo de Expo, sin
  // agregar expo-splash-screen) → sin salto de fuente.
  const [fuentesListas, errorFuentes] = useFonts({ ...fuentesFaena, ...fuentesDS });

  useEffect(() => {
    void cargarPreferencias();
  }, []);

  if (!fuentesListas && !errorFuentes) return null;

  return (
    <SafeAreaProvider>
      {/* Toasts y confirmaciones (tarea 156): afuera de todo, para que
          también los tenga el modo Super-Admin. */}
      <ToastProvider>
        <ConfirmarProvider>
          <SuperAdminGate>
            <AuthProvider>
              <NetworkProvider>
                <ConTema>
                  <BloqueoBiometrico>
                    <NavegacionConTema />
                  </BloqueoBiometrico>
                </ConTema>
              </NetworkProvider>
            </AuthProvider>
          </SuperAdminGate>
        </ConfirmarProvider>
      </ToastProvider>
    </SafeAreaProvider>
  );
}
