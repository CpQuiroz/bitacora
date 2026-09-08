"use client";

import type { InputHTMLAttributes } from "react";
import { Input } from "./ui";
import { agruparMiles, simboloMoneda, soloDigitos } from "@/lib/formatMoneda";

// Campo de dinero: mientras se escribe muestra "$ 1.250.000" (separador
// de miles del locale de la moneda + símbolo como prefijo), pero entrega
// solo los dígitos por `onChange`. Equivalente al de mobile
// (mobile/src/components/InputMonto.tsx). Una sola moneda por empresa —
// se pasa vía `moneda` (default CLP).
type Props = Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "type"> & {
  value: string; // solo dígitos
  onChange: (digitos: string) => void;
  moneda?: string;
};

export function InputMonto({ value, onChange, moneda = "CLP", className = "", ...rest }: Props) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 select-none text-sm text-muted">
        {simboloMoneda(moneda)}
      </span>
      <Input
        {...rest}
        type="text"
        inputMode="numeric"
        value={agruparMiles(value, moneda)}
        onChange={(e) => onChange(soloDigitos(e.target.value))}
        className={`pl-7 ${className}`}
      />
    </div>
  );
}
