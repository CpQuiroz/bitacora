import { View } from "react-native";
import { tokens } from "@bitacora/design-tokens";
import type { PropsLoadingState } from "../tipos";
import { Skeleton } from "./Skeleton";

// Nunca un spinner centrado en pantalla completa: esqueletos con la
// forma real del contenido. Sin `children`, 3 líneas genéricas.
export function LoadingState({ children }: PropsLoadingState) {
  return (
    <View style={{ gap: tokens.space["3"] }} accessibilityLiveRegion="polite">
      {children ?? (
        <>
          <Skeleton alto={56} radio={16} />
          <Skeleton alto={56} radio={16} />
          <Skeleton alto={56} radio={16} />
        </>
      )}
    </View>
  );
}
