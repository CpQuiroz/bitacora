import type { ComponentType, ReactNode } from "react";
import { Card, EmptyState, ErrorState, LoadingState } from "@bitacora/ui/web";

export type ColumnaTabla<T> = {
  header: string;
  cell: (row: T) => ReactNode;
  className?: string;
};

export type AccionFila<T> = {
  label: string | ((row: T) => string);
  onClick: (row: T) => void;
  variant?: "brand" | "muted" | "danger";
  hidden?: (row: T) => boolean;
};

type DataTableProps<T> = {
  columns: ColumnaTabla<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  actions?: AccionFila<T>[];
  loading?: boolean;
  error?: string | null;
  emptyState: { icon: ComponentType<{ size?: number; strokeWidth?: number }>; message: string };
};

const VARIANT_CLASS: Record<NonNullable<AccionFila<unknown>["variant"]>, string> = {
  brand: "text-ds-brand",
  muted: "text-ds-text/60",
  danger: "text-ds-accent-700",
};

// Patrón de tabla compartido entre Checklists, Tipos de OS, Categorías de
// Gastos y Centros de Costo — misma Card + thead + filas + columna de
// acciones que ya tenían las 4 a mano, ahora en un solo lugar. El
// formulario de alta/edición se queda en cada página: varía demasiado
// entre pantallas para valer la pena abstraerlo también.
//
// PASO 6 (sistema de diseño) — migrado. Ver docs/design-system.md. No se
// reemplazó por <Table> de packages/ui (que cubre casi lo mismo) porque
// también lo usa /superadmin (shell aparte, fuera de este bucket) — se
// retokeniza en el lugar en vez de duplicar el trabajo de call-sites dos
// veces cuando le toque su turno a esa pantalla.
export function DataTable<T>({ columns, rows, rowKey, actions, loading, error, emptyState }: DataTableProps<T>) {
  if (loading) return <LoadingState />;
  if (error) return <ErrorState mensaje={error} />;
  if (rows.length === 0) {
    const Icono = emptyState.icon;
    return <EmptyState titulo={emptyState.message} icono={<Icono size={28} strokeWidth={2.75} />} />;
  }

  return (
    <Card sinRelleno elevacion="sm">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-ds-body">
          <thead>
            <tr className="border-b border-ds-divider text-[11px] font-medium uppercase tracking-[0.08em] text-ds-text/60">
              {columns.map((col) => (
                <th key={col.header} className={`px-ds-4 py-ds-3 ${col.className ?? ""}`}>
                  {col.header}
                </th>
              ))}
              {actions && actions.length > 0 && <th className="px-ds-4 py-ds-3">Acciones</th>}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={rowKey(row)} className="border-b border-ds-text/[0.08] last:border-0 even:bg-ds-text/[0.02] hover:bg-ds-text/[0.04]">
                {columns.map((col) => (
                  <td key={col.header} className={`px-ds-4 py-ds-3 ${col.className ?? ""}`}>
                    {col.cell(row)}
                  </td>
                ))}
                {actions && actions.length > 0 && (
                  <td className="px-ds-4 py-ds-3">
                    <div className="flex gap-ds-3 text-ds-caption font-medium">
                      {actions
                        .filter((a) => !a.hidden?.(row))
                        .map((a, i) => {
                          const label = typeof a.label === "function" ? a.label(row) : a.label;
                          return (
                            <button key={i} type="button" onClick={() => a.onClick(row)} className={`hover:underline ${VARIANT_CLASS[a.variant ?? "brand"]}`}>
                              {label}
                            </button>
                          );
                        })}
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
