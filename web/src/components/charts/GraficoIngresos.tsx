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
      <div className="flex h-72 flex-col items-center justify-center gap-ds-2 text-center">
        <p className="font-ds-body text-ds-small text-ds-text/70">Sin ingresos registrados en los últimos 12 meses.</p>
      </div>
    );
  }

  return (
    <div className="h-72 w-full">
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
            tickFormatter={(v) => formatMoneda(v, moneda)}
            tick={{ fill: "var(--color-ds-text)", fillOpacity: 0.6, fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            width={72}
          />
          <Tooltip
            formatter={(value) => formatMoneda(Number(value), moneda)}
            labelFormatter={(label) => etiquetaMes(String(label))}
            contentStyle={{
              background: "var(--color-ds-surface)",
              border: "1px solid var(--color-ds-divider)",
              borderRadius: 8,
              fontSize: 12,
            }}
          />
          {/* Sin tono "success/warning/danger" propio: accent2 (verde) =
              recibido, neutral = pendiente, accent (terracota) = vencido —
              mismo criterio que MAPA_ESTADO_TONO en otras partes del sistema. */}
          <Area type="monotone" dataKey="recibido" name="Recibido" stackId="1" stroke="var(--color-ds-accent2-700)" fill="var(--color-ds-accent2-200)" />
          <Area type="monotone" dataKey="pendiente" name="Pendiente" stackId="1" stroke="var(--color-ds-neutral-600)" fill="var(--color-ds-neutral-300)" />
          <Area type="monotone" dataKey="vencido" name="Vencido" stackId="1" stroke="var(--color-ds-accent-700)" fill="var(--color-ds-accent-200)" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
