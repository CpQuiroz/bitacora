"use client";

import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/lib/api";
import { formatMoneda } from "@/lib/formatMoneda";
import { descargarCSV } from "@/lib/exportCsv";
import { Card, ErrorState, LoadingState } from "@bitacora/ui/web";
import { Stat } from "@/components/Stat";
import { GraficoDistribucion, type PuntoDistribucion } from "@/components/charts/GraficoDistribucion";
import { GraficoEvolucionDoble } from "@/components/charts/GraficoEvolucionDoble";
import { GraficoEvolucionPorcentaje, type PuntoPorcentaje } from "@/components/charts/GraficoEvolucionPorcentaje";
import { GraficoRankingHorizontal, type PuntoRanking } from "@/components/charts/GraficoRankingHorizontal";
import { useInformes } from "../InformesContext";

type Kpis = { total_clientes: number; clientes_activos: number; nuevos_clientes: number; ingreso_promedio: number };
type PuntoMes = { mes: string; nuevos: number; total: number };

type Datos = {
  kpis: Kpis;
  distribucion_estado: PuntoDistribucion[];
  clientes_por_mes: PuntoMes[];
  tasa_retencion: PuntoPorcentaje[];
  por_comuna: PuntoRanking[];
};

function KpiCard({ etiqueta, valor, sub }: { etiqueta: string; valor: string; sub?: string }) {
  return <Stat etiqueta={etiqueta} valor={valor} nota={sub} />;
}

// PASO 6 (sistema de diseño) — migrado. Ver docs/design-system.md.
export default function InformeClientesPage() {
  const { desde, hasta, refreshKey, usuario, registrarExportCsv } = useInformes();
  const [datos, setDatos] = useState<Datos | null>(null);
  const [error, setError] = useState<string | null>(null);
  const moneda = usuario.empresa.moneda;

  useEffect(() => {
    setDatos(null);
    setError(null);
    apiFetch(`/api/informes/clientes?periodo=personalizado&desde=${desde}&hasta=${hasta}`)
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
        { Sección: "KPIs", Campo: "Total de Clientes", Valor: datos.kpis.total_clientes },
        { Sección: "KPIs", Campo: "Clientes Activos", Valor: datos.kpis.clientes_activos },
        { Sección: "KPIs", Campo: "Nuevos Clientes", Valor: datos.kpis.nuevos_clientes },
        { Sección: "KPIs", Campo: "Ingreso Promedio", Valor: Math.round(datos.kpis.ingreso_promedio) },
        ...datos.distribucion_estado.map((d) => ({ Sección: "Distribución por Estado", Campo: d.estado, Valor: d.cantidad })),
        ...datos.por_comuna.map((c) => ({ Sección: "Clientes por Comuna", Campo: c.nombre, Valor: c.valor })),
      ];
      descargarCSV(`informe-clientes_${desde}_a_${hasta}.csv`, filas);
    });
    return () => registrarExportCsv(null);
  }, [datos, desde, hasta, registrarExportCsv]);

  const evolucionBase = useMemo(
    () => datos?.clientes_por_mes.map((m) => ({ mes: m.mes, a: m.nuevos, b: m.total })) ?? [],
    [datos]
  );

  if (error) return <ErrorState mensaje={error} />;
  if (!datos) return <LoadingState />;

  const { kpis, distribucion_estado, tasa_retencion, por_comuna } = datos;

  return (
    <div className="flex flex-col gap-ds-6">
      <div className="grid gap-ds-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard etiqueta="Total de Clientes" valor={String(kpis.total_clientes)} />
        <KpiCard etiqueta="Clientes Activos" valor={String(kpis.clientes_activos)} />
        <KpiCard etiqueta="Nuevos Clientes" valor={String(kpis.nuevos_clientes)} />
        <KpiCard etiqueta="Ingreso Promedio" valor={formatMoneda(kpis.ingreso_promedio, moneda)} />
      </div>

      <Card>
        <p className="mb-ds-4 font-ds-body text-ds-small font-semibold text-ds-text">Evolución de la Base de Clientes</p>
        <GraficoEvolucionDoble datos={evolucionBase} etiquetaA="Nuevos" etiquetaB="Total" mensajeVacio="Sin clientes registrados en los últimos 12 meses." />
      </Card>

      <div className="grid gap-ds-6 lg:grid-cols-2">
        <Card>
          <p className="mb-ds-4 font-ds-body text-ds-small font-semibold text-ds-text">Distribución por Estado</p>
          <GraficoDistribucion
            datos={distribucion_estado}
            mensajeVacio="Ningún cliente registrado."
            coloresPorEstado={{ Activo: "var(--color-ds-accent2-700)", Inactivo: "var(--color-ds-divider)" }}
          />
        </Card>

        <Card>
          <p className="mb-ds-4 font-ds-body text-ds-small font-semibold text-ds-text">Tasa de Retención</p>
          <GraficoEvolucionPorcentaje datos={tasa_retencion} mensajeVacio="Sin actividad suficiente para calcular retención mes a mes." />
        </Card>
      </div>

      <Card>
        <p className="mb-ds-4 font-ds-body text-ds-small font-semibold text-ds-text">Clientes por Comuna</p>
        <GraficoRankingHorizontal datos={por_comuna} mensajeVacio="Ningún cliente tiene comuna registrada todavía." />
      </Card>
    </div>
  );
}
