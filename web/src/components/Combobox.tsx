"use client";

import { useEffect, useRef, useState } from "react";

export type ComboboxOpcion = { id: string; label: string };

// Combobox con búsqueda y navegación por teclado (flechas + Enter),
// sobre un <input> normal — sin librería nueva, mismo criterio que el
// resto del design system (ver ui.tsx, sin Radix/shadcn). Es el
// primitivo genérico: solo busca/selecciona entre "opciones". La
// lógica de "si no existe, crear uno nuevo" la arma cada caller vía
// etiquetaCrear/onCrear (ver ComboboxCliente y ComboboxResponsable,
// que sí saben qué significa "crear" para cada entidad).
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
        className="w-full rounded-lg border border-border bg-surface px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      />
      {abierto && (
        <div
          role="listbox"
          className="absolute z-20 mt-1 max-h-60 w-full overflow-auto rounded-lg border border-border bg-surface py-1 shadow-lg"
        >
          {filas.length === 0 && <p className="px-3.5 py-2 text-sm text-muted">Sin resultados.</p>}
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
              className={`block w-full truncate px-3.5 py-2 text-left text-sm ${
                i === indiceActivo ? "bg-brand-soft text-brand" : "text-foreground"
              } ${fila.tipo === "crear" ? "font-medium text-brand" : ""}`}
            >
              {fila.tipo === "opcion" ? fila.opcion.label : etiquetaCrear!(fila.texto)}
            </button>
          ))}
        </div>
      )}
      {gestionHref && (
        <a
          href={gestionHref}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-1 inline-block text-xs font-medium text-muted transition-colors hover:text-brand"
        >
          {gestionLabel ?? "Gestionar →"}
        </a>
      )}
    </div>
  );
}
