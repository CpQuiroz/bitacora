"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { MoreHorizontal } from "lucide-react";
import { Card } from "./Card";
import { LoadingState } from "./LoadingState";
import { ErrorState } from "./ErrorState";
import { EmptyState } from "./EmptyState";

// Solo web — mobile no tiene tablas, usa listas/cards (ver docs/design-audit.md §3).
export type ColumnaTabla<T> = {
  /** Normalmente texto; admite ReactNode para casos como un checkbox "seleccionar todas". */
  encabezado: ReactNode;
  celda: (fila: T) => ReactNode;
  clase?: string;
};

export type AccionFila<T> = {
  etiqueta: string | ((fila: T) => string);
  onPress: (fila: T) => void;
  tono?: "brand" | "muted" | "peligro";
  oculta?: (fila: T) => boolean;
};

export type PropsTable<T> = {
  columnas: ColumnaTabla<T>[];
  filas: T[];
  claveFila: (fila: T) => string;
  acciones?: AccionFila<T>[];
  /**
   * Fila entera clickeable (ej. ir al detalle): clic, doble clic y Enter
   * con el teclado hacen lo mismo (convención de la app, tarea 148). Los
   * controles internos (checkbox, acciones) deben frenar la propagación.
   */
  onFilaClick?: (fila: T) => void;
  /** Muestra las acciones en un menú "⋯" en vez de botones sueltos (fila más limpia). */
  accionesEnMenu?: boolean;
  cargando?: boolean;
  error?: string | null;
  onReintentar?: () => void;
  vacio: { titulo: string; mensaje?: string; icono?: ReactNode };
};

const TONO_ACCION: Record<NonNullable<AccionFila<unknown>["tono"]>, string> = {
  brand: "text-ds-brand",
  muted: "text-ds-text-secondary",
  peligro: "text-ds-accent-700",
};

