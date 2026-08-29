"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Empresa, Usuario } from "@bitacora/shared";
import { supabase } from "@/lib/supabase";
import { apiFetch } from "@/lib/api";
import { formatMoneda } from "@/lib/formatMoneda";
import { DashboardShell } from "@/components/DashboardShell";
import { Button, Card, ErrorText, Select } from "@/components/ui";
import {
  IconBriefcase,
  IconClipboardCheck,
  IconMapPin,
  IconReceipt,
  IconRoute,
  IconSparkle,
  IconTag,
  IconWallet,
} from "@/components/icons";
import { GraficoDistribucion, type PuntoDistribucion } from "@/components/charts/GraficoDistribucion";
import { GraficoIngresos, type PuntoIngresoMes } from "@/components/charts/GraficoIngresos";

type UsuarioConEmpresa = Usuario & { empresa: Empresa };

type DatosDashboard = {
  periodo: { desde: string; hasta: string };
  kpis: {
    ingresos_totales: number;
    ingresos_recibidos: number;
    pct_recibido: number;
    monto_pendiente: number;
    monto_vencido: number;
    cant_presupuestos: number;
    pct_conversion: number;
    ot_completadas: number;
    pct_conclusion_ot: number;
    clientes_activos: number;
    ticket_promedio: number;
  };
  resumen_financiero: { recibido: number; pendiente: number; atrasado: number; total: number };
  resumen_gastos: { pagado: number; pendiente: number; vencido: number; total: number };
  ingresos_vs_gastos: { ingresos_recibidos: number; gastos_pagados: number; resultado_neto: number };
  estado_presupuestos: PuntoDistribucion[];
  estado_ot: PuntoDistribucion[];
  ingresos_por_mes: PuntoIngresoMes[];
};

const PERIODOS = [
  { valor: "hoy", etiqueta: "Hoy" },
  { valor: "ayer", etiqueta: "Ayer" },
  { valor: "7d", etiqueta: "Últimos 7 días" },
  { valor: "30d", etiqueta: "Últimos 30 días" },
  { valor: "este_mes", etiqueta: "Este mes" },
  { valor: "mes_pasado", etiqueta: "Mes pasado" },
  { valor: "este_anio", etiqueta: "Este año" },
  { valor: "personalizado", etiqueta: "Personalizado" },
];

const ACCESOS = [
  { href: "/dashboard/trabajos", label: "Trabajos", icon: IconBriefcase },
  { href: "/dashboard/ordenes", label: "Órdenes de Trabajo/Servicio", icon: IconClipboardCheck },
  { href: "/dashboard/registros/clientes", label: "Clientes", icon: IconMapPin },
  { href: "/dashboard/rutas", label: "Rutas", icon: IconRoute },
  { href: "/dashboard/financiero/cobros", label: "Cobros", icon: IconReceipt },
  { href: "/dashboard/financiero/cotizaciones", label: "Cotizaciones", icon: IconTag },
  { href: "/dashboard/gastos", label: "Gastos", icon: IconWallet },
  { href: "/dashboard/informe", label: "Informe con IA", icon: IconSparkle },
];

function KpiCard({ etiqueta, valor, sub }: { etiqueta: string; valor: string; sub?: string }) {
  return (
    <Card className="p-4">
      <p className="text-xs font-medium text-muted">{etiqueta}</p>
      <p className="mt-1 text-xl font-semibold tabular-nums text-foreground">{valor}</p>
      {sub && <p className="mt-0.5 text-xs text-muted">{sub}</p>}
    </Card>
  );
}

const pct = (n: number) => `${n.toFixed(0)}%`;

