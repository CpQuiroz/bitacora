"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { formatMoneda } from "@/lib/formatMoneda";
import { descargarCSV } from "@/lib/exportCsv";
import { Card, ErrorState, LoadingState } from "@bitacora/ui/web";
import { GraficoDistribucion, type PuntoDistribucion } from "@/components/charts/GraficoDistribucion";
import { GraficoRankingHorizontal, type PuntoRanking } from "@/components/charts/GraficoRankingHorizontal";
import { GraficoEvolucionSimple, type PuntoEvolucionSimple } from "@/components/charts/GraficoEvolucionSimple";
import { useInformes } from "../InformesContext";

type Agrupacion = "categoria" | "centro_costo" | "os";

const AGRUPACIONES: { valor: Agrupacion; etiqueta: string; dimension: string; dimensionPlural: string; archivoCsv: string }[] = [
  { valor: "categoria", etiqueta: "Por Categoría", dimension: "Categoría", dimensionPlural: "Categorías", archivoCsv: "informe-gastos-por-categoria" },
  { valor: "centro_costo", etiqueta: "Por Centro de Costo", dimension: "Centro de Costo", dimensionPlural: "Centros de Costo", archivoCsv: "informe-gastos-por-centro-costo" },
  { valor: "os", etiqueta: "Por Orden de Servicio", dimension: "Orden de Servicio", dimensionPlural: "Órdenes de Servicio", archivoCsv: "informe-gastos-por-os" },
];

type Kpis = { total_gastos: number; grupos_con_gastos: number; promedio_por_grupo: number; mayor_grupo: string | null; cantidad_gastos: number };

type Datos = {
  kpis: Kpis;
  distribucion: PuntoDistribucion[];
  ranking: PuntoRanking[];
  evolucion: PuntoEvolucionSimple[];
};

function KpiCard({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <Card>
      <p className="font-ds-body text-ds-caption font-medium text-ds-text/60">{etiqueta}</p>
      <p className="mt-ds-1 font-ds-body text-ds-h5 font-semibold tabular-nums text-ds-text">{valor}</p>
    </Card>
  );
}

function agrupacionValida(valor: string | null): Agrupacion {
  return AGRUPACIONES.some((a) => a.valor === valor) ? (valor as Agrupacion) : "categoria";
}

