import type { ReactNode } from "react";
import { ScrollView, View, RefreshControl, type ViewStyle } from "react-native";
import { SafeAreaView, type Edge } from "react-native-safe-area-context";
import { useTema } from "../../theme";

/**
 * Contenedor de pantalla: fondo del tema + safe area. Con `scroll` se
 * envuelve en un ScrollView (opcionalmente con pull-to-refresh).
 */
export function Screen({
  children,
  scroll = false,
  refrescando,
  onRefrescar,
  padding = true,
  edges = ["top"],
  style,
}: {
  children: ReactNode;
  scroll?: boolean;
  refrescando?: boolean;
  onRefrescar?: () => void;
  padding?: boolean;
  edges?: Edge[];
  style?: ViewStyle;
}) {
  const t = useTema();
  const contenidoStyle: ViewStyle = { flexGrow: 1, padding: padding ? t.espacio(5) : 0 };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.colores.bg }} edges={edges}>
      {scroll ? (
        <ScrollView
          contentContainerStyle={[contenidoStyle, style]}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            onRefrescar ? <RefreshControl refreshing={Boolean(refrescando)} onRefresh={onRefrescar} tintColor={t.colores.brand} /> : undefined
          }
        >
          {children}
        </ScrollView>
      ) : (
        <View style={[contenidoStyle, style]}>{children}</View>
      )}
    </SafeAreaView>
  );
}
