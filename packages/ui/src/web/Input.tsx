"use client";

import type { PropsInput, TipoInput } from "../tipos";
import { CAMPO_BASE, LABEL, MENSAJE_AYUDA, MENSAJE_ERROR, bordeDe } from "./campo";

const HTML_TYPE: Record<TipoInput, string> = {
  texto: "text",
  numero: "number",
  codigo: "text",
  email: "email",
  password: "password",
  tel: "tel",
};

export function Input({
  etiqueta,
  error,
  ayuda,
  deshabilitado,
  valor,
  onCambio,
  placeholder,
  tipo = "texto",
  maxLongitud,
  minLongitud,
  requerido,
  iconoIzq,
  autoFoco,
}: PropsInput) {
  return (
    <div className="flex flex-col gap-ds-1">
      {etiqueta ? <label className={LABEL}>{etiqueta}</label> : null}
      <div className="relative">
        {iconoIzq ? (
          <span className="pointer-events-none absolute left-ds-3 top-1/2 -translate-y-1/2 text-ds-text/50">
            {iconoIzq}
          </span>
        ) : null}
        <input
          type={HTML_TYPE[tipo]}
          inputMode={tipo === "codigo" ? "numeric" : undefined}
          pattern={tipo === "codigo" ? "[0-9]*" : undefined}
          value={valor}
          onChange={(e) => onCambio(e.target.value)}
          placeholder={placeholder}
          disabled={deshabilitado}
          autoFocus={autoFoco}
          maxLength={maxLongitud}
          minLength={minLongitud}
          required={requerido}
          aria-invalid={Boolean(error) || undefined}
          className={`h-11 rounded-ds-pill border ${bordeDe(error)} px-ds-4 ${iconoIzq ? "pl-ds-8" : ""} ${CAMPO_BASE}`}
        />
      </div>
      {error ? <p className={MENSAJE_ERROR}>{error}</p> : ayuda ? <p className={MENSAJE_AYUDA}>{ayuda}</p> : null}
    </div>
  );
}
