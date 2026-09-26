"use client";

import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import type { PropsDialog } from "../tipos";

const PILA: symbol[] = [];

export function Dialog({ abierto, onCerrar, titulo, children }: PropsDialog) {
  const cajaRef = useRef<HTMLDivElement>(null);
  const onCerrarRef = useRef(onCerrar);
  useEffect(() => {
    onCerrarRef.current = onCerrar;
  });

  // Al abrir, el foco entra al diálogo (teclado y lector de pantalla); al
  // cerrar vuelve a donde estaba.
  useEffect(() => {
    if (!abierto) return;
    const previo = document.activeElement as HTMLElement | null;
    cajaRef.current?.focus();
    return () => previo?.focus?.();
  }, [abierto]);

  // Escape cierra solo el diálogo de arriba (ej. la confirmación abierta
  // desde un modal no cierra también el modal): pila de abiertos y
  // listener en captura que corta la propagación.
  useEffect(() => {
    if (!abierto) return;
    const token = Symbol();
    PILA.push(token);
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== "Escape" || PILA[PILA.length - 1] !== token) return;
      e.stopImmediatePropagation();
      onCerrarRef.current();
    }
    document.addEventListener("keydown", onKeyDown, true);
    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
      PILA.splice(PILA.indexOf(token), 1);
    };
  }, [abierto]);

  if (!abierto) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-ds-4">
      <div className="absolute inset-0 bg-ds-neutral-900/50" onClick={onCerrar} aria-hidden="true" />
      <div
        ref={cajaRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={titulo}
        className="relative flex max-h-[85vh] outline-none w-full max-w-lg flex-col overflow-hidden rounded-[32px] bg-ds-surface shadow-ds-lg"
      >
        <div className="flex shrink-0 items-center justify-between border-b border-ds-divider px-ds-6 py-ds-4">
          <p className="ds-heading text-ds-h5 text-ds-text">{titulo}</p>
          <button
            type="button"
            onClick={onCerrar}
            aria-label="Cerrar"
            className="rounded-ds-pill p-ds-1 text-ds-text-secondary transition-colors hover:bg-ds-text/[0.07] hover:text-ds-text"
          >
            <X size={18} strokeWidth={2.75} />
          </button>
        </div>
        <div className="overflow-y-auto px-ds-6 py-ds-4">{children}</div>
      </div>
    </div>
  );
}
