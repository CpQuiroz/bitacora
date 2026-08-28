"use client";

import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

// Reutilizable para cualquier métrica de barras "una por mes, cada una
// con su propio color" — hoy Tiempo Promedio de Conclusión.
export type PuntoBarraMes = { mes: string; valor: number | null };

function etiquetaMes(mes: string) {
  const [anio, mesNum] = mes.split("-");
  const nombre = new Date(Number(anio), Number(mesNum) - 1, 1).toLocaleDateString("es-CL", { month: "short" });
  return nombre.replace(".", "");
}

// Ángulo dorado (137.5°) entre barras consecutivas: da 12 tonos bien
// distribuidos y distinguibles entre sí sin tener que hardcodear una
// paleta de 12 colores a mano.
function colorMes(indice: number) {
  return `hsl(${(indice * 137.5) % 360}, 60%, 58%)`;
}

export function GraficoBarras({
  datos,
  mensajeVacio,
  sufijo = "",
}: {
  datos: PuntoBarraMes[];
  mensajeVacio: string;
  sufijo?: string;
}) {
  const sinDatos = datos.every((d) => d.valor == null);

  if (sinDatos) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-2 text-center">
        <p className="text-sm text-muted">{mensajeVacio}</p>
      </div>
    );
  }

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={datos} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis
            dataKey="mes"
            tickFormatter={etiquetaMes}
            tick={{ fill: "var(--muted)", fontSize: 12 }}
            axisLine={{ stroke: "var(--border)" }}
            tickLine={false}
          />
          <YAxis
            tickFormatter={(v) => `${v}${sufijo}`}
            tick={{ fill: "var(--muted)", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            width={40}
          />
          <Tooltip
            formatter={(value) => (value == null ? "Sin datos" : `${value}${sufijo}`)}
            labelFormatter={(label) => etiquetaMes(String(label))}
            contentStyle={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              fontSize: 12,
            }}
          />
          <Bar dataKey="valor" radius={[4, 4, 0, 0]}>
            {datos.map((d, i) => (
              <Cell key={d.mes} fill={colorMes(i)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
