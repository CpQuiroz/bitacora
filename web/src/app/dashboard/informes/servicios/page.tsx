"use client";

import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/lib/api";
import { descargarCSV } from "@/lib/exportCsv";
import { Card, ErrorText } from "@/components/ui";
import { GraficoDistribucion, type PuntoDistribucion } from "@/components/charts/GraficoDistribucion";
import { GraficoRankingHorizontal, type PuntoRanking } from "@/components/charts/GraficoRankingHorizontal";
import { IconSparkle } from "@/components/icons";
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
  return (
    <Card className="p-4">
      <p className="text-xs font-medium text-muted">{etiqueta}</p>
      <p className="mt-1 text-xl font-semibold tabular-nums text-foreground">{valor}</p>
      {sub && <p className="mt-0.5 text-xs text-muted">{sub}</p>}
    </Card>
  );
}

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

  if (error) return <ErrorText>{error}</ErrorText>;
  if (!datos) return <p className="text-sm text-muted">Cargando…</p>;

  const { kpis, distribucion_tipo, ranking_tipos, top_clientes_por_tipo } = datos;

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard etiqueta="Total de OS" valor={String(kpis.total_os)} />
        <KpiCard etiqueta="Completadas" valor={String(kpis.completadas)} />
        <KpiCard etiqueta="Tipos Utilizados" valor={String(kpis.tipos_utilizados)} />
        <KpiCard etiqueta="Tasa Promedio" valor={`${kpis.tasa_promedio.toFixed(0)}%`} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="mb-4 text-sm font-semibold text-foreground">Distribución por Tipo</h2>
          <GraficoDistribucion datos={distribucion_tipo} mensajeVacio="Ninguna OS clasificada por Tipo de OS en el período." />
        </Card>

        <Card>
          <h2 className="mb-4 text-sm font-semibold text-foreground">Ranking de Tipos</h2>
          <GraficoRankingHorizontal datos={ranking_tipos} mensajeVacio="Ninguna OS clasificada por Tipo de OS en el período." />
        </Card>
      </div>

      <Card>
        <h2 className="mb-4 text-sm font-semibold text-foreground">Top Clientes por Tipo</h2>
        {top_clientes_por_tipo.length === 0 ? (
          <p className="text-sm text-muted">Ningún dato de clientes por tipo disponible.</p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border text-xs text-muted">
                <th className="py-2 font-medium">Cliente</th>
                <th className="py-2 font-medium">Tipo</th>
                <th className="py-2 text-right font-medium">Cantidad</th>
              </tr>
            </thead>
            <tbody>
              {top_clientes_por_tipo.map((c) => (
                <tr key={`${c.cliente}-${c.tipo}`} className="border-b border-border last:border-0">
                  <td className="py-2.5 font-medium text-foreground">{c.cliente}</td>
                  <td className="py-2.5 text-muted">{c.tipo}</td>
                  <td className="py-2.5 text-right text-foreground">{c.cantidad}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <Card>
        <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-foreground">
          <IconSparkle className="h-4 w-4 text-brand" />
          Insights de Servicios
        </h2>
        {insights.length === 0 ? (
          <p className="text-sm text-muted">Sin observaciones todavía — clasifica tus OS por Tipo de OS para verlas acá.</p>
        ) : (
          <ul className="flex flex-col gap-2 text-sm text-foreground">
            {insights.map((texto, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand" />
                {texto}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
