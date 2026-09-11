"use client";

import type { InputHTMLAttributes } from "react";
import { agruparMiles, simboloMoneda, soloDigitos } from "@/lib/formatMoneda";

// Campo de dinero: mientras se escribe muestra "$ 1.250.000" (separador
// de miles del locale de la moneda + símbolo como prefijo), pero entrega
// solo los dígitos por `onChange`. Equivalente al de mobile
// (mobile/src/components/InputMonto.tsx). Una sola moneda por empresa —
// se pasa vía `moneda` (default CLP).
//
// PASO 6 (sistema de diseño) — retokenizado a ds-. No usa el <Input> de
// packages/ui porque necesita inputMode=numeric sobre un valor de TEXTO
// ya formateado (separadores de miles) — el primitivo no tiene ese
// passthrough — así que replica sus mismas clases visuales.
type Props = Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "type"> & {
  value: string; // solo dígitos
  onChange: (digitos: string) => void;
  moneda?: string;
};

export function InputMonto({ value, onChange, moneda = "CLP", className = "", ...rest }: Props) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-ds-3 top-1/2 -translate-y-1/2 select-none font-ds-body text-ds-small text-ds-text/50">
        {simboloMoneda(moneda)}
      </span>
      <input
        {...rest}
        type="text"
        inputMode="numeric"
        value={agruparMiles(value, moneda)}
        onChange={(e) => onChange(soloDigitos(e.target.value))}
        className={`h-11 rounded-ds-pill border border-ds-divider bg-ds-surface pl-7 pr-ds-4 font-ds-body text-ds-body text-ds-text outline-none transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ds-brand)] [caret-color:var(--ds-brand)] disabled:opacity-50 ${className}`}
      />
    </div>
  );
}
