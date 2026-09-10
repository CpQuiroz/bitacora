// Fuentes locales (bundle de la app, sin red). Se registran con
// useFonts() en shell/App.tsx. Paquetes @expo-google-fonts/* (OFL) —
// solo traen los .ttf.
//
//   Faena (en migración): IBM Plex Sans / IBM Plex Mono
//   Sistema nuevo:        Caprasimo (headings + CTA lg) / Figtree (UI)
import {
  IBMPlexSans_400Regular,
  IBMPlexSans_500Medium,
  IBMPlexSans_600SemiBold,
  IBMPlexSans_700Bold,
} from "@expo-google-fonts/ibm-plex-sans";
import { IBMPlexMono_400Regular, IBMPlexMono_500Medium, IBMPlexMono_600SemiBold } from "@expo-google-fonts/ibm-plex-mono";
import { Caprasimo_400Regular } from "@expo-google-fonts/caprasimo";
import {
  Figtree_400Regular,
  Figtree_500Medium,
  Figtree_600SemiBold,
  Figtree_700Bold,
} from "@expo-google-fonts/figtree";

export const NOMBRE_FUENTE = {
  regular: "IBMPlexSans_400Regular",
  medium: "IBMPlexSans_500Medium",
  semibold: "IBMPlexSans_600SemiBold",
  bold: "IBMPlexSans_700Bold",
  monoRegular: "IBMPlexMono_400Regular",
  monoMedium: "IBMPlexMono_500Medium",
  monoSemibold: "IBMPlexMono_600SemiBold",
} as const;

// Sistema nuevo. `heading` (Caprasimo) es peso único — solo para títulos
// y botones grandes. `body*` (Figtree) para toda la UI.
export const FUENTE_DS = {
  heading: "Caprasimo_400Regular",
  body: "Figtree_400Regular",
  bodyMedium: "Figtree_500Medium",
  bodySemiBold: "Figtree_600SemiBold",
  bodyBold: "Figtree_700Bold",
} as const;

export const fuentesFaena = {
  IBMPlexSans_400Regular,
  IBMPlexSans_500Medium,
  IBMPlexSans_600SemiBold,
  IBMPlexSans_700Bold,
  IBMPlexMono_400Regular,
  IBMPlexMono_500Medium,
  IBMPlexMono_600SemiBold,
};

export const fuentesDS = {
  Caprasimo_400Regular,
  Figtree_400Regular,
  Figtree_500Medium,
  Figtree_600SemiBold,
  Figtree_700Bold,
};
