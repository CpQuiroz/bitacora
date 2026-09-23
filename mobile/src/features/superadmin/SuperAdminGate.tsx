import { useState, type ReactNode } from "react";
import { NavigationContainer } from "@react-navigation/native";
import { StatusBar } from "expo-status-bar";
import { SuperAdminAuthProvider, useSuperAdminAuth } from "./SuperAdminAuthContext";
import { SuperAdminLoginScreen } from "./SuperAdminLoginScreen";
import { SuperAdminNavigator } from "./SuperAdminNavigator";
import { ProveedorModoSuperAdmin } from "./SuperAdminModeContext";
import { BloqueoBiometricoSuperAdmin } from "./BloqueoBiometricoSuperAdmin";
import { aplicarTemaMobile } from "../../theme/aplicarTema";

// Envuelve TODA la app (App.tsx, por fuera de AuthProvider) — decide
// si se muestra el flujo normal de empresa (children) o el de
// Super-Admin, sin que ninguno de los dos sepa nada del otro. La única
// conexión entre ambos es el link "¿Sos Super-Admin?" del LoginScreen
// normal, que llama a useActivarModoSuperAdmin() (contexto separado,
// ver SuperAdminModeContext.tsx).
export function SuperAdminGate({ children }: { children: ReactNode }) {
  return (
    <SuperAdminAuthProvider>
      <SuperAdminGateInner>{children}</SuperAdminGateInner>
    </SuperAdminAuthProvider>
  );
}

function SuperAdminGateInner({ children }: { children: ReactNode }) {
  const auth = useSuperAdminAuth();
  const [modoLogin, setModoLogin] = useState(false);

  if (auth.fase === "cargando") return null; // lectura local a SecureStore, instantánea — sin splash propio

  if (auth.fase === "listo") {
    // Estilo propio del Super-Admin (Empresas > "Mi estilo"). Mismo
    // mecanismo que NavegacionConTema (shell/App.tsx): mutar tokens.color
    // durante el render y remontar la navegación con key={tema} para que
    // todas las pantallas lean la paleta nueva. Al salir del modo
    // Super-Admin, NavegacionConTema vuelve a aplicar el tema de la empresa.
    const tema = auth.yo.tema ?? "faena";
    aplicarTemaMobile(tema);
    return (
      <BloqueoBiometricoSuperAdmin>
        <NavigationContainer>
          <SuperAdminNavigator key={tema} />
          <StatusBar style="dark" />
        </NavigationContainer>
      </BloqueoBiometricoSuperAdmin>
    );
  }

  if (modoLogin) {
    return <SuperAdminLoginScreen onVolver={() => setModoLogin(false)} />;
  }

  return <ProveedorModoSuperAdmin value={() => setModoLogin(true)}>{children}</ProveedorModoSuperAdmin>;
}
