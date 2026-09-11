import type { ReactNode } from "react";
import { KeyboardAvoidingView, Platform, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { tokens } from "@bitacora/design-tokens";

/**
 * Shell del flujo de autenticación (sistema de diseño nuevo). Deliberadamente
 * NO reusa `components/ui/Screen.tsx` — ese es el shell de TODA la app
 * (Faena, ~50 pantallas) y tocar su fondo recolorearía todo de una, el
 * mismo motivo por el que en web el login tiene su propio `AuthLayout`
 * en vez de reusar `DashboardShell`. Ver docs/design-system.md Paso 6.
 */
export function PantallaAuth({ children }: { children: ReactNode }) {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: tokens.color.bg }}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <View style={{ flex: 1, justifyContent: "center", padding: tokens.space["6"], gap: tokens.space["4"] }}>
          {children}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
