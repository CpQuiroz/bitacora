"use client";

import { useEffect, useMemo, useState } from "react";
import { Sparkles } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { descargarCSV } from "@/lib/exportCsv";
import { Card, ErrorState, LoadingState } from "@bitacora/ui/web";
import { Stat } from "@/components/Stat";
import { useInformes } from "../InformesContext";

// Tarea 145 (opción B, 26-sep-2026): el "Tipo de OS" salió de la app, así
// que este informe ya no agrupa por tipo: muestra el volumen de OS, la tasa
// de conclusión y los clientes con más OS del período.
type Kpis = { total_os: number; completadas: number; tasa_promedio: number };
type TopCliente = { cliente: string; cantidad: number };
type Datos = { kpis: Kpis; top_clientes?: TopCliente[] };

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

  const topClientes = useMemo(() => datos?.top_clientes ?? [], [datos]);

  useEffect(() => {
    if (!datos) {
      registrarExportCsv(null);
      return;
    }
    registrarExportCsv(() => {
      const filas: Record<string, string | number>[] = [
        { Sección: "KPIs", Campo: "Total de OS", Valor: datos.kpis.total_os },
        { Sección: "KPIs", Campo: "Completadas", Valor: datos.kpis.completadas },
        { Sección: "KPIs", Campo: "Tasa de conclusión (%)", Valor: datos.kpis.tasa_promedio.toFixed(1) },
        ...topClientes.map((c) => ({ Sección: "Clientes con más OS", Campo: c.cliente, Valor: c.cantidad })),
      ];
      descargarCSV(`informe-servicios_${desde}_a_${hasta}.csv`, filas);
    });
    return () => registrarExportCsv(null);
  }, [datos, topClientes, desde, hasta, registrarExportCsv]);

  const insights = useMemo(() => {
    if (!datos || datos.kpis.total_os === 0) return [];
    const lista: string[] = [];
    const top = topClientes[0];
    if (top) {
      lista.push(`${top.cliente} concentra el ${((top.cantidad / datos.kpis.total_os) * 100).toFixed(0)}% de tus OS del período (${top.cantidad}).`);
    }
    if (datos.kpis.tasa_promedio >= 80) {
      lista.push(`Tasa de conclusión alta (${datos.kpis.tasa_promedio.toFixed(0)}%) — la mayoría de tus OS llegan a buen puerto.`);
    } else if (datos.kpis.tasa_promedio < 50) {
      lista.push(`Menos de la mitad de tus OS del período están terminadas (${datos.kpis.tasa_promedio.toFixed(0)}%).`);
    }
    return lista;
  }, [datos, topClientes]);

  if (error) return <ErrorState mensaje={error} />;
  if (!datos) return <LoadingState />;

  const { kpis } = datos;

  return (
    <div className="flex flex-col gap-ds-6">
      <div className="grid gap-ds-4 sm:grid-cols-3">
        <KpiCard etiqueta="Total de OS" valor={String(kpis.total_os)} />
        <KpiCard etiqueta="Completadas" valor={String(kpis.completadas)} />
        <KpiCard etiqueta="Tasa de conclusión" valor={`${kpis.tasa_promedio.toFixed(0)}%`} />
      </div>

      <Card>
        <p className="mb-ds-4 font-ds-body text-ds-small font-semibold text-ds-text">Clientes con más OS</p>
        {topClientes.length === 0 ? (
          <p className="font-ds-body text-ds-small text-ds-text/70">Sin OS en el período.</p>
        ) : (
          <table className="w-full text-left text-ds-body">
            <thead>
              <tr className="border-b border-ds-divider text-[11px] font-medium uppercase tracking-[0.08em] text-ds-text-secondary">
                <th className="py-ds-2">Cliente</th>
                <th className="py-ds-2 text-right">OS</th>
              </tr>
            </thead>
            <tbody>
              {topClientes.map((c) => (
                <tr key={c.cliente} className="border-b border-ds-text/[0.08] last:border-0">
                  <td className="py-2.5 font-medium text-ds-text">{c.cliente}</td>
                  <td className="py-2.5 text-right tabular-nums text-ds-text">{c.cantidad}</td>
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
          <p className="font-ds-body text-ds-small text-ds-text/70">Sin observaciones todavía para este período.</p>
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