export function Table<T>({ columnas, filas, claveFila, acciones, onFilaClick, accionesEnMenu, cargando, error, onReintentar, vacio }: PropsTable<T>) {
  if (cargando) return <LoadingState />;
  if (error) return <ErrorState mensaje={error} onReintentar={onReintentar} />;
  if (filas.length === 0) return <EmptyState titulo={vacio.titulo} mensaje={vacio.mensaje} icono={vacio.icono} />;

  return (
    <Card sinRelleno elevacion="sm">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-ds-body">
          <thead>
            <tr className="border-b border-ds-divider text-[11px] font-medium uppercase tracking-[0.08em] text-ds-text-secondary">
              {columnas.map((col, i) => (
                <th key={i} className={`px-ds-4 py-ds-3 ${col.clase ?? ""}`}>
                  {col.encabezado}
                </th>
              ))}
              {acciones && acciones.length > 0 ? <th className={`px-ds-4 py-ds-3 ${accionesEnMenu ? "w-12" : ""}`}>{accionesEnMenu ? <span className="sr-only">Acciones</span> : "Acciones"}</th> : null}
            </tr>
          </thead>
          <tbody>
            {filas.map((fila) => (
              <tr
                key={claveFila(fila)}
                // Un doble clic dispara clic (detail 1), clic (detail 2) y
                // dblclick: solo el primero abre la fila (el doble clic
                // funciona igual y no abre 2-3 veces ni desde controles internos).
                onClick={
                  onFilaClick
                    ? (e) => {
                        if (e.detail <= 1) onFilaClick(fila);
                      }
                    : undefined
                }
                onKeyDown={
                  onFilaClick
                    ? (e) => {
                        if (e.key === "Enter" && e.target === e.currentTarget) onFilaClick(fila);
                      }
                    : undefined
                }
                tabIndex={onFilaClick ? 0 : undefined}
                title={onFilaClick ? "Abrir (clic o Enter)" : undefined}
                className={`border-b border-ds-text/[0.08] last:border-0 hover:bg-ds-text/[0.04] ${
                  onFilaClick ? "cursor-pointer focus-visible:bg-ds-text/[0.06] focus-visible:outline-none" : ""
                }`}
              >
                {columnas.map((col, i) => (
                  <td key={i} className={`px-ds-4 py-ds-3 ${col.clase ?? ""}`}>
                    {col.celda(fila)}
                  </td>
                ))}
                {acciones && acciones.length > 0 && accionesEnMenu ? (
                  <td className="px-ds-4 py-ds-3 text-right" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
                    <MenuAccionesFila fila={fila} acciones={acciones.filter((a) => !a.oculta?.(fila))} />
                  </td>
                ) : acciones && acciones.length > 0 ? (
                  <td className="px-ds-4 py-ds-3">
                    <div className="flex gap-ds-3 text-ds-small font-medium">
                      {acciones
                        .filter((a) => !a.oculta?.(fila))
                        .map((a, i) => (
                          <button
                            key={i}
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              a.onPress(fila);
                            }}
                            className={`hover:underline ${TONO_ACCION[a.tono ?? "brand"]}`}
                          >
                            {typeof a.etiqueta === "function" ? a.etiqueta(fila) : a.etiqueta}
                          </button>
                        ))}
                    </div>
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

// Menú "⋯" de una fila (tarea 148). Posición fija calculada desde el botón:
// así no lo recorta el contenedor con scroll horizontal de la tabla. Botones
// simples (patrón "disclosure"): al abrir, el foco va a la primera acción;
// Escape cierra y devuelve el foco al botón; salir con Tab o hacer scroll
// lo cierra. Sin acciones visibles no se muestra.
function MenuAccionesFila<T>({ fila, acciones }: { fila: T; acciones: AccionFila<T>[] }) {
  const [pos, setPos] = useState<{ top: number; right: number } | null>(null);
  const botonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!pos) return;
    menuRef.current?.querySelector("button")?.focus();
    const cerrar = () => setPos(null);
    const fuera = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node) && !botonRef.current?.contains(e.target as Node)) cerrar();
    };
    document.addEventListener("mousedown", fuera);
    window.addEventListener("scroll", cerrar, true);
    window.addEventListener("resize", cerrar);
    return () => {
      document.removeEventListener("mousedown", fuera);
      window.removeEventListener("scroll", cerrar, true);
      window.removeEventListener("resize", cerrar);
    };
  }, [pos]);

  if (acciones.length === 0) return null;

  function alternar() {
    if (pos) return setPos(null);
    const r = botonRef.current?.getBoundingClientRect();
    if (r) setPos({ top: r.bottom + 4, right: window.innerWidth - r.right });
  }

  function cerrarYVolver() {
    setPos(null);
    botonRef.current?.focus();
  }

  return (
    <>
      <button
        ref={botonRef}
        type="button"
        aria-label="Más acciones"
        aria-expanded={Boolean(pos)}
        onClick={alternar}
        className="inline-flex h-8 w-8 items-center justify-center rounded-ds-pill text-ds-text-secondary hover:bg-ds-brand/[0.08] hover:text-ds-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ds-brand)]"
      >
        <MoreHorizontal size={18} strokeWidth={2.5} />
      </button>
      {pos ? (
        <div
          ref={menuRef}
          onKeyDown={(e) => {
            if (e.key === "Escape") cerrarYVolver();
          }}
          onBlur={(e) => {
            if (!menuRef.current?.contains(e.relatedTarget as Node)) setPos(null);
          }}
          style={{ position: "fixed", top: pos.top, right: pos.right }}
          className="z-50 min-w-[10rem] overflow-hidden rounded-ds-md border border-ds-divider bg-ds-surface py-ds-1 text-left shadow-ds-md"
        >
          {acciones.map((a, i) => (
            <button
              key={i}
              type="button"
              onClick={() => {
                setPos(null);
                a.onPress(fila);
              }}
              className={`block w-full px-ds-4 py-ds-2 text-left font-ds-body text-ds-small font-medium hover:bg-ds-brand/[0.08] focus-visible:bg-ds-brand/[0.08] focus-visible:outline-none ${TONO_ACCION[a.tono ?? "brand"]}`}
            >
              {typeof a.etiqueta === "function" ? a.etiqueta(fila) : a.etiqueta}
            </button>
          ))}
        </div>
      ) : null}
    </>
  );
}
