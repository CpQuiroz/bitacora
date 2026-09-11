"use client";

import { useEffect, useMemo, useState } from "react";
import { Sparkles } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { descargarCSV } from "@/lib/exportCsv";
import { Card, ErrorState, LoadingState } from "@bitacora/ui/web";
import { Stat } from "@/components/Stat";
import { GraficoDistribucion, type PuntoDistribucion } from "@/components/charts/GraficoDistribucion";
import { GraficoRankingHorizontal, type PuntoRanking } from "@/components/charts/GraficoRankingHorizontal";
import { useInformes } from "../InformesContext";

type Kpis = { total_os: number; completadas: number; tipos_utilizados: number; tasa_promedio: number };
type TopClientePorTipo = { cliente: string; tipo: string; cantidad: number };

type Datos = {
  kpis: Kpis;
  distribucion_tipo: PuntoDistribucion[];
  ranking_tipos: PuntoRanking[];
  top_clientes_por_tipo: TopClientePorTipo[];
};

function KpiCard({ etiqueta, valor, sub }: { etiqueta: string; valor: string; sub?: string }) {
  return <Stat etiqueta={etiqueta} valor={valor} nota={sub} />;
}

// PASO 6 (sistema de diseño) — migrado. Ver docs/design-system.md.
export default function InformeServiciosPage() {
  const { desde, hasta, refreshKey, registrarExportCsv } = useInformes();
  const [datos, setDatos] = useState<Datos | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setDatos(null);
    setError(null);
    apiFetch(`/api/informes/servicios?periodo=personalizado&desde=${desde}&hasta=${hasta}`)
      .then(async (res) => {
        if (!res.ok) {
          setError("No se pudo cargar el informe");
          return;
        }
        setDatos(await res.json());
      })
      .catch(() => setError("No se pudo cargar el informe"));
  }, [desde, hasta, refreshKey]);

  useEffect(() => {
    if (!datos) {
      registrarExportCsv(null);
      return;
    }
    registrarExportCsv(() => {
      const filas: Record<string, string | number>[] = [
        { Sección: "KPIs", Campo: "Total de OS", Valor: datos.kpis.total_os },
        { Sección: "KPIs", Campo: "Completadas", Valor: datos.kpis.completadas },
        { Sección: "KPIs", Campo: "Tipos Utilizados", Valor: datos.kpis.tipos_utilizados },
        { Sección: "KPIs", Campo: "Tasa Promedio (%)", Valor: datos.kpis.tasa_promedio.toFixed(1) },
        ...datos.ranking_tipos.map((r) => ({ Sección: "Ranking de Tipos", Campo: r.nombre, Valor: r.valor })),
        ...datos.top_clientes_por_tipo.map((c) => ({
          Sección: "Top Clientes por Tipo",
          Campo: `${c.cliente} — ${c.tipo}`,
          Valor: c.cantidad,
        })),
      ];
      descargarCSV(`informe-servicios_${desde}_a_${hasta}.csv`, filas);
    });
    return () => registrarExportCsv(null);
  }, [datos, desde, hasta, registrarExportCsv]);

  const insights = useMemo(() => {
    if (!datos || datos.ranking_tipos.length === 0) return [];
    const total = datos.ranking_tipos.reduce((acc, r) => acc + r.valor, 0);
    const lista: string[] = [];
    const top = datos.ranking_tipos[0];
    if (top && total > 0) {
      const pct = ((top.valor / total) * 100).toFixed(0);
      lista.push(`El tipo "${top.nombre}" representa el ${pct}% de tus OS clasificadas en el período.`);
    }
    if (datos.kpis.total_os > 0 && datos.kpis.tipos_utilizados === 0) {
      lista.push("Ninguna OS de este período tiene un Tipo de OS asignado — puedes elegirlo al crear una nueva OS.");
    }
    if (datos.kpis.tasa_promedio >= 80) {
      lista.push(`Tasa de conclusión alta (${datos.kpis.tasa_promedio.toFixed(0)}%) — la mayoría de tus OS llegan a buen puerto.`);
    }
    return lista;
  }, [datos]);

  if (error) return <ErrorState mensaje={error} />;
  if (!datos) return <LoadingState />;

  const { kpis, distribucion_tipo, ranking_tipos, top_clientes_por_tipo } = datos;

  return (
    <div className="flex flex-col gap-ds-6">
      <div className="grid gap-ds-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard etiqueta="Total de OS" valor={String(kpis.total_os)} />
        <KpiCard etiqueta="Completadas" valor={String(kpis.completadas)} />
        <KpiCard etiqueta="Tipos Utilizados" valor={String(kpis.tipos_utilizados)} />
        <KpiCard etiqueta="Tasa Promedio" valor={`${kpis.tasa_promedio.toFixed(0)}%`} />
      </div>

      <div className="grid gap-ds-6 lg:grid-cols-2">
        <Card>
          <p className="mb-ds-4 font-ds-body text-ds-small font-semibold text-ds-text">Distribución por Tipo</p>
          <GraficoDistribucion datos={distribucion_tipo} mensajeVacio="Ninguna OS clasificada por Tipo de OS en el período." />
        </Card>

        <Card>
          <p className="mb-ds-4 font-ds-body text-ds-small font-semibold text-ds-text">Ranking de Tipos</p>
          <GraficoRankingHorizontal datos={ranking_tipos} mensajeVacio="Ninguna OS clasificada por Tipo de OS en el período." />
        </Card>
      </div>

      <Card>
        <p className="mb-ds-4 font-ds-body text-ds-small font-semibold text-ds-text">Top Clientes por Tipo</p>
        {top_clientes_por_tipo.length === 0 ? (
          <p className="font-ds-body text-ds-small text-ds-text/70">Ningún dato de clientes por tipo disponible.</p>
        ) : (
          <table className="w-full text-left text-ds-body">
            <thead>
              <tr className="border-b border-ds-divider text-[11px] font-medium uppercase tracking-[0.08em] text-ds-text/60">
                <th className="py-ds-2">Cliente</th>
                <th className="py-ds-2">Tipo</th>
                <th className="py-ds-2 text-right">Cantidad</th>
              </tr>
            </thead>
            <tbody>
              {top_clientes_por_tipo.map((c) => (
                <tr key={`${c.cliente}-${c.tipo}`} className="border-b border-ds-text/[0.08] last:border-0">
                  <td className="py-2.5 font-medium text-ds-text">{c.cliente}</td>
                  <td className="py-2.5 text-ds-text/70">{c.tipo}</td>
                  <td className="py-2.5 text-right text-ds-text">{c.cantidad}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <Card>
        <p className="mb-ds-4 flex items-center gap-ds-2 font-ds-body text-ds-small font-semibold text-ds-text">
          <Sparkles size={16} strokeWidth={2.75} className="text-ds-brand" />
          Insights de Servicios
        </p>
        {insights.length === 0 ? (
          <p className="font-ds-body text-ds-small text-ds-text/70">Sin observaciones todavía — clasifica tus OS por Tipo de OS para verlas acá.</p>
        ) : (
          <ul className="flex flex-col gap-ds-2 font-ds-body text-ds-small text-ds-text">
            {insights.map((texto, i) => (
              <li key={i} className="flex items-start gap-ds-2">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-ds-pill bg-ds-brand" />
                {texto}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
