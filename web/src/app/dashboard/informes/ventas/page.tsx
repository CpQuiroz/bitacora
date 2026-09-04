"use client";

import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/lib/api";
import { formatMoneda } from "@/lib/formatMoneda";
import { descargarCSV } from "@/lib/exportCsv";
import { Card, ErrorText, Stat } from "@/components/ui";
import { GraficoDistribucion, type PuntoDistribucion } from "@/components/charts/GraficoDistribucion";
import { GraficoEvolucionDoble } from "@/components/charts/GraficoEvolucionDoble";
import { GraficoEvolucionPorcentaje, type PuntoPorcentaje } from "@/components/charts/GraficoEvolucionPorcentaje";
import { EstadoCargando } from "@/components/estados";
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

const COLOR_ESTADO: Record<string, string> = {
  borrador: "var(--muted)",
  enviado: "var(--brand)",
  aprobado: "var(--success)",
  rechazado: "var(--danger)",
  vencida: "var(--warning)",
  expirado: "var(--warning)",
};

function KpiCard({ etiqueta, valor, sub }: { etiqueta: string; valor: string; sub?: string }) {
  return <Stat etiqueta={etiqueta} valor={valor} nota={sub} />;
}

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

  if (error) return <ErrorText>{error}</ErrorText>;
  if (!datos) return <EstadoCargando />;

  const { kpis, distribucion_estado, top_servicios } = datos;

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard etiqueta="Total de Cotizaciones" valor={String(kpis.total_cotizaciones)} />
        <KpiCard etiqueta="Valor Total" valor={formatMoneda(kpis.valor_total, moneda)} />
        <KpiCard etiqueta="Tasa de Conversión" valor={`${kpis.tasa_conversion.toFixed(0)}%`} />
        <KpiCard etiqueta="Ticket Promedio" valor={formatMoneda(kpis.ticket_promedio, moneda)} />
      </div>

      <Card>
        <h2 className="mb-4 text-sm font-semibold text-foreground">Cotizaciones por Período</h2>
        <GraficoEvolucionDoble
          datos={cotizacionesEvolucion}
          etiquetaA="Aprobadas"
          etiquetaB="Total"
          mensajeVacio="Sin cotizaciones registradas en los últimos 12 meses."
        />
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="mb-4 text-sm font-semibold text-foreground">Distribución por Estado</h2>
          <GraficoDistribucion datos={distribucion_estado} mensajeVacio="Ninguna cotización registrada en el período." coloresPorEstado={COLOR_ESTADO} />
        </Card>

        <Card>
          <h2 className="mb-4 text-sm font-semibold text-foreground">Tasa de Conversión</h2>
          <GraficoEvolucionPorcentaje datos={tasaConversionEvolucion} mensajeVacio="Sin cotizaciones registradas en los últimos 12 meses." />
        </Card>
      </div>

      <Card>
        <h2 className="mb-4 text-sm font-semibold text-foreground">Top Servicios Vendidos</h2>
        {top_servicios.length === 0 ? (
          <p className="text-sm text-muted">Ningún servicio vendido en el período.</p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border bg-surface-sunken font-mono text-[10px] uppercase tracking-[0.1em] text-muted">
                <th className="py-2 font-medium">Servicio</th>
                <th className="py-2 font-medium">Cantidad</th>
                <th className="py-2 text-right font-medium">Valor</th>
              </tr>
            </thead>
            <tbody>
              {top_servicios.map((s) => (
                <tr key={s.servicio} className="border-b border-border last:border-0">
                  <td className="py-2.5 font-medium text-foreground">{s.servicio}</td>
                  <td className="py-2.5 text-muted">{s.cantidad}</td>
                  <td className="py-2.5 text-right text-foreground">{formatMoneda(s.valor, moneda)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
