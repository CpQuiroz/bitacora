import { createContext, useContext, useMemo, type ReactNode } from "react";
import type { Empresa } from "@bitacora/shared";
import { esHexValido, mezclar } from "./color";
import { duracion, espacio, paletaBase, radio, sombra, tipografia, type Paleta } from "./tokens";
import { paletaCosmetologia, radioCosmetologia, sombraCosmetologia, tipografiaCosmetologia } from "./temas/cosmetologia";

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
export type MarcaEmpresa = Pick<Empresa, "color_primario" | "color_primario_foreground" | "fuente" | "rubro"> | null;

function construirTema(marca: MarcaEmpresa): Tema {
  // Tema por rubro "Vino y eucalipto" (ver theme/temas/cosmetologia.ts):
  // reemplaza colores/radio/sombra/tipografía enteros, con una paleta e
  // identidad tipográfica fijas — a propósito NO se mezcla con el color
  // de marca de la empresa (esa personalización es del tema por defecto).
  if (marca?.rubro === "cosmetologia") {
    return {
      colores: { ...paletaCosmetologia },
      espacio,
      radio: radioCosmetologia,
      tipografia: tipografiaCosmetologia,
      sombra: sombraCosmetologia,
      duracion,
    };
  }

  const colores: Paleta = { ...paletaBase };

  // Refresco 1a — el color de la empresa se escribe en `accent`, no en
  // `brand`: `brand` es la identidad Bitácora y ya no se reemplaza por
  // tenant. El accent se usa solo en la acción de terreno en curso.
  if (marca && esHexValido(marca.color_primario)) {
    const c = marca.color_primario.startsWith("#") ? marca.color_primario : `#${marca.color_primario}`;
    colores.accent = c;
    colores.accentSoft = mezclar(c, "#ffffff", 0.12);
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
  const tema = useMemo(
    () => construirTema(marca),
    [marca?.color_primario, marca?.color_primario_foreground, marca?.fuente, marca?.rubro]
  );
  return <TemaContext.Provider value={tema}>{children}</TemaContext.Provider>;
}

export function useTema(): Tema {
  return useContext(TemaContext);
}
