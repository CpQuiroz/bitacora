"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { formatMoneda } from "@/lib/formatMoneda";
import { descargarCSV } from "@/lib/exportCsv";
import { Card, ErrorText } from "@/components/ui";
import { GraficoDistribucion, type PuntoDistribucion } from "@/components/charts/GraficoDistribucion";
import { GraficoEvolucionSimple, type PuntoEvolucionSimple } from "@/components/charts/GraficoEvolucionSimple";
import { useInformes } from "../InformesContext";

type Kpis = { total_gastos: number; gastos_pagados: number; gastos_pendientes: number; promedio_por_gasto: number };
type Cantidades = { total: number; pagados: number; pendientes: number };
type ClienteGasto = { cliente: string; monto: number };

type Datos = {
  kpis: Kpis;
  cantidades: Cantidades;
  evolucion_mensual: PuntoEvolucionSimple[];
  distribucion_categoria: PuntoDistribucion[];
  clientes_con_mas_gastos: ClienteGasto[];
};

function KpiCard({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <Card className="p-4">
      <p className="text-xs font-medium text-muted">{etiqueta}</p>
      <p className="mt-1 text-xl font-semibold tabular-nums text-foreground">{valor}</p>
    </Card>
  );
}

function MiniCard({ etiqueta, cantidad }: { etiqueta: string; cantidad: number }) {
  return (
    <div className="flex flex-col items-center gap-1 rounded-xl border border-border px-6 py-4 text-center">
      <p className="text-2xl font-semibold tabular-nums text-foreground">{cantidad}</p>
      <p className="text-xs text-muted">{etiqueta}</p>
    </div>
  );
}

export default function InformeGastosOsPage() {
  const { desde, hasta, refreshKey, usuario, registrarExportCsv } = useInformes();
  const [datos, setDatos] = useState<Datos | null>(null);
  const [error, setError] = useState<string | null>(null);
  const moneda = usuario.empresa.moneda;

  useEffect(() => {
    setDatos(null);
    setError(null);
    apiFetch(`/api/informes/gastos-os?periodo=personalizado&desde=${desde}&hasta=${hasta}`)
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
        { Sección: "KPIs", Campo: "Total en Gastos", Valor: datos.kpis.total_gastos },
        { Sección: "KPIs", Campo: "Gastos Pagados", Valor: datos.kpis.gastos_pagados },
        { Sección: "KPIs", Campo: "Gastos Pendientes", Valor: datos.kpis.gastos_pendientes },
        { Sección: "KPIs", Campo: "Promedio por Gasto", Valor: Math.round(datos.kpis.promedio_por_gasto) },
        ...datos.distribucion_categoria.map((d) => ({ Sección: "Por Categoría", Campo: d.estado, Valor: d.cantidad })),
        ...datos.clientes_con_mas_gastos.map((c) => ({ Sección: "Clientes con Más Gastos", Campo: c.cliente, Valor: c.monto })),
      ];
      descargarCSV(`informe-gastos-en-os_${desde}_a_${hasta}.csv`, filas);
    });
    return () => registrarExportCsv(null);
  }, [datos, desde, hasta, registrarExportCsv]);

  if (error) return <ErrorText>{error}</ErrorText>;
  if (!datos) return <p className="text-sm text-muted">Cargando…</p>;

  const { kpis, cantidades, evolucion_mensual, distribucion_categoria, clientes_con_mas_gastos } = datos;

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard etiqueta="Total en Gastos" valor={formatMoneda(kpis.total_gastos, moneda)} />
        <KpiCard etiqueta="Gastos Pagados" valor={formatMoneda(kpis.gastos_pagados, moneda)} />
        <KpiCard etiqueta="Gastos Pendientes" valor={formatMoneda(kpis.gastos_pendientes, moneda)} />
        <KpiCard etiqueta="Promedio por Gasto" valor={formatMoneda(kpis.promedio_por_gasto, moneda)} />
      </div>

      <Card>
        <h2 className="mb-4 text-sm font-semibold text-foreground">Evolución Mensual</h2>
        <GraficoEvolucionSimple
          datos={evolucion_mensual}
          mensajeVacio="Ningún gasto en el período seleccionado."
          formatearValor={(n) => formatMoneda(n, moneda)}
        />
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="mb-4 text-sm font-semibold text-foreground">Por Categoría</h2>
          <GraficoDistribucion
            datos={distribucion_categoria}
            mensajeVacio="Ningún gasto categorizado."
            formatearValor={(n) => formatMoneda(n, moneda)}
          />
        </Card>

        <Card>
          <h2 className="mb-4 text-sm font-semibold text-foreground">Clientes con Más Gastos</h2>
          {clientes_con_mas_gastos.length === 0 ? (
            <p className="text-sm text-muted">Ninguna despesa vinculada a una OS encontrada en el período.</p>
          ) : (
            <div className="flex flex-col divide-y divide-border">
              {clientes_con_mas_gastos.map((c) => (
                <div key={c.cliente} className="flex items-center justify-between py-2.5 text-sm">
                  <span className="font-medium text-foreground">{c.cliente}</span>
                  <span className="text-muted">{formatMoneda(c.monto, moneda)}</span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <div className="flex flex-wrap justify-center gap-4">
        <MiniCard etiqueta="Total de Gastos" cantidad={cantidades.total} />
        <MiniCard etiqueta="Gastos Pagados" cantidad={cantidades.pagados} />
        <MiniCard etiqueta="Gastos Pendientes" cantidad={cantidades.pendientes} />
      </div>
    </div>
  );
}
