"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { formatMoneda } from "@/lib/formatMoneda";
import { descargarCSV } from "@/lib/exportCsv";
import { Card, ErrorText } from "@/components/ui";
import { GraficoDistribucion, type PuntoDistribucion } from "@/components/charts/GraficoDistribucion";
import { GraficoRankingHorizontal, type PuntoRanking } from "@/components/charts/GraficoRankingHorizontal";
import { GraficoEvolucionSimple, type PuntoEvolucionSimple } from "@/components/charts/GraficoEvolucionSimple";
import { useInformes } from "./InformesContext";

type Kpis = { total_gastos: number; grupos_con_gastos: number; promedio_por_grupo: number; mayor_grupo: string | null; cantidad_gastos: number };

type Datos = {
  kpis: Kpis;
  distribucion: PuntoDistribucion[];
  ranking: PuntoRanking[];
  evolucion: PuntoEvolucionSimple[];
};

function KpiCard({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <Card className="p-4">
      <p className="text-xs font-medium text-muted">{etiqueta}</p>
      <p className="mt-1 text-xl font-semibold tabular-nums text-foreground">{valor}</p>
    </Card>
  );
}

// Compartido entre "Gastos por Categoría" y "Gastos por Centro de
// Costo" — misma forma de datos, solo cambia la dimensión de
// agrupación en el backend y las etiquetas visibles acá.
export function GastosAgrupadosView({
  endpoint,
  nombreDimension,
  nombreDimensionPlural,
  archivoCsv,
}: {
  endpoint: string;
  nombreDimension: string;
  nombreDimensionPlural: string;
  archivoCsv: string;
}) {
  const { desde, hasta, refreshKey, usuario, registrarExportCsv } = useInformes();
  const [datos, setDatos] = useState<Datos | null>(null);
  const [error, setError] = useState<string | null>(null);
  const moneda = usuario.empresa.moneda;

  useEffect(() => {
    setDatos(null);
    setError(null);
    apiFetch(`/api/informes/${endpoint}?periodo=personalizado&desde=${desde}&hasta=${hasta}`)
      .then(async (res) => {
        if (!res.ok) {
          setError("No se pudo cargar el informe");
          return;
        }
        setDatos(await res.json());
      })
      .catch(() => setError("No se pudo cargar el informe"));
  }, [endpoint, desde, hasta, refreshKey]);

  useEffect(() => {
    if (!datos) {
      registrarExportCsv(null);
      return;
    }
    registrarExportCsv(() => {
      const filas: Record<string, string | number>[] = [
        { Sección: "KPIs", Campo: "Total de Gastos", Valor: datos.kpis.total_gastos },
        { Sección: "KPIs", Campo: `${nombreDimensionPlural} con Gastos`, Valor: datos.kpis.grupos_con_gastos },
        { Sección: "KPIs", Campo: `Promedio por ${nombreDimension}`, Valor: Math.round(datos.kpis.promedio_por_grupo) },
        { Sección: "KPIs", Campo: `Mayor ${nombreDimension}`, Valor: datos.kpis.mayor_grupo ?? "—" },
        ...datos.ranking.map((r) => ({ Sección: `Ranking de ${nombreDimensionPlural}`, Campo: r.nombre, Valor: r.valor })),
      ];
      descargarCSV(`${archivoCsv}_${desde}_a_${hasta}.csv`, filas);
    });
    return () => registrarExportCsv(null);
  }, [datos, desde, hasta, registrarExportCsv, nombreDimension, nombreDimensionPlural, archivoCsv]);

  if (error) return <ErrorText>{error}</ErrorText>;
  if (!datos) return <p className="text-sm text-muted">Cargando…</p>;

  const { kpis, distribucion, ranking, evolucion } = datos;

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard etiqueta="Total de Gastos" valor={formatMoneda(kpis.total_gastos, moneda)} />
        <KpiCard etiqueta={`${nombreDimensionPlural} con Gastos`} valor={String(kpis.grupos_con_gastos)} />
        <KpiCard etiqueta={`Promedio por ${nombreDimension}`} valor={formatMoneda(kpis.promedio_por_grupo, moneda)} />
        <KpiCard etiqueta={`Mayor ${nombreDimension}`} valor={kpis.mayor_grupo ?? "—"} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="mb-4 text-sm font-semibold text-foreground">Distribución de Gastos</h2>
          <GraficoDistribucion
            datos={distribucion}
            mensajeVacio={`Ningún gasto con ${nombreDimension.toLowerCase()} asignada en el período.`}
            formatearValor={(n) => formatMoneda(n, moneda)}
          />
        </Card>

        <Card>
          <h2 className="mb-4 text-sm font-semibold text-foreground">Ranking de {nombreDimensionPlural}</h2>
          <GraficoRankingHorizontal
            datos={ranking}
            mensajeVacio={`Ningún gasto con ${nombreDimension.toLowerCase()} asignada en el período.`}
            formatearValor={(n) => formatMoneda(n, moneda)}
          />
        </Card>
      </div>

      <Card>
        <h2 className="mb-4 text-sm font-semibold text-foreground">Evolución por {nombreDimension}</h2>
        <GraficoEvolucionSimple
          datos={evolucion}
          mensajeVacio="Ningún gasto en el período seleccionado."
          formatearValor={(n) => formatMoneda(n, moneda)}
        />
      </Card>
    </div>
  );
}