// PASO 6 (sistema de diseño) — migrado. Ver docs/design-system.md.
function InformeGastosContenido() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { desde, hasta, refreshKey, usuario, registrarExportCsv } = useInformes();
  const [agrupacion, setAgrupacion] = useState<Agrupacion>(() => agrupacionValida(searchParams.get("agrupacion")));
  const [datos, setDatos] = useState<Datos | null>(null);
  const [error, setError] = useState<string | null>(null);
  const moneda = usuario.empresa.moneda;

  const config = AGRUPACIONES.find((a) => a.valor === agrupacion)!;

  function cambiarAgrupacion(valor: Agrupacion) {
    setAgrupacion(valor);
    const params = new URLSearchParams(searchParams.toString());
    params.set("agrupacion", valor);
    router.replace(`/dashboard/informes/gastos?${params.toString()}`);
  }

  useEffect(() => {
    setDatos(null);
    setError(null);
    apiFetch(`/api/informes/gastos?agrupacion=${agrupacion}&periodo=personalizado&desde=${desde}&hasta=${hasta}`)
      .then(async (res) => {
        if (!res.ok) {
          setError("No se pudo cargar el informe");
          return;
        }
        setDatos(await res.json());
      })
      .catch(() => setError("No se pudo cargar el informe"));
  }, [agrupacion, desde, hasta, refreshKey]);

  useEffect(() => {
    if (!datos) {
      registrarExportCsv(null);
      return;
    }
    registrarExportCsv(() => {
      const filas: Record<string, string | number>[] = [
        { Sección: "KPIs", Campo: "Total de Gastos", Valor: datos.kpis.total_gastos },
        { Sección: "KPIs", Campo: `${config.dimensionPlural} con Gastos`, Valor: datos.kpis.grupos_con_gastos },
        { Sección: "KPIs", Campo: `Promedio por ${config.dimension}`, Valor: Math.round(datos.kpis.promedio_por_grupo) },
        { Sección: "KPIs", Campo: `Mayor ${config.dimension}`, Valor: datos.kpis.mayor_grupo ?? "—" },
        ...datos.ranking.map((r) => ({ Sección: `Ranking de ${config.dimensionPlural}`, Campo: r.nombre, Valor: r.valor })),
      ];
      descargarCSV(`${config.archivoCsv}_${desde}_a_${hasta}.csv`, filas);
    });
    return () => registrarExportCsv(null);
  }, [datos, desde, hasta, registrarExportCsv, config]);

  return (
    <div className="flex flex-col gap-ds-6">
      <div className="flex flex-wrap gap-ds-2">
        {AGRUPACIONES.map((a) => (
          <button
            key={a.valor}
            type="button"
            onClick={() => cambiarAgrupacion(a.valor)}
            className={`rounded-ds-pill border px-ds-3 py-1 font-ds-body text-ds-caption font-medium transition-colors ${
              agrupacion === a.valor ? "border-transparent bg-ds-brand text-ds-brand-foreground" : "border-ds-divider text-ds-text/70 hover:bg-ds-brand/[0.08]"
            }`}
          >
            {a.etiqueta}
          </button>
        ))}
      </div>

      {error ? <ErrorState mensaje={error} /> : null}
      {!error && !datos ? <LoadingState /> : null}

      {datos && (
        <>
          <div className="grid gap-ds-4 sm:grid-cols-2 lg:grid-cols-4">
            <KpiCard etiqueta="Total de Gastos" valor={formatMoneda(datos.kpis.total_gastos, moneda)} />
            <KpiCard etiqueta={`${config.dimensionPlural} con Gastos`} valor={String(datos.kpis.grupos_con_gastos)} />
            <KpiCard etiqueta={`Promedio por ${config.dimension}`} valor={formatMoneda(datos.kpis.promedio_por_grupo, moneda)} />
            <KpiCard etiqueta={`Mayor ${config.dimension}`} valor={datos.kpis.mayor_grupo ?? "—"} />
          </div>

          <div className="grid gap-ds-6 lg:grid-cols-2">
            <Card>
              <p className="mb-ds-4 font-ds-body text-ds-small font-semibold text-ds-text">Distribución de Gastos</p>
              <GraficoDistribucion
                datos={datos.distribucion}
                mensajeVacio={`Ningún gasto con ${config.dimension.toLowerCase()} asignada en el período.`}
                formatearValor={(n) => formatMoneda(n, moneda)}
              />
            </Card>

            <Card>
              <p className="mb-ds-4 font-ds-body text-ds-small font-semibold text-ds-text">Ranking de {config.dimensionPlural}</p>
              <GraficoRankingHorizontal
                datos={datos.ranking}
                mensajeVacio={`Ningún gasto con ${config.dimension.toLowerCase()} asignada en el período.`}
                formatearValor={(n) => formatMoneda(n, moneda)}
              />
            </Card>
          </div>

          <Card>
            <p className="mb-ds-4 font-ds-body text-ds-small font-semibold text-ds-text">Evolución por {config.dimension}</p>
            <GraficoEvolucionSimple datos={datos.evolucion} mensajeVacio="Ningún gasto en el período seleccionado." formatearValor={(n) => formatMoneda(n, moneda)} />
          </Card>
        </>
      )}
    </div>
  );
}

// useSearchParams() necesita un boundary de Suspense para el build de
// producción (si no, Next aborta con "missing-suspense-with-csr-bailout").
export default function InformeGastosPage() {
  return (
    <Suspense fallback={null}>
      <InformeGastosContenido />
    </Suspense>
  );
}
