import type { ComponentType, ReactNode } from "react";
import { Card } from "./ui";

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
  emptyState: { icon: ComponentType<{ className?: string }>; message: string };
};

const VARIANT_CLASS: Record<NonNullable<AccionFila<unknown>["variant"]>, string> = {
  brand: "text-brand",
  muted: "text-muted",
  danger: "text-danger",
};

// Patrón de tabla compartido entre Checklists, Tipos de OS, Categorías de
// Gastos y Centros de Costo — misma Card + thead + filas + columna de
// acciones que ya tenían las 4 a mano, ahora en un solo lugar. El
// formulario de alta/edición se queda en cada página: varía demasiado
// entre pantallas para valer la pena abstraerlo también.
export function DataTable<T>({ columns, rows, rowKey, actions, loading, error, emptyState }: DataTableProps<T>) {
  if (loading) return <p className="text-sm text-muted">Cargando…</p>;
  if (error) return <p className="text-sm text-danger">{error}</p>;
  if (rows.length === 0) {
    const Icon = emptyState.icon;
    return (
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border py-16 text-center">
        <Icon className="h-8 w-8 text-muted" />
        <p className="text-sm text-muted">{emptyState.message}</p>
      </div>
    );
  }

  return (
    <Card className="overflow-x-auto p-0">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-border bg-surface-sunken font-mono text-[10px] uppercase tracking-[0.1em] text-muted">
            {columns.map((col) => (
              <th key={col.header} className={`px-5 py-3 font-medium ${col.className ?? ""}`}>
                {col.header}
              </th>
            ))}
            {actions && actions.length > 0 && <th className="px-5 py-3 font-medium">Acciones</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={rowKey(row)}
              className="border-b border-border-soft last:border-0 even:bg-[#fafbfc] hover:bg-surface-sunken"
            >
              {columns.map((col) => (
                <td key={col.header} className={`px-5 py-3 ${col.className ?? ""}`}>
                  {col.cell(row)}
                </td>
              ))}
              {actions && actions.length > 0 && (
                <td className="px-5 py-3">
                  <div className="flex gap-3 text-xs font-medium">
                    {actions
                      .filter((a) => !a.hidden?.(row))
                      .map((a, i) => {
                        const label = typeof a.label === "function" ? a.label(row) : a.label;
                        return (
                          <button
                            key={i}
                            type="button"
                            onClick={() => a.onClick(row)}
                            className={`hover:underline ${VARIANT_CLASS[a.variant ?? "brand"]}`}
                          >
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
    </Card>
  );
}
