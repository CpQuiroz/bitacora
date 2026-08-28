"use client";

import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatMoneda } from "@/lib/formatMoneda";

export type PuntoIngresoMes = { mes: string; recibido: number; pendiente: number; vencido: number };

function etiquetaMes(mes: string) {
  const [anio, mesNum] = mes.split("-");
  const nombre = new Date(Number(anio), Number(mesNum) - 1, 1).toLocaleDateString("es-CL", { month: "short" });
  return nombre.replace(".", "");
}

export function GraficoIngresos({ datos, moneda = "CLP" }: { datos: PuntoIngresoMes[]; moneda?: string }) {
  const sinDatos = datos.every((d) => d.recibido === 0 && d.pendiente === 0 && d.vencido === 0);

  if (sinDatos) {
    return (
      <div className="flex h-72 flex-col items-center justify-center gap-2 text-center">
        <p className="text-sm text-muted">Sin ingresos registrados en los últimos 12 meses.</p>
      </div>
    );
  }

  return (
    <div className="h-72 w-full">
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
            tickFormatter={(v) => formatMoneda(v, moneda)}
            tick={{ fill: "var(--muted)", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            width={72}
          />
          <Tooltip
            formatter={(value) => formatMoneda(Number(value), moneda)}
            labelFormatter={(label) => etiquetaMes(String(label))}
            contentStyle={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              fontSize: 12,
            }}
          />
          <Area type="monotone" dataKey="recibido" name="Recibido" stackId="1" stroke="var(--success)" fill="var(--success-soft)" />
          <Area type="monotone" dataKey="pendiente" name="Pendiente" stackId="1" stroke="var(--warning)" fill="var(--warning-soft)" />
          <Area type="monotone" dataKey="vencido" name="Vencido" stackId="1" stroke="var(--danger)" fill="var(--danger-soft)" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
