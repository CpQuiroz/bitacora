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
import { useInformes } from "../InformesContext";

type Kpis = { total_cotizaciones: number; valor_total: number; tasa_conversion: number; ticket_promedio: number };
type PuntoMes = { mes: string; total: number; aprobadas: number };
type TopServicio = { servicio: string; cantidad: number; valor: number };

type Datos = {
  kpis: Kpis;
  cotizaciones_por_mes: PuntoMes[];
  distribucion_estado: PuntoDistribucion[];
  top_servicios: TopServicio[];
};

// Sin tono "success/danger/warning" propio — accent2 (verde) = bueno,
// neutral = en curso/ambiguo, accent (terracota) = malo, más oscuro
// para diferenciar rechazado de vencida/expirado.
const COLOR_ESTADO: Record<string, string> = {
  borrador: "var(--color-ds-neutral-600)",
  enviado: "var(--ds-brand)",
  aprobado: "var(--color-ds-accent2-700)",
  rechazado: "var(--color-ds-accent-700)",
  vencida: "var(--color-ds-accent-800)",
  expirado: "var(--color-ds-accent-800)",
};

function KpiCard({ etiqueta, valor, sub }: { etiqueta: string; valor: string; sub?: string }) {
  return <Stat etiqueta={etiqueta} valor={valor} nota={sub} />;
}

// PASO 6 (sistema de diseño) — migrado. Ver docs/design-system.md.
export default function InformeVentasPage() {
  const { desde, hasta, refreshKey, usuario, registrarExportCsv } = useInformes();
  const [datos, setDatos] = useState<Datos | null>(null);
  const [error, setError] = useState<string | null>(null);
  const moneda = usuario.empresa.moneda;

  useEffect(() => {
    setDatos(null);
    setError(null);
    apiFetch(`/api/informes/ventas?periodo=personalizado&desde=${desde}&hasta=${hasta}`)
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
        { Sección: "KPIs", Campo: "Total de Cotizaciones", Valor: datos.kpis.total_cotizaciones },
        { Sección: "KPIs", Campo: "Valor Total", Valor: datos.kpis.valor_total },
        { Sección: "KPIs", Campo: "Tasa de Conversión (%)", Valor: datos.kpis.tasa_conversion.toFixed(1) },
        { Sección: "KPIs", Campo: "Ticket Promedio", Valor: Math.round(datos.kpis.ticket_promedio) },
        ...datos.distribucion_estado.map((d) => ({ Sección: "Distribución por Estado", Campo: d.estado, Valor: d.cantidad })),
        ...datos.top_servicios.map((s) => ({ Sección: "Top Servicios Vendidos", Campo: s.servicio, Valor: s.valor })),
      ];
      descargarCSV(`informe-ventas_${desde}_a_${hasta}.csv`, filas);
    });
    return () => registrarExportCsv(null);
  }, [datos, desde, hasta, registrarExportCsv]);

  const cotizacionesEvolucion = useMemo(
    () => datos?.cotizaciones_por_mes.map((m) => ({ mes: m.mes, a: m.aprobadas, b: m.total })) ?? [],
    [datos]
  );
  const tasaConversionEvolucion = useMemo<PuntoPorcentaje[]>(
    () => datos?.cotizaciones_por_mes.map((m) => ({ mes: m.mes, valor: m.total > 0 ? (m.aprobadas / m.total) * 100 : null })) ?? [],
    [datos]
  );

  if (error) return <ErrorState mensaje={error} />;
  if (!datos) return <LoadingState />;

  const { kpis, distribucion_estado, top_servicios } = datos;

  return (
    <div className="flex flex-col gap-ds-6">
      <div className="grid gap-ds-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard etiqueta="Total de Cotizaciones" valor={String(kpis.total_cotizaciones)} />
        <KpiCard etiqueta="Valor Total" valor={formatMoneda(kpis.valor_total, moneda)} />
        <KpiCard etiqueta="Tasa de Conversión" valor={`${kpis.tasa_conversion.toFixed(0)}%`} />
        <KpiCard etiqueta="Ticket Promedio" valor={formatMoneda(kpis.ticket_promedio, moneda)} />
      </div>

      <Card>
        <p className="mb-ds-4 font-ds-body text-ds-small font-semibold text-ds-text">Cotizaciones por Período</p>
        <GraficoEvolucionDoble datos={cotizacionesEvolucion} etiquetaA="Aprobadas" etiquetaB="Total" mensajeVacio="Sin cotizaciones registradas en los últimos 12 meses." />
      </Card>

      <div className="grid gap-ds-6 lg:grid-cols-2">
        <Card>
          <p className="mb-ds-4 font-ds-body text-ds-small font-semibold text-ds-text">Distribución por Estado</p>
          <GraficoDistribucion datos={distribucion_estado} mensajeVacio="Ninguna cotización registrada en el período." coloresPorEstado={COLOR_ESTADO} />
        </Card>

        <Card>
          <p className="mb-ds-4 font-ds-body text-ds-small font-semibold text-ds-text">Tasa de Conversión</p>
          <GraficoEvolucionPorcentaje datos={tasaConversionEvolucion} mensajeVacio="Sin cotizaciones registradas en los últimos 12 meses." />
        </Card>
      </div>

      <Card>
        <p className="mb-ds-4 font-ds-body text-ds-small font-semibold text-ds-text">Top Servicios Vendidos</p>
        {top_servicios.length === 0 ? (
          <p className="font-ds-body text-ds-small text-ds-text/70">Ningún servicio vendido en el período.</p>
        ) : (
          <table className="w-full text-left text-ds-body">
            <thead>
              <tr className="border-b border-ds-divider text-[11px] font-medium uppercase tracking-[0.08em] text-ds-text/60">
                <th className="py-ds-2">Servicio</th>
                <th className="py-ds-2">Cantidad</th>
                <th className="py-ds-2 text-right">Valor</th>
              </tr>
            </thead>
            <tbody>
              {top_servicios.map((s) => (
                <tr key={s.servicio} className="border-b border-ds-text/[0.08] last:border-0">
                  <td className="py-2.5 font-medium text-ds-text">{s.servicio}</td>
                  <td className="py-2.5 text-ds-text/70">{s.cantidad}</td>
                  <td className="py-2.5 text-right text-ds-text">{formatMoneda(s.valor, moneda)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
