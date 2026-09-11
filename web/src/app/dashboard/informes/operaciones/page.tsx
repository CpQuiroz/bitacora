"use client";

import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/lib/api";
import { descargarCSV } from "@/lib/exportCsv";
import { Card, ErrorState, LoadingState } from "@bitacora/ui/web";
import { Stat } from "@/components/Stat";
import { GraficoDistribucion, type PuntoDistribucion } from "@/components/charts/GraficoDistribucion";
import { GraficoEvolucionDoble } from "@/components/charts/GraficoEvolucionDoble";
import { GraficoEvolucionPorcentaje, type PuntoPorcentaje } from "@/components/charts/GraficoEvolucionPorcentaje";
import { GraficoBarras, type PuntoBarraMes } from "@/components/charts/GraficoBarras";
import { useInformes } from "../InformesContext";

type Kpis = { total_os: number; completadas: number; pct_conclusion: number; en_curso: number; agendadas: number };
type PuntoMes = { mes: string; total: number; completadas: number };
type PuntoTiempoConclusion = { mes: string; dias_promedio: number | null };

type Datos = {
  kpis: Kpis;
  distribucion_estado: PuntoDistribucion[];
  os_por_mes: PuntoMes[];
  tiempo_promedio_conclusion: PuntoTiempoConclusion[];
};

const ETIQUETA_ESTADO: Record<string, string> = {
  agendado: "Agendado",
  en_progreso: "En Curso",
  completado: "Completado",
  cancelado: "Cancelado",
};

// Sin tono "success/warning/danger" propio.
const COLOR_ESTADO: Record<string, string> = {
  Agendado: "var(--ds-brand)",
  "En Curso": "var(--color-ds-neutral-600)",
  Completado: "var(--color-ds-accent2-700)",
  Cancelado: "var(--color-ds-accent-700)",
};

function KpiCard({ etiqueta, valor, sub }: { etiqueta: string; valor: string; sub?: string }) {
  return <Stat etiqueta={etiqueta} valor={valor} nota={sub} />;
}

// PASO 6 (sistema de diseño) — migrado. Ver docs/design-system.md.
export default function InformeOperacionesPage() {
  const { desde, hasta, refreshKey, registrarExportCsv } = useInformes();
  const [datos, setDatos] = useState<Datos | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setDatos(null);
    setError(null);
    apiFetch(`/api/informes/operaciones?periodo=personalizado&desde=${desde}&hasta=${hasta}`)
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
        { Sección: "KPIs", Campo: "Tasa de Conclusión (%)", Valor: datos.kpis.pct_conclusion.toFixed(1) },
        { Sección: "KPIs", Campo: "En Curso", Valor: datos.kpis.en_curso },
        { Sección: "KPIs", Campo: "Agendadas", Valor: datos.kpis.agendadas },
        ...datos.distribucion_estado.map((d) => ({
          Sección: "Distribución por Estado",
          Campo: ETIQUETA_ESTADO[d.estado] ?? d.estado,
          Valor: d.cantidad,
        })),
        ...datos.tiempo_promedio_conclusion
          .filter((m) => m.dias_promedio != null)
          .map((m) => ({ Sección: "Tiempo Promedio de Conclusión (días)", Campo: m.mes, Valor: m.dias_promedio as number })),
      ];
      descargarCSV(`informe-operaciones_${desde}_a_${hasta}.csv`, filas);
    });
    return () => registrarExportCsv(null);
  }, [datos, desde, hasta, registrarExportCsv]);

  const osEvolucion = useMemo(
    () => datos?.os_por_mes.map((m) => ({ mes: m.mes, a: m.completadas, b: m.total })) ?? [],
    [datos]
  );
  const tasaConclusionEvolucion = useMemo<PuntoPorcentaje[]>(
    () => datos?.os_por_mes.map((m) => ({ mes: m.mes, valor: m.total > 0 ? (m.completadas / m.total) * 100 : null })) ?? [],
    [datos]
  );
  const distribucionTraducida = useMemo(
    () => datos?.distribucion_estado.map((d) => ({ estado: ETIQUETA_ESTADO[d.estado] ?? d.estado, cantidad: d.cantidad })) ?? [],
    [datos]
  );
  const tiempoConclusion = useMemo<PuntoBarraMes[]>(
    () => datos?.tiempo_promedio_conclusion.map((m) => ({ mes: m.mes, valor: m.dias_promedio })) ?? [],
    [datos]
  );

  if (error) return <ErrorState mensaje={error} />;
  if (!datos) return <LoadingState />;

  const { kpis } = datos;

  return (
    <div className="flex flex-col gap-ds-6">
      <div className="grid gap-ds-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard etiqueta="Total de OS" valor={String(kpis.total_os)} />
        <KpiCard etiqueta="Completadas" valor={String(kpis.completadas)} sub={`${kpis.pct_conclusion.toFixed(0)}% de conclusión`} />
        <KpiCard etiqueta="En Curso" valor={String(kpis.en_curso)} />
        <KpiCard etiqueta="Agendadas" valor={String(kpis.agendadas)} />
      </div>

      <Card>
        <p className="mb-ds-4 font-ds-body text-ds-small font-semibold text-ds-text">OS por Período</p>
        <GraficoEvolucionDoble datos={osEvolucion} etiquetaA="Completadas" etiquetaB="Total" mensajeVacio="Sin órdenes de servicio registradas en los últimos 12 meses." />
      </Card>

      <div className="grid gap-ds-6 lg:grid-cols-2">
        <Card>
          <p className="mb-ds-4 font-ds-body text-ds-small font-semibold text-ds-text">Distribución por Estado</p>
          <GraficoDistribucion datos={distribucionTraducida} mensajeVacio="Ninguna OS registrada en el período." coloresPorEstado={COLOR_ESTADO} />
        </Card>

        <Card>
          <p className="mb-ds-4 font-ds-body text-ds-small font-semibold text-ds-text">Tasa de Conclusión</p>
          <GraficoEvolucionPorcentaje datos={tasaConclusionEvolucion} mensajeVacio="Sin órdenes de servicio registradas en los últimos 12 meses." />
        </Card>
      </div>

      <Card>
        <p className="mb-ds-4 font-ds-body text-ds-small font-semibold text-ds-text">Tiempo Promedio de Conclusión</p>
        <GraficoBarras datos={tiempoConclusion} mensajeVacio="Ninguna OS cerrada en los últimos 12 meses." sufijo=" días" />
      </Card>
    </div>
  );
}
