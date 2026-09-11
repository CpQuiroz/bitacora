"use client";

import { useEffect } from "react";
import { X } from "lucide-react";
import type { PropsDialog } from "../tipos";

export function Dialog({ abierto, onCerrar, titulo, children }: PropsDialog) {
  useEffect(() => {
    if (!abierto) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onCerrar();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [abierto, onCerrar]);

  if (!abierto) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-ds-4">
      <div className="absolute inset-0 bg-ds-neutral-900/50" onClick={onCerrar} aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={titulo}
        className="relative flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-[32px] bg-ds-surface shadow-ds-lg"
      >
        <div className="flex shrink-0 items-center justify-between border-b border-ds-divider px-ds-6 py-ds-4">
          <p className="ds-heading text-ds-h5 text-ds-text">{titulo}</p>
          <button
            type="button"
            onClick={onCerrar}
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
