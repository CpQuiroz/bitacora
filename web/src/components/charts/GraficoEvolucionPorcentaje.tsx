"use client";

import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

// Reutilizable para cualquier tasa (%) evolucionando mes a mes — Tasa
// de Conversión, Tasa de Conclusión, Tasa de Retención. "valor: null"
// en un mes significa que no hubo base para calcular el % ese mes (no
// es un 0% real) — recharts salta ese punto en vez de dibujarlo.
export type PuntoPorcentaje = { mes: string; valor: number | null };

function etiquetaMes(mes: string) {
  const [anio, mesNum] = mes.split("-");
  const nombre = new Date(Number(anio), Number(mesNum) - 1, 1).toLocaleDateString("es-CL", { month: "short" });
  return nombre.replace(".", "");
}

export function GraficoEvolucionPorcentaje({ datos, mensajeVacio }: { datos: PuntoPorcentaje[]; mensajeVacio: string }) {
  const sinDatos = datos.every((d) => d.valor == null);

  if (sinDatos) {
    return (
      <div className="flex h-56 flex-col items-center justify-center gap-2 text-center">
        <p className="text-sm text-muted">{mensajeVacio}</p>
      </div>
    );
  }

  return (
    <div className="h-56 w-full">
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
            tickFormatter={(v) => `${v}%`}
            tick={{ fill: "var(--muted)", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            width={40}
            domain={[0, 100]}
          />
          <Tooltip
            formatter={(value) => `${Number(value).toFixed(0)}%`}
            labelFormatter={(label) => etiquetaMes(String(label))}
            contentStyle={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              fontSize: 12,
            }}
          />
          {/* dot visible (no solo la línea): con series mayormente
              null un único punto aislado no dibuja ningún segmento —
              sin el punto, ese mes quedaría invisible. */}
          <Line
            type="monotone"
            dataKey="valor"
            stroke="var(--brand)"
            strokeWidth={2.5}
            dot={{ r: 3, fill: "var(--brand)", strokeWidth: 0 }}
            connectNulls={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
