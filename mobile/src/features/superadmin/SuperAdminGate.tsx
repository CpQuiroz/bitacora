import { useState, type ReactNode } from "react";
import { NavigationContainer } from "@react-navigation/native";
import { StatusBar } from "expo-status-bar";
import { SuperAdminAuthProvider, useSuperAdminAuth } from "./SuperAdminAuthContext";
import { SuperAdminLoginScreen } from "./SuperAdminLoginScreen";
import { SuperAdminNavigator } from "./SuperAdminNavigator";
import { ProveedorModoSuperAdmin } from "./SuperAdminModeContext";

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
    return (
      <NavigationContainer>
        <SuperAdminNavigator />
        <StatusBar style="dark" />
      </NavigationContainer>
    );
  }

  if (modoLogin) {
    return <SuperAdminLoginScreen onVolver={() => setModoLogin(false)} />;
  }

  return <ProveedorModoSuperAdmin value={() => setModoLogin(true)}>{children}</ProveedorModoSuperAdmin>;
}
