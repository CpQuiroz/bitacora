"use client";

import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

export type PuntoDistribucion = { estado: string; cantidad: number };

// Fallback cuando el caller no pasa coloresPorEstado — 5 tonos
// distinguibles de la paleta nueva (sin colores fuera de tokens.json).
const PALETA = [
  "var(--ds-brand)",
  "var(--color-ds-accent2-600)",
  "var(--color-ds-accent-700)",
  "var(--color-ds-neutral-500)",
  "var(--color-ds-accent2-800)",
];

export function GraficoDistribucion({
  datos,
  mensajeVacio,
  coloresPorEstado,
  formatearValor,
}: {
  datos: PuntoDistribucion[];
  mensajeVacio: string;
  coloresPorEstado?: Record<string, string>;
  // Por defecto el campo "cantidad" es un conteo — cuando en realidad
  // representa un monto (ej. donut de ingresos), esto lo formatea como
  // moneda en el tooltip en vez de mostrar el número pelado.
  formatearValor?: (n: number) => string;
}) {
  const total = datos.reduce((acc, d) => acc + d.cantidad, 0);

  if (total === 0) {
    return (
      <div className="flex h-56 flex-col items-center justify-center gap-ds-2 text-center">
        <p className="font-ds-body text-ds-small text-ds-text/70">{mensajeVacio}</p>
      </div>
    );
  }

  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={datos} dataKey="cantidad" nameKey="estado" innerRadius={45} outerRadius={75} paddingAngle={2}>
            {datos.map((d, i) => (
              <Cell key={d.estado} fill={coloresPorEstado?.[d.estado] ?? PALETA[i % PALETA.length]} />
            ))}
          </Pie>
          <Tooltip
            formatter={(value, name) => [
              formatearValor ? formatearValor(Number(value)) : String(value),
              String(name).replace("_", " "),
            ]}
            contentStyle={{
              background: "var(--color-ds-surface)",
              border: "1px solid var(--color-ds-divider)",
              borderRadius: 8,
              fontSize: 12,
            }}
          />
          <Legend
            formatter={(value: string) => (
              <span style={{ color: "var(--color-ds-text)", fontSize: 12, textTransform: "capitalize" }}>
                {value.replace("_", " ")}
              </span>
            )}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
