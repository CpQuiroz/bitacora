"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import { formatMoneda } from "@/lib/formatMoneda";
import { Card, ErrorText } from "@/components/ui";
import { GraficoIngresos, type PuntoIngresoMes } from "@/components/charts/GraficoIngresos";
import { IconArrowRight, IconChartBar, IconClipboardCheck, IconTag, IconUsers, IconWallet } from "@/components/icons";
import { EstadoCargando } from "@/components/estados";
import { useInformes } from "../InformesContext";

type Kpis = {
  ingresos_totales: number;
  cant_presupuestos: number;
  pct_conversion: number;
  ot_completadas: number;
  pct_conclusion_ot: number;
  clientes_activos: number;
};

type ResumenGastos = {
  pagado: number;
  pendiente: number;
  vencido: number;
  total: number;
  cantidad_pagado: number;
  cantidad_pendiente: number;
  cantidad_vencido: number;
  cantidad_total: number;
};

type IngresosVsGastos = { ingresos_recibidos: number; gastos_pagados: number; resultado_neto: number };

type Datos = {
  kpis: Kpis;
  resumen_gastos: ResumenGastos;
  ingresos_vs_gastos: IngresosVsGastos;
  ingresos_por_mes: PuntoIngresoMes[];
};

function KpiCard({ etiqueta, valor, sub }: { etiqueta: string; valor: string; sub?: string }) {
  return (
    <Card className="p-4">
      <p className="text-xs font-medium text-muted">{etiqueta}</p>
      <p className="mt-1 text-xl font-semibold tabular-nums text-foreground">{valor}</p>
      {sub && <p className="mt-0.5 text-xs text-muted">{sub}</p>}
    </Card>
  );
}

function MiniCard({ etiqueta, valor, cantidad, color }: { etiqueta: string; valor: string; cantidad: number; color: string }) {
  return (
    <div className="rounded-xl border border-border p-3">
      <p className="text-xs text-muted">{etiqueta}</p>
      <p className={`mt-1 text-base font-semibold tabular-nums ${color}`}>{valor}</p>
      <p className="text-xs text-muted">{cantidad} {cantidad === 1 ? "ítem" : "ítems"}</p>
    </div>
  );
}

const ACCESOS = [
  { href: "/dashboard/informes/financiero", icon: IconWallet, titulo: "Financiero", desc: "Ingresos, cobros y morosidad" },
  { href: "/dashboard/informes/ventas", icon: IconTag, titulo: "Ventas", desc: "Cotizaciones, conversión y ticket promedio" },
  { href: "/dashboard/informes/operaciones", icon: IconClipboardCheck, titulo: "Operaciones", desc: "OS, tiempo promedio y productividad" },
  { href: "/dashboard/informes/clientes", icon: IconUsers, titulo: "Clientes", desc: "Base de clientes, top clientes y retención" },
  { href: "/dashboard/informes/financiero", icon: IconChartBar, titulo: "Ganancia/Pérdida", desc: "Ingresos vs gastos y análisis de rentabilidad" },
];

const pct = (n: number) => `${n.toFixed(0)}%`;

