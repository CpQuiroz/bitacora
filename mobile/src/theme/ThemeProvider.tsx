import { createContext, useContext, useMemo, type ReactNode } from "react";
import type { Empresa } from "@bitacora/shared";
import { contraste, esHexValido, mezclar } from "./color";
import { duracion, espacio, paletaBase, radio, sombra, tipografia, type Paleta } from "./tokens";

export type Tema = {
  colores: Paleta;
  espacio: typeof espacio;
  radio: typeof radio;
  tipografia: typeof tipografia;
  sombra: typeof sombra;
  duracion: typeof duracion;
};

// Marca de la empresa (subconjunto de Empresa) — lo que el ThemeProvider
// necesita para personalizar. Viene de /api/me → usuario.empresa.
export type MarcaEmpresa = Pick<Empresa, "color_primario" | "color_primario_foreground" | "fuente"> | null;

function construirTema(marca: MarcaEmpresa): Tema {
  const colores: Paleta = { ...paletaBase };

  if (marca && esHexValido(marca.color_primario)) {
    const brand = marca.color_primario.startsWith("#") ? marca.color_primario : `#${marca.color_primario}`;
    colores.brand = brand;
    colores.brandSoft = mezclar(brand, "#ffffff", 0.12);
    colores.brandForeground = esHexValido(marca.color_primario_foreground)
      ? (marca.color_primario_foreground as string)
      : contraste(brand);
  }

  // La empresa puede elegir una fuente del sistema (helper del web:
  // web/src/lib/fuentes.ts). En RN solo se puede referenciar por nombre
  // de familia del sistema — si no carga, RN cae a la fuente por defecto.
  const familia = marca?.fuente && marca.fuente !== "Geist" ? marca.fuente : undefined;

  return {
    colores,
    espacio,
    radio,
    tipografia: { ...tipografia, familia, familiaBold: familia },
    sombra,
    duracion,
  };
}

const TemaContext = createContext<Tema>(construirTema(null));

export function ThemeProvider({ marca, children }: { marca: MarcaEmpresa; children: ReactNode }) {
  const tema = useMemo(() => construirTema(marca), [marca?.color_primario, marca?.color_primario_foreground, marca?.fuente]);
  return <TemaContext.Provider value={tema}>{children}</TemaContext.Provider>;
}

export function useTema(): Tema {
  return useContext(TemaContext);
}
