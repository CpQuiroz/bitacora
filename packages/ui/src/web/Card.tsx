"use client";

import type { Elevacion, PropsCard } from "../tipos";

// radius.lg (28) × 1.15 ≈ 32px — específico de Card, no es un token de
// tokens.json (ver RADIO_CARD en ../tipos.ts).
const SOMBRA: Record<Elevacion, string> = {
  sm: "shadow-ds-sm",
  md: "shadow-ds-md",
  lg: "shadow-ds-lg",
};

export function Card({ children, onPress, elevacion, sinRelleno = false }: PropsCard) {
  // text-ds-text explícito: sin esto, el texto sin color propio hereda el
  // --foreground ambiente (Faena, con override de dark mode del navegador/OS)
  // en vez del texto oscuro fijo que corresponde sobre un fondo ds-surface
  // (crema) — bug real encontrado en vivo (tabla de OS ilegible en dark mode).
  const clase = `rounded-[32px] bg-ds-surface text-ds-text ${sinRelleno ? "" : "p-ds-4"} ${elevacion ? SOMBRA[elevacion] : ""}`;
  if (onPress) {
    return (
      <button
        type="button"
        onClick={onPress}
        className={`${clase} block w-full text-left transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ds-brand)]`}
      >
        {children}
      </button>
    );
  }
  return <div className={clase}>{children}</div>;
}
