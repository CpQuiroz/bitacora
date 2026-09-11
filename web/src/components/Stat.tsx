import type { ReactNode } from "react";

// KPI chico (etiqueta + número grande + nota opcional) — usado en varios
// listados y en casi todos los Informes. No es parte de packages/ui
// (specífico de layouts de KPIs web, no tiene equivalente mobile todavía).
//
// PASO 6 (sistema de diseño) — migrado desde components/ui.tsx (Faena).
// Ver docs/design-system.md.
export function Stat({
  etiqueta,
  valor,
  nota,
  tono = "neutro",
  destacada = false,
}: {
  etiqueta: string;
  valor: ReactNode;
  nota?: ReactNode;
  tono?: "neutro" | "exito" | "alerta" | "riesgo";
  destacada?: boolean;
}) {
  // Sin tono "riesgo/danger" propio en la paleta nueva — reusa accent-700
  // (mismo criterio que Button variante peligro).
  const notaClase = destacada
    ? "text-ds-brand-foreground/80"
    : { neutro: "text-ds-text/60", exito: "text-ds-accent2-700", alerta: "text-ds-accent-700", riesgo: "text-ds-accent-800" }[tono];
  return (
    <div className={`rounded-ds-md border p-ds-4 ${destacada ? "border-ds-brand bg-ds-brand text-ds-brand-foreground" : "border-ds-divider bg-ds-surface"}`}>
      <p className={`font-ds-body text-[10px] font-semibold uppercase tracking-[0.1em] ${destacada ? "text-ds-brand-foreground/70" : "text-ds-text/60"}`}>
        {etiqueta}
      </p>
      <p className={`mt-ds-2 font-ds-body text-[28px] font-semibold tracking-tight ${destacada ? "" : "text-ds-text"}`}>{valor}</p>
      {nota ? <p className={`mt-1.5 font-ds-body text-ds-caption font-semibold ${notaClase}`}>{nota}</p> : null}
    </div>
  );
}
