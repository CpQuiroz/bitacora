import { createContext, useContext, useMemo, type ReactNode } from "react";
import type { Empresa } from "@bitacora/shared";
import { duracion, espacio, estado, paletaBase, radio, sombra, tipografia, type Paleta } from "./tokens";
import { NOMBRE_FUENTE } from "./fuentes";

export type Tema = {
  colores: Paleta;
  estado: typeof estado;
  espacio: typeof espacio;
  radio: typeof radio;
  tipografia: typeof tipografia;
  sombra: typeof sombra;
  duracion: typeof duracion;
};

// Marca de la empresa (subconjunto de Empresa). Se mantiene el tipo
// porque App.tsx lo pasa, pero el tema "Faena" es único: el color y la
// fuente de la empresa ya NO cambian la paleta (la identidad Bitácora y
// el naranja-señal son fijos). El branding vive en el logo.
export type MarcaEmpresa = Pick<Empresa, "color_primario" | "color_primario_foreground" | "fuente" | "rubro"> | null;

const TEMA: Tema = {
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
};

const TemaContext = createContext<Tema>(TEMA);

export function ThemeProvider({ marca: _marca, children }: { marca: MarcaEmpresa; children: ReactNode }) {
  const tema = useMemo(() => TEMA, []);
  return <TemaContext.Provider value={tema}>{children}</TemaContext.Provider>;
}

export function useTema(): Tema {
  return useContext(TemaContext);
}
