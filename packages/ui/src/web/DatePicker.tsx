"use client";

import type { PropsDatePicker } from "../tipos";
import { CAMPO_BASE, LABEL, MENSAJE_AYUDA, MENSAJE_ERROR, bordeDe } from "./campo";

// yyyy-mm-dd en hora LOCAL (no toISOString: eso es UTC y corre la fecha
// un día para atrás en husos negativos como Chile).
function aTextoFecha(fecha: Date | null): string {
  if (!fecha) return "";
  const y = fecha.getFullYear();
  const m = String(fecha.getMonth() + 1).padStart(2, "0");
  const d = String(fecha.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function aFecha(texto: string): Date | null {
  if (!texto) return null;
  const [y, m, d] = texto.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function DatePicker({ etiqueta, error, ayuda, deshabilitado, valor, onCambio, placeholder, minimo, maximo }: PropsDatePicker) {
  return (
    <div className="flex flex-col gap-ds-1">
      {etiqueta ? <label className={LABEL}>{etiqueta}</label> : null}
      <input
        type="date"
        value={aTextoFecha(valor)}
        onChange={(e) => onCambio(aFecha(e.target.value))}
        placeholder={placeholder}
        disabled={deshabilitado}
        min={minimo ? aTextoFecha(minimo) : undefined}
        max={maximo ? aTextoFecha(maximo) : undefined}
        aria-invalid={Boolean(error) || undefined}
        className={`h-11 rounded-ds-pill border ${bordeDe(error)} px-ds-4 ${CAMPO_BASE}`}
      />
      {error ? <p className={MENSAJE_ERROR}>{error}</p> : ayuda ? <p className={MENSAJE_AYUDA}>{ayuda}</p> : null}
    </div>
  );
}
