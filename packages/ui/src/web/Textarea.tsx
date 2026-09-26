"use client";

import { useId } from "react";
import type { PropsTextarea } from "../tipos";
import { CAMPO_BASE, LABEL, MENSAJE_AYUDA, MENSAJE_ERROR, bordeDe } from "./campo";

export function Textarea({ etiqueta, error, ayuda, deshabilitado, valor, onCambio, placeholder, filas = 4, id: idPropio, etiquetaAccesible }: PropsTextarea) {
  const idGenerado = useId();
  const id = idPropio ?? idGenerado;
  const idMensaje = `${id}-mensaje`;
  const hayMensaje = Boolean(error || ayuda);
  return (
    <div className="flex flex-col gap-ds-1">
      {etiqueta ? (
        <label htmlFor={id} className={LABEL}>
          {etiqueta}
        </label>
      ) : null}
      <textarea
        value={valor}
        onChange={(e) => onCambio(e.target.value)}
        placeholder={placeholder}
        disabled={deshabilitado}
        rows={filas}
        id={id}
        aria-label={etiqueta ? undefined : etiquetaAccesible}
        aria-invalid={Boolean(error) || undefined}
        aria-describedby={hayMensaje ? idMensaje : undefined}
        className={`rounded-ds-md border ${bordeDe(error)} px-ds-4 py-ds-3 ${CAMPO_BASE}`}
      />
      {error ? (
        <p id={idMensaje} className={MENSAJE_ERROR}>
          {error}
        </p>
      ) : ayuda ? (
        <p id={idMensaje} className={MENSAJE_AYUDA}>
          {ayuda}
        </p>
      ) : null}
    </div>
  );
}