export default function DashboardPage() {
  const router = useRouter();
  const [usuario, setUsuario] = useState<UsuarioConEmpresa | null>(null);
  const [cargando, setCargando] = useState(true);

  const [periodo, setPeriodo] = useState("este_mes");
  const [desdeCustom, setDesdeCustom] = useState(() => new Date().toISOString().slice(0, 10));
  const [hastaCustom, setHastaCustom] = useState(() => new Date().toISOString().slice(0, 10));
  const [datos, setDatos] = useState<DatosDashboard | null>(null);
  const [cargandoDatos, setCargandoDatos] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        router.replace("/login");
        return;
      }
      const res = await apiFetch("/api/me");
      if (!res.ok) {
        router.replace("/login");
        return;
      }
      const body = await res.json();
      if (!body.usuario) {
        router.replace("/onboarding");
        return;
      }
      setUsuario(body.usuario);
      setCargando(false);
    })();
  }, [router]);

  const cargarDashboard = useCallback(async () => {
    setError(null);
    setCargandoDatos(true);
    const params = new URLSearchParams({ periodo });
    if (periodo === "personalizado") {
      params.set("desde", desdeCustom);
      params.set("hasta", hastaCustom);
    }
    const res = await apiFetch(`/api/dashboard?${params.toString()}`);
    setCargandoDatos(false);
    if (!res.ok) {
      setError("No se pudieron cargar los indicadores");
      return;
    }
    setDatos(await res.json());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periodo]);

  useEffect(() => {
    if (!cargando) cargarDashboard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cargando]);

  if (cargando || !usuario) return null;

  const moneda = usuario.empresa.moneda ?? "CLP";
  const money = (n: number) => formatMoneda(n, moneda);

  return (
    <DashboardShell
      usuario={{
        nombre: usuario.nombre,
        rol: usuario.rol,
        empresaNombre: usuario.empresa.nombre,
        empresaLogoUrl: usuario.empresa.logo_url,
        colorPrimario: usuario.empresa.color_primario,
        colorPrimarioForeground: usuario.empresa.color_primario_foreground,
        colorSecundario: usuario.empresa.color_secundario,
        fuente: usuario.empresa.fuente,
        moneda,
      }}
    >
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium text-brand">{usuario.empresa.nombre}</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-foreground">
            Hola, {usuario.nombre.split(" ")[0]}
          </h1>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <Select value={periodo} onChange={(e) => setPeriodo(e.target.value)} className="w-44">
            {PERIODOS.map((p) => (
              <option key={p.valor} value={p.valor}>
                {p.etiqueta}
              </option>
            ))}
          </Select>
          {periodo === "personalizado" && (
            <>
              <input
                type="date"
                value={desdeCustom}
                onChange={(e) => setDesdeCustom(e.target.value)}
                className="rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
              />
              <input
                type="date"
                value={hastaCustom}
                onChange={(e) => setHastaCustom(e.target.value)}
                className="rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
              />
            </>
          )}
          <Button type="button" onClick={cargarDashboard} disabled={cargandoDatos}>
            {cargandoDatos ? "Actualizando…" : "Actualizar"}
          </Button>
        </div>
      </div>

      {error && (
        <div className="mb-6">
          <ErrorText>{error}</ErrorText>
        </div>
      )}

      {!datos && !error && <p className="text-sm text-muted">Cargando indicadores…</p>}

      {datos && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <KpiCard etiqueta="Ingresos totales" valor={money(datos.kpis.ingresos_totales)} />
            <KpiCard
              etiqueta="Ingresos recibidos"
              valor={money(datos.kpis.ingresos_recibidos)}
              sub={`${pct(datos.kpis.pct_recibido)} del total`}
            />
            <KpiCard etiqueta="Pendiente de cobro" valor={money(datos.kpis.monto_pendiente)} />
            <KpiCard etiqueta="Monto vencido" valor={money(datos.kpis.monto_vencido)} />
            <KpiCard
              etiqueta="Cotizaciones"
              valor={String(datos.kpis.cant_presupuestos)}
              sub={`${pct(datos.kpis.pct_conversion)} de conversión`}
            />
            <KpiCard
              etiqueta="OT completadas"
              valor={String(datos.kpis.ot_completadas)}
              sub={`${pct(datos.kpis.pct_conclusion_ot)} de conclusión`}
            />
            <KpiCard etiqueta="Clientes activos" valor={String(datos.kpis.clientes_activos)} />
            <KpiCard etiqueta="Ticket promedio" valor={money(datos.kpis.ticket_promedio)} />
          </div>

          <div className="my-6 grid gap-6 lg:grid-cols-[1fr_20rem]">
            <Card>
              <h2 className="mb-4 text-sm font-semibold text-foreground">Ingresos por período (últimos 12 meses)</h2>
              <GraficoIngresos datos={datos.ingresos_por_mes} moneda={moneda} />
            </Card>

            <Card>
              <h2 className="mb-4 text-sm font-semibold text-foreground">Resumen financiero</h2>
              <div className="flex flex-col gap-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted">Recibido</span>
                  <span className="font-medium text-success">{money(datos.resumen_financiero.recibido)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted">Pendiente</span>
                  <span className="font-medium text-warning">{money(datos.resumen_financiero.pendiente)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted">Atrasado</span>
                  <span className="font-medium text-danger">{money(datos.resumen_financiero.atrasado)}</span>
                </div>
                <div className="mt-1 flex items-center justify-between border-t border-border pt-3">
                  <span className="font-medium text-foreground">Total</span>
                  <span className="font-semibold text-foreground">{money(datos.resumen_financiero.total)}</span>
                </div>
              </div>
            </Card>
          </div>

          <Card className="my-6">
            <h2 className="mb-4 text-sm font-semibold text-foreground">Ingresos vs Gastos</h2>
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <p className="text-xs text-muted">Ingresos recibidos</p>
                <p className="mt-1 text-lg font-semibold text-success">{money(datos.ingresos_vs_gastos.ingresos_recibidos)}</p>
              </div>
              <div>
                <p className="text-xs text-muted">Gastos pagados</p>
                <p className="mt-1 text-lg font-semibold text-danger">{money(datos.ingresos_vs_gastos.gastos_pagados)}</p>
              </div>
              <div>
                <p className="text-xs text-muted">Resultado neto</p>
                <p
                  className={`mt-1 text-xl font-bold ${
                    datos.ingresos_vs_gastos.resultado_neto >= 0 ? "text-success" : "text-danger"
                  }`}
                >
                  {money(datos.ingresos_vs_gastos.resultado_neto)}
                </p>
              </div>
            </div>
          </Card>

          <div className="my-6 grid gap-6 sm:grid-cols-2">
            <Card>
              <h2 className="mb-4 text-sm font-semibold text-foreground">Resumen de gastos</h2>
              <div className="flex flex-col gap-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted">Pagado</span>
                  <span className="font-medium text-success">{money(datos.resumen_gastos.pagado)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted">Pendiente</span>
                  <span className="font-medium text-warning">{money(datos.resumen_gastos.pendiente)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted">Vencido</span>
                  <span className="font-medium text-danger">{money(datos.resumen_gastos.vencido)}</span>
                </div>
                <div className="mt-1 flex items-center justify-between border-t border-border pt-3">
                  <span className="font-medium text-foreground">Total</span>
                  <span className="font-semibold text-foreground">{money(datos.resumen_gastos.total)}</span>
                </div>
              </div>
            </Card>

            <Card>
              <h2 className="mb-4 text-sm font-semibold text-foreground">Estado de cotizaciones</h2>
              <GraficoDistribucion datos={datos.estado_presupuestos} mensajeVacio="Sin cotizaciones" />
            </Card>
          </div>

          <Card className="my-6">
            <h2 className="mb-4 text-sm font-semibold text-foreground">Estado de órdenes de trabajo</h2>
            <GraficoDistribucion datos={datos.estado_ot} mensajeVacio="Sin órdenes de trabajo" />
          </Card>
        </>
      )}

      <div className="mt-8 flex flex-wrap gap-2">
        {ACCESOS.map((a) => (
          <Link
            key={a.href}
            href={a.href}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-1.5 text-sm font-medium text-muted transition-colors hover:border-brand hover:text-brand"
          >
            <a.icon className="h-4 w-4" />
            {a.label}
          </Link>
        ))}
      </div>
    </DashboardShell>
  );
}
