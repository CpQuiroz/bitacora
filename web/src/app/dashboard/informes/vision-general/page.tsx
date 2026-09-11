"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import { formatMoneda } from "@/lib/formatMoneda";
import { ArrowRight, BarChart3, ClipboardCheck, Tag, Users, Wallet } from "lucide-react";
import { Card, ErrorState, LoadingState } from "@bitacora/ui/web";
import { Stat } from "@/components/Stat";
import { GraficoIngresos, type PuntoIngresoMes } from "@/components/charts/GraficoIngresos";
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
  return <Stat etiqueta={etiqueta} valor={valor} nota={sub} />;
}

function MiniCard({ etiqueta, valor, cantidad, color }: { etiqueta: string; valor: string; cantidad: number; color: string }) {
  return (
    <div className="rounded-ds-md border border-ds-divider p-ds-3">
      <p className="font-ds-body text-ds-caption text-ds-text/60">{etiqueta}</p>
      <p className={`mt-ds-1 font-ds-body text-ds-body font-semibold tabular-nums ${color}`}>{valor}</p>
      <p className="font-ds-body text-ds-caption text-ds-text/60">{cantidad} {cantidad === 1 ? "ítem" : "ítems"}</p>
    </div>
  );
}

const ACCESOS = [
  { href: "/dashboard/informes/financiero", icon: Wallet, titulo: "Financiero", desc: "Ingresos, cobros y morosidad" },
  { href: "/dashboard/informes/ventas", icon: Tag, titulo: "Ventas", desc: "Cotizaciones, conversión y ticket promedio" },
  { href: "/dashboard/informes/operaciones", icon: ClipboardCheck, titulo: "Operaciones", desc: "OS, tiempo promedio y productividad" },
  { href: "/dashboard/informes/clientes", icon: Users, titulo: "Clientes", desc: "Base de clientes, top clientes y retención" },
  { href: "/dashboard/informes/financiero", icon: BarChart3, titulo: "Ganancia/Pérdida", desc: "Ingresos vs gastos y análisis de rentabilidad" },
];

const pct = (n: number) => `${n.toFixed(0)}%`;

// PASO 6 (sistema de diseño) — migrado. Ver docs/design-system.md.
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

  if (error) return <ErrorState mensaje={error} />;
  if (!datos) return <LoadingState />;

  const { kpis, resumen_gastos, ingresos_vs_gastos, ingresos_por_mes } = datos;

  // TODO: decisión pendiente — estas KPIs (Ingreso Total, Cotizaciones,
  // OS Completadas, Clientes Activos) y el gráfico "Ingresos vs Gastos"
  // duplican casi exactamente lo que ya muestra el Dashboard
  // (web/src/app/dashboard/page.tsx). Evaluar si el Dashboard pasa a
  // ser más accionable (accesos rápidos + alertas) y esta pantalla se
  // queda con el análisis profundo, sin repetir las mismas métricas.
  return (
    <div className="flex flex-col gap-ds-6">
      <div className="grid gap-ds-4 sm:grid-cols-2 lg:grid-cols-5">
        <KpiCard etiqueta="Ingreso Total" valor={formatMoneda(kpis.ingresos_totales, moneda)} />
        <KpiCard etiqueta="Total de Gastos" valor={formatMoneda(resumen_gastos.total, moneda)} />
        <KpiCard etiqueta="Cotizaciones" valor={String(kpis.cant_presupuestos)} sub={`${pct(kpis.pct_conversion)} de conversión`} />
        <KpiCard etiqueta="OS Completadas" valor={String(kpis.ot_completadas)} sub={`${pct(kpis.pct_conclusion_ot)} de conclusión`} />
        <KpiCard etiqueta="Clientes Activos" valor={String(kpis.clientes_activos)} />
      </div>

      <div className="grid gap-ds-6 lg:grid-cols-2">
        <Card>
          <p className="mb-ds-4 font-ds-body text-ds-small font-semibold text-ds-text">Ingresos vs Gastos</p>
          <div className="flex flex-col divide-y divide-ds-divider font-ds-body text-ds-small">
            <div className="flex items-center justify-between py-2.5">
              <span className="text-ds-text/70">Ingreso Recibido</span>
              <span className="font-medium text-ds-accent2-800">{formatMoneda(ingresos_vs_gastos.ingresos_recibidos, moneda)}</span>
            </div>
            <div className="flex items-center justify-between py-2.5">
              <span className="text-ds-text/70">Gastos Pagados</span>
              <span className="font-medium text-ds-accent-700">{formatMoneda(ingresos_vs_gastos.gastos_pagados, moneda)}</span>
            </div>
            <div className="flex items-center justify-between py-2.5">
              <span className="font-semibold text-ds-text">Resultado Neto</span>
              <span className={`font-semibold ${ingresos_vs_gastos.resultado_neto >= 0 ? "text-ds-accent2-800" : "text-ds-accent-700"}`}>
                {formatMoneda(ingresos_vs_gastos.resultado_neto, moneda)}
              </span>
            </div>
          </div>
        </Card>

        <Card>
          <p className="mb-ds-4 font-ds-body text-ds-small font-semibold text-ds-text">Resumen de Gastos</p>
          <div className="grid grid-cols-2 gap-ds-3">
            <MiniCard etiqueta="Pagado" valor={formatMoneda(resumen_gastos.pagado, moneda)} cantidad={resumen_gastos.cantidad_pagado} color="text-ds-accent2-800" />
            <MiniCard etiqueta="Pendiente" valor={formatMoneda(resumen_gastos.pendiente, moneda)} cantidad={resumen_gastos.cantidad_pendiente} color="text-ds-accent-700" />
            <MiniCard etiqueta="Vencido" valor={formatMoneda(resumen_gastos.vencido, moneda)} cantidad={resumen_gastos.cantidad_vencido} color="text-ds-accent-800" />
            <MiniCard etiqueta="Total de Gastos" valor={formatMoneda(resumen_gastos.total, moneda)} cantidad={resumen_gastos.cantidad_total} color="text-ds-text" />
          </div>
        </Card>
      </div>

      <Card>
        <p className="mb-ds-4 font-ds-body text-ds-small font-semibold text-ds-text">Ingreso por Período</p>
        <GraficoIngresos datos={ingresos_por_mes} moneda={moneda} />
      </Card>

      <Card>
        <p className="mb-ds-4 font-ds-body text-ds-small font-semibold text-ds-text">Informes Detallados</p>
        <div className="flex flex-col divide-y divide-ds-divider">
          {ACCESOS.map((a) => (
            <Link key={a.titulo} href={a.href} className="flex items-center gap-ds-3 py-ds-3 hover:bg-ds-text/[0.04]">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-ds-pill bg-ds-brand/[0.08] text-ds-brand">
                <a.icon size={16} strokeWidth={2.75} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-ds-body text-ds-small font-medium text-ds-text">{a.titulo}</p>
                <p className="font-ds-body text-ds-caption text-ds-text/60">{a.desc}</p>
              </div>
              <ArrowRight size={16} strokeWidth={2.75} className="shrink-0 text-ds-text/60" />
            </Link>
          ))}
        </div>
      </Card>
    </div>
  );
}