export default function VisionGeneralPage() {
  const { desde, hasta, refreshKey, usuario } = useInformes();
  const [datos, setDatos] = useState<Datos | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setDatos(null);
    setError(null);
    apiFetch(`/api/informes/vision-general?periodo=personalizado&desde=${desde}&hasta=${hasta}`)
      .then(async (res) => {
        if (!res.ok) {
          setError("No se pudo cargar el informe");
          return;
        }
        setDatos(await res.json());
      })
      .catch(() => setError("No se pudo cargar el informe"));
  }, [desde, hasta, refreshKey]);

  const moneda = usuario.empresa.moneda;

  if (error) return <ErrorText>{error}</ErrorText>;
  if (!datos) return <EstadoCargando />;

  const { kpis, resumen_gastos, ingresos_vs_gastos, ingresos_por_mes } = datos;

  // TODO: decisión pendiente — estas KPIs (Ingreso Total, Cotizaciones,
  // OS Completadas, Clientes Activos) y el gráfico "Ingresos vs Gastos"
  // duplican casi exactamente lo que ya muestra el Dashboard
  // (web/src/app/dashboard/page.tsx). Evaluar si el Dashboard pasa a
  // ser más accionable (accesos rápidos + alertas) y esta pantalla se
  // queda con el análisis profundo, sin repetir las mismas métricas.
  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <KpiCard etiqueta="Ingreso Total" valor={formatMoneda(kpis.ingresos_totales, moneda)} />
        <KpiCard etiqueta="Total de Gastos" valor={formatMoneda(resumen_gastos.total, moneda)} />
        <KpiCard etiqueta="Cotizaciones" valor={String(kpis.cant_presupuestos)} sub={`${pct(kpis.pct_conversion)} de conversión`} />
        <KpiCard etiqueta="OS Completadas" valor={String(kpis.ot_completadas)} sub={`${pct(kpis.pct_conclusion_ot)} de conclusión`} />
        <KpiCard etiqueta="Clientes Activos" valor={String(kpis.clientes_activos)} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="mb-4 text-sm font-semibold text-foreground">Ingresos vs Gastos</h2>
          <div className="flex flex-col divide-y divide-border text-sm">
            <div className="flex items-center justify-between py-2.5">
              <span className="text-muted">Ingreso Recibido</span>
              <span className="font-medium text-success">{formatMoneda(ingresos_vs_gastos.ingresos_recibidos, moneda)}</span>
            </div>
            <div className="flex items-center justify-between py-2.5">
              <span className="text-muted">Gastos Pagados</span>
              <span className="font-medium text-danger">{formatMoneda(ingresos_vs_gastos.gastos_pagados, moneda)}</span>
            </div>
            <div className="flex items-center justify-between py-2.5">
              <span className="font-semibold text-foreground">Resultado Neto</span>
              <span className={`font-semibold ${ingresos_vs_gastos.resultado_neto >= 0 ? "text-success" : "text-danger"}`}>
                {formatMoneda(ingresos_vs_gastos.resultado_neto, moneda)}
              </span>
            </div>
          </div>
        </Card>

        <Card>
          <h2 className="mb-4 text-sm font-semibold text-foreground">Resumen de Gastos</h2>
          <div className="grid grid-cols-2 gap-3">
            <MiniCard etiqueta="Pagado" valor={formatMoneda(resumen_gastos.pagado, moneda)} cantidad={resumen_gastos.cantidad_pagado} color="text-success" />
            <MiniCard etiqueta="Pendiente" valor={formatMoneda(resumen_gastos.pendiente, moneda)} cantidad={resumen_gastos.cantidad_pendiente} color="text-warning" />
            <MiniCard etiqueta="Vencido" valor={formatMoneda(resumen_gastos.vencido, moneda)} cantidad={resumen_gastos.cantidad_vencido} color="text-danger" />
            <MiniCard etiqueta="Total de Gastos" valor={formatMoneda(resumen_gastos.total, moneda)} cantidad={resumen_gastos.cantidad_total} color="text-foreground" />
          </div>
        </Card>
      </div>

      <Card>
        <h2 className="mb-4 text-sm font-semibold text-foreground">Ingreso por Período</h2>
        <GraficoIngresos datos={ingresos_por_mes} moneda={moneda} />
      </Card>

      <Card>
        <h2 className="mb-4 text-sm font-semibold text-foreground">Informes Detallados</h2>
        <div className="flex flex-col divide-y divide-border">
          {ACCESOS.map((a) => (
            <Link key={a.titulo} href={a.href} className="flex items-center gap-3 py-3 hover:bg-surface-sunken">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand">
                <a.icon className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-foreground">{a.titulo}</p>
                <p className="text-xs text-muted">{a.desc}</p>
              </div>
              <IconArrowRight className="h-4 w-4 shrink-0 text-muted" />
            </Link>
          ))}
        </div>
      </Card>
    </div>
  );
}
