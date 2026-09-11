"use client";

import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

// Reutilizable para cualquier serie única "monto por mes" con buckets
// arbitrarios (no necesariamente los últimos 12 meses fijos) — Gastos
// en OS, Gastos por Categoría, Gastos por Centro de Costo.
export type PuntoEvolucionSimple = { mes: string; monto: number };

function etiquetaMes(mes: string) {
  const [anio, mesNum] = mes.split("-");
  const nombre = new Date(Number(anio), Number(mesNum) - 1, 1).toLocaleDateString("es-CL", { month: "short" });
  return `${nombre.replace(".", "")} ${anio.slice(2)}`;
}

export function GraficoEvolucionSimple({
  datos,
  mensajeVacio,
  formatearValor,
}: {
  datos: PuntoEvolucionSimple[];
  mensajeVacio: string;
  formatearValor: (n: number) => string;
}) {
  if (datos.length === 0) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-ds-2 text-center">
        <p className="font-ds-body text-ds-small text-ds-text/70">{mensajeVacio}</p>
      </div>
    );
  }

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={datos} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-ds-divider)" />
          <XAxis
            dataKey="mes"
            tickFormatter={etiquetaMes}
            tick={{ fill: "var(--color-ds-text)", fillOpacity: 0.6, fontSize: 12 }}
            axisLine={{ stroke: "var(--color-ds-divider)" }}
            tickLine={false}
          />
          <YAxis
            tickFormatter={formatearValor}
            tick={{ fill: "var(--color-ds-text)", fillOpacity: 0.6, fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            width={72}
          />
          <Tooltip
            formatter={(value) => formatearValor(Number(value))}
            labelFormatter={(label) => etiquetaMes(String(label))}
            contentStyle={{
              background: "var(--color-ds-surface)",
              border: "1px solid var(--color-ds-divider)",
              borderRadius: 8,
              fontSize: 12,
            }}
          />
          <Area type="monotone" dataKey="monto" stroke="var(--ds-brand)" fill="var(--ds-brand)" fillOpacity={0.15} strokeWidth={2} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
