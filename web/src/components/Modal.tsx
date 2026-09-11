"use client";

import { useEffect, type ReactNode } from "react";
import { X } from "lucide-react";

// Primer Modal del proyecto — antes cada pantalla que necesitaba un
// diálogo usaba un panel inline (Card que se expande/contrae). Este es
// un overlay real, para casos como el Selector de Catálogo donde tiene
// sentido cubrir el contenido de atrás (listas largas, filtros propios).
// Sin dependencia nueva — un <div> fixed + backdrop alcanza.
//
// PASO 6 (sistema de diseño) — retokenizado a ds-. No usa <Dialog> de
// packages/ui porque necesita los tamaños wide/xl (formularios largos,
// selector de catálogo) que Dialog no tiene (siempre max-w-lg) — mismo
// motivo que InputMonto, ver ese archivo.
export function Modal({
  open,
  onClose,
  title,
  children,
  wide,
  xl,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  wide?: boolean;
  // xl: para formularios largos (checklist de mantención). max-w-3xl.
  xl?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-ds-4">
      <div className="absolute inset-0 bg-ds-neutral-900/50" onClick={onClose} aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`relative flex max-h-[85vh] w-full flex-col overflow-hidden rounded-[32px] bg-ds-surface shadow-ds-lg ${
          xl ? "max-w-3xl" : wide ? "max-w-2xl" : "max-w-lg"
        }`}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-ds-divider px-ds-6 py-ds-4">
          <p className="ds-heading text-ds-h5 text-ds-text">{title}</p>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="rounded-ds-pill p-ds-1 text-ds-text/60 transition-colors hover:bg-ds-text/[0.07] hover:text-ds-text"
          >
            <X size={18} strokeWidth={2.75} />
          </button>
        </div>
        <div className="overflow-y-auto px-ds-6 py-ds-4">{children}</div>
      </div>
    </div>
  );
}
