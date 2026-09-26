import { createContext, useContext, useMemo, type ReactNode } from "react";
import { marcaLegible, oscurecerOklch, tinteSuave, tokens, tonoFuerte } from "@bitacora/design-tokens";

/** Marca del tenant, resuelta: base + estados derivados en OKLab. */
export type Marca = {
  base: string;
  hover: string;
  pressed: string;
  foreground: string;
  /** Tinte suave / tono fuerte de `base` (19-sep-2026) — para "seleccionado"
   *  en chips/cards/burbujas en vez de relleno 100% opaco: un acento de
   *  tenant muy saturado (ej. un verde vivo) satura la pantalla si se
   *  repite así en varios lugares a la vez. Mismo criterio que ya usaba
   *  Tag.tsx para el color secundario — acá centralizado para el primario,
   *  un solo cálculo en vez de repetirlo por pantalla (antes vivía suelto
   *  como useMemo local en Button.tsx y TrabajoFormScreen.tsx). El
   *  relleno 100% opaco de `base` queda para elementos chicos y puntuales
   *  (un ícono, una barra de progreso) donde no hay riesgo de saturar. */
  suave: string;
  fuerte: string;
  /** empresas.color_secundario (14-sep-2026), ya derivado a un par
   *  tinte-suave/tono-fuerte listo para tags/badges — nunca el
   *  accentRamp fijo del sistema. Ver Tag.tsx (tono "accent2"). */
  secundarioSuave: string;
  secundarioFuerte: string;
};

const RE_HEX = /^#?([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

// Tarea 154: el texto sobre la marca sale de marcaLegible (contraste WCAG
// AA); si ni blanco ni casi negro llegan, se oscurece el fondo. El
// color_primario_foreground guardado (fórmula vieja) ya no se usa.
export function resolverMarca(
  colorPrimario?: string | null,
  _colorForeground?: string | null,
  colorSecundario?: string | null
): Marca {
  const original = colorPrimario && RE_HEX.test(colorPrimario.trim()) ? colorPrimario.trim() : tokens.color.accent;
  const { fondo: base, texto: foreground } = marcaLegible(original);
  const baseSecundario = colorSecundario && RE_HEX.test(colorSecundario.trim()) ? colorSecundario.trim() : tokens.color.accent2;
  return {
    base,
    hover: oscurecerOklch(base, 0.05),
    pressed: oscurecerOklch(base, 0.11),
    foreground,
    suave: tinteSuave(base),
    fuerte: tonoFuerte(base),
    secundarioSuave: tinteSuave(baseSecundario),
    secundarioFuerte: tonoFuerte(baseSecundario),
  };
}

const MarcaContext = createContext<Marca>(resolverMarca());

export function ProveedorMarca({
  colorPrimario,
  colorForeground,
  colorSecundario,
  children,
}: {
  colorPrimario?: string | null;
  colorForeground?: string | null;
  colorSecundario?: string | null;
  children: ReactNode;
}) {
  const marca = useMemo(
    () => resolverMarca(colorPrimario, colorForeground, colorSecundario),
    [colorPrimario, colorForeground, colorSecundario]
  );
  return <MarcaContext.Provider value={marca}>{children}</MarcaContext.Provider>;
}

export function useMarca(): Marca {
  return useContext(MarcaContext);
}
