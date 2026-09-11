"use client";

import { ChevronDown } from "lucide-react";
import type { PropsSelect } from "../tipos";
import { CAMPO_BASE, LABEL, MENSAJE_AYUDA, MENSAJE_ERROR, bordeDe } from "./campo";

export function Select({ etiqueta, error, ayuda, deshabilitado, valor, onCambio, opciones, placeholder }: PropsSelect) {
  return (
    <div className="flex flex-col gap-ds-1">
      {etiqueta ? <label className={LABEL}>{etiqueta}</label> : null}
      <div className="relative">
        <select
          value={valor ?? ""}
          onChange={(e) => onCambio(e.target.value)}
          disabled={deshabilitado}
          aria-invalid={Boolean(error) || undefined}
          className={`h-11 cursor-pointer appearance-none rounded-ds-pill border ${bordeDe(error)} px-ds-4 pr-ds-8 ${CAMPO_BASE}`}
        >
          {placeholder ? (
            <option value="" disabled>
              {placeholder}
            </option>
          ) : null}
          {opciones.map((o) => (
            <option key={o.valor} value={o.valor}>
              {o.etiqueta}
            </option>
          ))}
        </select>
        <ChevronDown
          size={16}
          strokeWidth={2.75}
          aria-hidden="true"
          className="pointer-events-none absolute right-ds-3 top-1/2 -translate-y-1/2 text-ds-text/50"
        />
      </div>
      {error ? <p className={MENSAJE_ERROR}>{error}</p> : ayuda ? <p className={MENSAJE_AYUDA}>{ayuda}</p> : null}
    </div>
  );
}
