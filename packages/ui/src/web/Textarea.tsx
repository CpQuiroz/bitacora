"use client";

import type { PropsTextarea } from "../tipos";
import { CAMPO_BASE, LABEL, MENSAJE_AYUDA, MENSAJE_ERROR, bordeDe } from "./campo";

export function Textarea({ etiqueta, error, ayuda, deshabilitado, valor, onCambio, placeholder, filas = 4 }: PropsTextarea) {
  return (
    <div className="flex flex-col gap-ds-1">
      {etiqueta ? <label className={LABEL}>{etiqueta}</label> : null}
      <textarea
        value={valor}
        onChange={(e) => onCambio(e.target.value)}
        placeholder={placeholder}
        disabled={deshabilitado}
        rows={filas}
        aria-invalid={Boolean(error) || undefined}
        className={`rounded-ds-md border ${bordeDe(error)} px-ds-4 py-ds-3 ${CAMPO_BASE}`}
      />
      {error ? <p className={MENSAJE_ERROR}>{error}</p> : ayuda ? <p className={MENSAJE_AYUDA}>{ayuda}</p> : null}
    </div>
  );
}
