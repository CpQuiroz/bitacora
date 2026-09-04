"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { formatMoneda } from "@/lib/formatMoneda";
import { descargarCSV } from "@/lib/exportCsv";
import { Card, ErrorText, Stat } from "@/components/ui";
import { GraficoIngresos, type PuntoIngresoMes } from "@/components/charts/GraficoIngresos";
import { GraficoDistribucion } from "@/components/charts/GraficoDistribucion";
import { EstadoCargando } from "@/components/estados";
import { useInformes } from "../InformesContext";

type ResumenFinanciero = { recibido: number; pendiente: number; atrasado: number; total: number };
type PorFormaPago = { medio_pago: string; monto: number; cantidad: number };
type MejorCliente = { cliente: string; cobros: number; ingreso: number };

type Datos = {
  resumen_financiero: ResumenFinanciero;
  ingresos_por_mes: PuntoIngresoMes[];
  por_forma_pago: PorFormaPago[];
  mejores_clientes: MejorCliente[];
};

const ETIQUETA_MEDIO: Record<string, string> = {
  webpay: "Webpay",
  flow: "Flow",
  mercadopago: "Mercado Pago",
  transferencia: "Transferencia",
  efectivo: "Efectivo",
  otro: "Otro",
  sin_definir: "Sin definir",
};

function KpiCard({ etiqueta, valor, sub }: { etiqueta: string; valor: string; sub?: string }) {
  return <Stat etiqueta={etiqueta} valor={valor} nota={sub} />;
}

const pct = (parte: number, total: number) => (total > 0 ? `${((parte / total) * 100).toFixed(0)}% del total` : undefined);

export default function InformeFinancieroPage() {
  const { desde, hasta, refreshKey, usuario, registrarExportCsv } = useInformes();
  const [datos, setDatos] = useState<Datos | null>(null);
  const [error, setError] = useState<string | null>(null);
  const moneda = usuario.empresa.moneda;

  useEffect(() => {
    setDatos(null);
    setError(null);
    apiFetch(`/api/informes/financiero?periodo=personalizado&desde=${desde}&hasta=${hasta}`)
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
        { Sección: "Resumen Financiero", Campo: "Recibido", Valor: datos.resumen_financiero.recibido },
        { Sección: "Resumen Financiero", Campo: "Pendiente", Valor: datos.resumen_financiero.pendiente },
        { Sección: "Resumen Financiero", Campo: "Vencido", Valor: datos.resumen_financiero.atrasado },
        { Sección: "Resumen Financiero", Campo: "Total", Valor: datos.resumen_financiero.total },
        ...datos.por_forma_pago.map((f) => ({
          Sección: "Por Forma de Pago",
          Campo: ETIQUETA_MEDIO[f.medio_pago] ?? f.medio_pago,
          Valor: f.monto,
        })),
        ...datos.mejores_clientes.map((c) => ({ Sección: "Mejores Clientes", Campo: c.cliente, Valor: c.ingreso })),
      ];
      descargarCSV(`informe-financiero_${desde}_a_${hasta}.csv`, filas);
    });
    return () => registrarExportCsv(null);
  }, [datos, desde, hasta, registrarExportCsv]);

  if (error) return <ErrorText>{error}</ErrorText>;
  if (!datos) return <EstadoCargando />;

  const { resumen_financiero, ingresos_por_mes, por_forma_pago, mejores_clientes } = datos;

  const distribucionEstado = [
    { estado: "Recibido", cantidad: resumen_financiero.recibido },
    { estado: "Pendiente", cantidad: resumen_financiero.pendiente },
    { estado: "Vencido", cantidad: resumen_financiero.atrasado },
  ].filter((d) => d.cantidad > 0);

  const distribucionFormaPago = por_forma_pago.map((f) => ({
    estado: ETIQUETA_MEDIO[f.medio_pago] ?? f.medio_pago,
    cantidad: f.monto,
  }));

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard etiqueta="Ingreso Total" valor={formatMoneda(resumen_financiero.total, moneda)} />
        <KpiCard etiqueta="Total Recibido" valor={formatMoneda(resumen_financiero.recibido, moneda)} sub={pct(resumen_financiero.recibido, resumen_financiero.total)} />
        <KpiCard etiqueta="Total Pendiente" valor={formatMoneda(resumen_financiero.pendiente, moneda)} sub={pct(resumen_financiero.pendiente, resumen_financiero.total)} />
        <KpiCard etiqueta="Total Vencido" valor={formatMoneda(resumen_financiero.atrasado, moneda)} sub={pct(resumen_financiero.atrasado, resumen_financiero.total)} />
      </div>

      <Card>
        <h2 className="mb-4 text-sm font-semibold text-foreground">Ingreso por Período</h2>
        <GraficoIngresos datos={ingresos_por_mes} moneda={moneda} />
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="mb-4 text-sm font-semibold text-foreground">Ingreso por Estado</h2>
          <GraficoDistribucion
            datos={distribucionEstado}
            mensajeVacio="Ningún ingreso registrado en el período."
            formatearValor={(n) => formatMoneda(n, moneda)}
            coloresPorEstado={{ Recibido: "var(--success)", Pendiente: "var(--warning)", Vencido: "var(--danger)" }}
          />
        </Card>

        <Card>
          <h2 className="mb-4 text-sm font-semibold text-foreground">Por Forma de Pago</h2>
          <GraficoDistribucion
            datos={distribucionFormaPago}
            mensajeVacio="Ningún cobro con forma de pago registrada en el período."
            formatearValor={(n) => formatMoneda(n, moneda)}
          />
        </Card>
      </div>

      <Card>
        <h2 className="mb-4 text-sm font-semibold text-foreground">Mejores Clientes</h2>
        {mejores_clientes.length === 0 ? (
          <p className="text-sm text-muted">Ningún cobro registrado en el período.</p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border bg-surface-sunken font-mono text-[10px] uppercase tracking-[0.1em] text-muted">
                <th className="py-2 font-medium">Cliente</th>
                <th className="py-2 font-medium">Cobros</th>
                <th className="py-2 text-right font-medium">Ingreso</th>
              </tr>
            </thead>
            <tbody>
              {mejores_clientes.map((c) => (
                <tr key={c.cliente} className="border-b border-border last:border-0">
                  <td className="py-2.5 font-medium text-foreground">{c.cliente}</td>
                  <td className="py-2.5 text-muted">{c.cobros}</td>
                  <td className="py-2.5 text-right text-foreground">{formatMoneda(c.ingreso, moneda)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
