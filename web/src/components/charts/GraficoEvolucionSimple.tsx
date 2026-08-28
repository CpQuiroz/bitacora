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
      <div className="flex h-64 flex-col items-center justify-center gap-2 text-center">
        <p className="text-sm text-muted">{mensajeVacio}</p>
      </div>
    );
  }

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={datos} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis
            dataKey="mes"
            tickFormatter={etiquetaMes}
            tick={{ fill: "var(--muted)", fontSize: 12 }}
            axisLine={{ stroke: "var(--border)" }}
            tickLine={false}
          />
          <YAxis
            tickFormatter={formatearValor}
            tick={{ fill: "var(--muted)", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            width={72}
          />
          <Tooltip
            formatter={(value) => formatearValor(Number(value))}
            labelFormatter={(label) => etiquetaMes(String(label))}
            contentStyle={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              fontSize: 12,
            }}
          />
          <Area type="monotone" dataKey="monto" stroke="var(--brand)" fill="var(--brand-soft)" strokeWidth={2} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
