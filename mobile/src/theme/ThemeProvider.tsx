import { createContext, useContext, useMemo, type ReactNode } from "react";
import type { Empresa } from "@bitacora/shared";
import { tokens as dsTokens } from "@bitacora/design-tokens";
import { duracion, espacio, estado, paletaBase, radio, sombra, tipografia, type Paleta } from "./tokens";
import { FUENTE_DS, NOMBRE_FUENTE } from "./fuentes";
import { contraste, esHexValido, oscurecerOklch } from "./color";

/** Marca del tenant, ya resuelta (base + estados derivados en OKLCH). */
export type Marca = {
  base: string;
  hover: string;
  pressed: string;
  foreground: string;
};

/**
 * Sistema de diseño nuevo (crema/Caprasimo). Convive con `colores`
 * (Faena) durante la migración — las pantallas migradas usan `tema.ds`,
 * las viejas siguen con `tema.colores`. Ver docs/design-system.md.
 */
export type SistemaDiseno = {
  color: typeof dsTokens.color;
  marca: Marca;
  size: typeof dsTokens.size;
  space: typeof dsTokens.space;
  radius: typeof dsTokens.radius;
  shadow: typeof dsTokens.shadow;
  /** Nombres de familia RN (registradas en fuentes.ts). */
  font: typeof FUENTE_DS;
  /** line-height y tracking de titulares (Caprasimo). */
  headingLeading: number;
  headingTracking: number;
};

export type Tema = {
  colores: Paleta;
  estado: typeof estado;
  espacio: typeof espacio;
  radio: typeof radio;
  tipografia: typeof tipografia;
  sombra: typeof sombra;
  duracion: typeof duracion;
  ds: SistemaDiseno;
};

// Subconjunto de Empresa con la identidad visual del tenant.
export type MarcaEmpresa = Pick<Empresa, "color_primario" | "color_primario_foreground" | "fuente" | "rubro"> | null;

const FALLBACK_MARCA = dsTokens.color.accent; // #c67139

function resolverMarca(marca: MarcaEmpresa): Marca {
  const base = esHexValido(marca?.color_primario) ? (marca!.color_primario as string) : FALLBACK_MARCA;
  const foreground = esHexValido(marca?.color_primario_foreground)
    ? (marca!.color_primario_foreground as string)
    : contraste(base);
  return {
    base,
    hover: oscurecerOklch(base, 0.05),
    pressed: oscurecerOklch(base, 0.11),
    foreground,
  };
}

function construirTema(marca: MarcaEmpresa): Tema {
  return {
    colores: { ...paletaBase },
    estado,
    espacio,
    radio,
    tipografia: {
      ...tipografia,
      familia: NOMBRE_FUENTE.regular,
      familiaBold: NOMBRE_FUENTE.bold,
      familiaPorPeso: {
        regular: NOMBRE_FUENTE.regular,
        medium: NOMBRE_FUENTE.medium,
        semibold: NOMBRE_FUENTE.semibold,
        bold: NOMBRE_FUENTE.bold,
      },
      familiaDisplay: NOMBRE_FUENTE.monoRegular,
      familiaDisplayBold: NOMBRE_FUENTE.monoSemibold,
    },
    sombra,
    duracion,
    ds: {
      color: dsTokens.color,
      marca: resolverMarca(marca),
      size: dsTokens.size,
      space: dsTokens.space,
      radius: dsTokens.radius,
      shadow: dsTokens.shadow,
      font: FUENTE_DS,
      // Prompt: headings line-height 1.12, letter-spacing -0.015em.
      // En RN el tracking es absoluto (px), no em → ~ -0.015 * cuerpo.
      headingLeading: 1.12,
      headingTracking: -0.015,
    },
  };
}

const TemaContext = createContext<Tema>(construirTema(null));

export function ThemeProvider({ marca, children }: { marca: MarcaEmpresa; children: ReactNode }) {
  const tema = useMemo(
    () => construirTema(marca),
    [marca?.color_primario, marca?.color_primario_foreground]
  );
  return <TemaContext.Provider value={tema}>{children}</TemaContext.Provider>;
}

export function useTema(): Tema {
  return useContext(TemaContext);
}
