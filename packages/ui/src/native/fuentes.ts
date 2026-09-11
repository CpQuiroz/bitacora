/**
 * Nombres de familia tal como los registra `useFonts()` de expo-font a
 * partir de los paquetes `@expo-google-fonts/{caprasimo,figtree}` — NO
 * son los nombres "humanos" de tokens.json (`tokens.font.heading` =
 * "Caprasimo"), son el identificador de RN. mobile/src/theme/fuentes.ts
 * reexporta esto para que haya una sola fuente de verdad del nombre.
 */
export const FUENTE_NATIVE = {
  heading: "Caprasimo_400Regular",
  body: "Figtree_400Regular",
  bodyMedium: "Figtree_500Medium",
  bodySemiBold: "Figtree_600SemiBold",
  bodyBold: "Figtree_700Bold",
} as const;
