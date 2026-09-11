"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";

export type ComboboxOpcion = { id: string; label: string };

// Combobox con búsqueda y navegación por teclado (flechas + Enter),
// sobre un <input> normal — sin librería nueva, mismo criterio que el
// resto del design system (packages/ui, sin Radix/shadcn). Es el
// primitivo genérico: solo busca/selecciona entre "opciones". La
// lógica de "si no existe, crear uno nuevo" la arma cada caller vía
// etiquetaCrear/onCrear (ver ComboboxCliente y ComboboxResponsable,
// que sí saben qué significa "crear" para cada entidad).
//
// PASO 6 (sistema de diseño) — retokenizado a ds-. No es una primitiva de
// packages/ui (busca + crea inline, más complejo que Select) — queda como
// componente propio de la app, pero con los tokens nuevos porque lo usan
// pantallas que se están migrando (Órdenes de servicio).
export function Combobox({
  value,
  onChange,
  opciones,
  placeholder = "Buscar…",
  etiquetaCrear,
  onCrear,
  disabled,
  gestionHref,
  gestionLabel,
}: {
  value: string;
  onChange: (id: string) => void;
  opciones: ComboboxOpcion[];
  placeholder?: string;
  etiquetaCrear?: (texto: string) => string;
  onCrear?: (texto: string) => void;
  disabled?: boolean;
  // Enlace a la pantalla donde se gestiona/crea esta entidad — para
  // casos donde crear inline no alcanza (la entidad necesita más que un
  // nombre). Se abre en una pestaña nueva para no perder el formulario.
  gestionHref?: string;
  gestionLabel?: string;
}) {
  const [abierto, setAbierto] = useState(false);
  const [texto, setTexto] = useState("");
  const [indiceActivo, setIndiceActivo] = useState(0);
  const contenedorRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const seleccionActual = opciones.find((o) => o.id === value) ?? null;

  useEffect(() => {
    function onClickFuera(e: MouseEvent) {
      if (contenedorRef.current && !contenedorRef.current.contains(e.target as Node)) {
        setAbierto(false);
      }
    }
    document.addEventListener("mousedown", onClickFuera);
    return () => document.removeEventListener("mousedown", onClickFuera);
  }, []);

  const filtradas = texto.trim()
    ? opciones.filter((o) => o.label.toLowerCase().includes(texto.trim().toLowerCase()))
    : opciones;

  // Solo se ofrece crear si lo que se escribió no matchea ningún
  // nombre existente de forma exacta (case-insensitive) — si hay
  // coincidencias parciales igual se muestran arriba, para que el
  // usuario pueda elegir una existente en vez de duplicar.
  const puedeCrear =
    Boolean(etiquetaCrear && onCrear) &&
    texto.trim() !== "" &&
    !opciones.some((o) => o.label.toLowerCase() === texto.trim().toLowerCase());

  const filas: ({ tipo: "opcion"; opcion: ComboboxOpcion } | { tipo: "crear"; texto: string })[] = [
    ...filtradas.map((opcion) => ({ tipo: "opcion" as const, opcion })),
    ...(puedeCrear ? [{ tipo: "crear" as const, texto: texto.trim() }] : []),
  ];

  function abrir() {
    if (disabled) return;
    setTexto("");
    setIndiceActivo(0);
    setAbierto(true);
  }

  function elegirFila(fila: (typeof filas)[number]) {
    if (fila.tipo === "opcion") {
      onChange(fila.opcion.id);
    } else {
      onCrear?.(fila.texto);
    }
    setAbierto(false);
    setTexto("");
    inputRef.current?.blur();
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!abierto) {
      if (e.key === "ArrowDown" || e.key === "Enter") {
        e.preventDefault();
        abrir();
      }
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setIndiceActivo((i) => Math.min(i + 1, filas.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setIndiceActivo((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const fila = filas[indiceActivo];
      if (fila) elegirFila(fila);
    } else if (e.key === "Escape") {
      setAbierto(false);
      setTexto("");
    }
  }

  return (
    <div ref={contenedorRef} className="relative">
      <input
        ref={inputRef}
        type="text"
        role="combobox"
        aria-expanded={abierto}
        aria-autocomplete="list"
        autoComplete="off"
        disabled={disabled}
        placeholder={placeholder}
        value={abierto ? texto : (seleccionActual?.label ?? "")}
        onFocus={abrir}
        onChange={(e) => {
          setTexto(e.target.value);
          setIndiceActivo(0);
          if (!abierto) setAbierto(true);
        }}
        onKeyDown={onKeyDown}
        className={`h-11 w-full rounded-ds-pill border border-ds-divider bg-ds-surface px-ds-4 pr-9 font-ds-body text-ds-body text-ds-text placeholder:text-ds-text/40 outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ds-brand)] [caret-color:var(--ds-brand)] ${
          abierto ? "" : "cursor-pointer"
        } ${disabled ? "cursor-not-allowed opacity-60" : ""}`}
      />
      <ChevronDown
        size={16}
        strokeWidth={2.75}
        className={`pointer-events-none absolute right-ds-3 top-1/2 -translate-y-1/2 text-ds-text/50 transition-transform ${
          abierto ? "rotate-180" : ""
        }`}
      />
      {abierto ? (
        <div
          role="listbox"
          className="absolute z-20 mt-ds-1 max-h-60 w-full overflow-auto rounded-ds-md border border-ds-divider bg-ds-surface py-ds-1 shadow-ds-md"
        >
          {filas.length === 0 ? <p className="px-ds-4 py-ds-2 font-ds-body text-ds-small text-ds-text/60">Sin resultados.</p> : null}
          {filas.map((fila, i) => (
            <button
              key={fila.tipo === "opcion" ? fila.opcion.id : "__crear__"}
              type="button"
              role="option"
              aria-selected={i === indiceActivo}
              // onMouseDown en vez de onClick: dispara antes del blur
              // del input (que cerraría el listbox antes de procesar
              // el click).
              onMouseDown={(e) => {
                e.preventDefault();
                elegirFila(fila);
              }}
              onMouseEnter={() => setIndiceActivo(i)}
              className={`block w-full truncate px-ds-4 py-ds-2 text-left font-ds-body text-ds-small ${
                i === indiceActivo ? "bg-ds-brand/[0.08] text-ds-brand" : "text-ds-text"
              } ${fila.tipo === "crear" ? "font-medium text-ds-brand" : ""}`}
            >
              {fila.tipo === "opcion" ? fila.opcion.label : etiquetaCrear!(fila.texto)}
            </button>
          ))}
        </div>
      ) : null}
      {gestionHref ? (
        <a
          href={gestionHref}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-ds-1 inline-block font-ds-body text-ds-caption font-medium text-ds-text/60 transition-colors hover:text-ds-brand"
        >
          {gestionLabel ?? "Gestionar →"}
        </a>
      ) : null}
    </div>
  );
}
