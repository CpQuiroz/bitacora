"use client";

import { useEffect, type ReactNode } from "react";
import { X } from "lucide-react";

// Bloque H — Panel de Acciones: un solo drawer lateral reutilizado
// entre el detalle de Cotización y el de Cobro (antes cada uno tenía
// sus propios botones sueltos repartidos en varias Cards). No impone
// qué acciones exactas mostrar — cada pantalla arma su propio
// contenido para cada sección con sus componentes de siempre
// (Button, Select, etc.), el panel solo da el layout/drawer/agrupación
// común. PASO 6 (sistema de diseño) — migrado, ver docs/design-system.md.
// Una sección se omite si no se pasa esa prop (ej. Cobro no
// tiene "Compartir" con PDF como Cotización).
export function PanelAcciones({
  open,
  onClose,
  titulo,
  subtitulo,
  seccionEstado,
  seccionCompartir,
  seccionOtras,
  seccionPeligro,
}: {
  open: boolean;
  onClose: () => void;
  titulo: string;
  subtitulo?: string;
  seccionEstado?: ReactNode;
  seccionCompartir?: ReactNode;
  seccionOtras?: ReactNode;
  seccionPeligro?: ReactNode;
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
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-ds-neutral-900/50" onClick={onClose} aria-hidden="true" />
      <div role="dialog" aria-modal="true" aria-label={titulo} className="relative flex h-full w-full max-w-sm flex-col overflow-hidden border-l border-ds-divider bg-ds-surface shadow-ds-lg">
        <div className="flex shrink-0 items-center justify-between border-b border-ds-divider px-ds-4 py-ds-4">
          <div className="min-w-0">
            <p className="truncate font-ds-body text-ds-small font-semibold text-ds-text">{titulo}</p>
            {subtitulo && <p className="truncate font-ds-body text-ds-caption text-ds-text/60">{subtitulo}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="shrink-0 rounded-ds-pill p-ds-1 text-ds-text/60 transition-colors hover:bg-ds-brand/[0.08] hover:text-ds-brand"
          >
            <X size={16} strokeWidth={2.75} />
          </button>
        </div>

        <div className="flex flex-1 flex-col gap-ds-6 overflow-y-auto px-ds-4 py-ds-4">
          {seccionEstado && (
            <div>
              <p className="mb-ds-3 font-ds-body text-[11px] font-semibold uppercase tracking-wide text-ds-text/60">Estado</p>
              {seccionEstado}
            </div>
          )}
          {seccionCompartir && (
            <div>
              <p className="mb-ds-3 font-ds-body text-[11px] font-semibold uppercase tracking-wide text-ds-text/60">Compartir</p>
              {seccionCompartir}
            </div>
          )}
          {seccionOtras && (
            <div>
              <p className="mb-ds-3 font-ds-body text-[11px] font-semibold uppercase tracking-wide text-ds-text/60">Otras acciones</p>
              {seccionOtras}
            </div>
          )}
          {seccionPeligro && (
            <div className="rounded-ds-md border border-ds-accent-700 bg-ds-accent-100 p-ds-4">
              <p className="mb-ds-3 font-ds-body text-[11px] font-semibold uppercase tracking-wide text-ds-accent-700">Zona de peligro</p>
              {seccionPeligro}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
