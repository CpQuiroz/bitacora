"use client";

import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

// Reutilizable para cualquier "X por Período" que compare un
// subconjunto contra el total mes a mes — Cotizaciones (Aprobadas/
// Total), OS (Completadas/Total), Clientes (Nuevos/Total).
export type PuntoEvolucionDoble = { mes: string; a: number; b: number };

function etiquetaMes(mes: string) {
  const [anio, mesNum] = mes.split("-");
  const nombre = new Date(Number(anio), Number(mesNum) - 1, 1).toLocaleDateString("es-CL", { month: "short" });
  return nombre.replace(".", "");
}

export function GraficoEvolucionDoble({
  datos,
  etiquetaA,
  etiquetaB,
  mensajeVacio,
  formatearValor,
}: {
  datos: PuntoEvolucionDoble[];
  etiquetaA: string;
  etiquetaB: string;
  mensajeVacio: string;
  formatearValor?: (n: number) => string;
}) {
  const sinDatos = datos.every((d) => d.a === 0 && d.b === 0);

  if (sinDatos) {
    return (
      <div className="flex h-72 flex-col items-center justify-center gap-2 text-center">
        <p className="text-sm text-muted">{mensajeVacio}</p>
      </div>
    );
  }

  const fmt = formatearValor ?? ((n: number) => String(n));

  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={datos} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis
            dataKey="mes"
            tickFormatter={etiquetaMes}
            tick={{ fill: "var(--muted)", fontSize: 12 }}
            axisLine={{ stroke: "var(--border)" }}
            tickLine={false}
          />
          <YAxis
            tickFormatter={fmt}
            tick={{ fill: "var(--muted)", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            width={64}
          />
          <Tooltip
            formatter={(value) => fmt(Number(value))}
            labelFormatter={(label) => etiquetaMes(String(label))}
            contentStyle={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              fontSize: 12,
            }}
          />
          <Legend wrapperStyle={{ fontSize: 12, color: "var(--foreground)" }} />
          <Line type="monotone" dataKey="b" name={etiquetaB} stroke="var(--border)" strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="a" name={etiquetaA} stroke="var(--brand)" strokeWidth={2.5} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
