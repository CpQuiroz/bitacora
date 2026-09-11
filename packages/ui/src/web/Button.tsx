"use client";

import type { PropsBoton, Tamano, VarianteBoton } from "../tipos";

const BASE =
  "inline-flex items-center justify-center gap-ds-2 rounded-ds-pill transition-colors select-none " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ds-brand)] " +
  "disabled:opacity-45 disabled:pointer-events-none";

const VARIANTE: Record<VarianteBoton, string> = {
  primario: "bg-ds-brand text-ds-brand-foreground hover:bg-ds-brand-hover active:bg-ds-brand-pressed",
  secundario: "border border-ds-divider text-ds-text hover:bg-ds-text/[0.07]",
  ghost: "text-ds-brand hover:bg-ds-brand/[0.08]",
  peligro: "bg-ds-accent-700 text-white hover:bg-ds-accent-800",
};

// Alturas 36 / 44 / 52. lg usa Caprasimo (ds-heading); sm/md Figtree semibold.
const TAMANO: Record<Tamano, string> = {
  sm: "h-9 px-ds-3 text-ds-small font-ds-body font-semibold",
  md: "h-11 px-ds-4 text-ds-body font-ds-body font-semibold",
  lg: "h-13 px-ds-6 text-ds-h5 ds-heading",
};

export function Button({
  children,
  onPress,
  variante = "primario",
  tamano = "md",
  bloque = false,
  cargando = false,
  deshabilitado = false,
  iconoIzq,
  iconoDer,
  tipo = "button",
  etiquetaAccesible,
}: PropsBoton) {
  const inhabilitado = deshabilitado || cargando;
  return (
    <button
      type={tipo}
      onClick={onPress}
      disabled={inhabilitado}
      aria-label={etiquetaAccesible}
      aria-busy={cargando || undefined}
      className={`${BASE} ${VARIANTE[variante]} ${TAMANO[tamano]} ${bloque ? "w-full" : ""}`}
    >
      {cargando ? (
        <span
          aria-hidden
          className="size-4 animate-spin rounded-ds-pill border-2 border-current border-t-transparent"
        />
      ) : (
        iconoIzq
      )}
      <span>{children}</span>
      {!cargando && iconoDer}
    </button>
  );
}
