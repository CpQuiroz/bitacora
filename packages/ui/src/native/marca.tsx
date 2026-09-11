import { createContext, useContext, useMemo, type ReactNode } from "react";
import { oscurecerOklch, tokens } from "@bitacora/design-tokens";

/** Marca del tenant, resuelta: base + estados derivados en OKLab. */
export type Marca = {
  base: string;
  hover: string;
  pressed: string;
  foreground: string;
};

const RE_HEX = /^#?([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

function luminancia(hex: string): number {
  const h = hex.replace("#", "");
  const f = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const n = parseInt(f, 16);
  return (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
}

export function resolverMarca(colorPrimario?: string | null, colorForeground?: string | null): Marca {
  const base = colorPrimario && RE_HEX.test(colorPrimario.trim()) ? colorPrimario.trim() : tokens.color.accent;
  const foreground =
    colorForeground && RE_HEX.test(colorForeground.trim())
      ? colorForeground.trim()
      : luminancia(base) > 0.6
        ? "#111111"
        : "#ffffff";
  return { base, hover: oscurecerOklch(base, 0.05), pressed: oscurecerOklch(base, 0.11), foreground };
}

const MarcaContext = createContext<Marca>(resolverMarca());

export function ProveedorMarca({
  colorPrimario,
  colorForeground,
  children,
}: {
  colorPrimario?: string | null;
  colorForeground?: string | null;
  children: ReactNode;
}) {
  const marca = useMemo(() => resolverMarca(colorPrimario, colorForeground), [colorPrimario, colorForeground]);
  return <MarcaContext.Provider value={marca}>{children}</MarcaContext.Provider>;
}

export function useMarca(): Marca {
  return useContext(MarcaContext);
}
