/**
 * Contrato compartido de las primitivas. Las implementaciones web
 * (src/web) y native (src/native) exponen EXACTAMENTE estas props.
 * Nombres en español, igual que el dominio del repo.
 */
import type { ReactNode } from "react";

export type Tamano = "sm" | "md" | "lg";

// ── Button ────────────────────────────────────────────────────────
export type VarianteBoton = "primario" | "secundario" | "ghost" | "peligro";

export type PropsBoton = {
  children: ReactNode;
  onPress?: () => void;
  variante?: VarianteBoton;
  tamano?: Tamano;
  /** Ancho completo del contenedor. */
  bloque?: boolean;
  cargando?: boolean;
  deshabilitado?: boolean;
  iconoIzq?: ReactNode;
  iconoDer?: ReactNode;
  /** Para <button type> en web; ignorado en native. */
  tipo?: "button" | "submit";
  /** Etiqueta accesible si el contenido no es texto. */
  etiquetaAccesible?: string;
};

// ── Alturas por tamaño (px) ───────────────────────────────────────
// Web: 36 / 44 / 52. Native: nunca por debajo de 44.
export const ALTURA_WEB: Record<Tamano, number> = { sm: 36, md: 44, lg: 52 };
export const ALTURA_NATIVE: Record<Tamano, number> = { sm: 44, md: 48, lg: 52 };
