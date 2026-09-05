"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { MetricasSuperAdmin } from "@bitacora/shared";
import { SuperAdminShell } from "@/components/SuperAdminShell";
import { Card, ErrorText, PageHeader } from "@/components/ui";
import { GraficoDistribucion } from "@/components/charts/GraficoDistribucion";
import { formatMoneda } from "@/lib/formatMoneda";
import { obtenerTokenSuperAdmin, superadminFetch } from "@/lib/superadminApi";

const ETIQUETA_ESTADO_SUSCRIPCION: Record<string, string> = {
  trial: "En prueba",
  activa: "Activa",
  pago_pendiente: "Pago pendiente",
  suspendida_por_pago: "Suspendida por pago",
  cancelada: "Cancelada",
};

const ETIQUETA_RUBRO: Record<string, string> = {
  transporte: "Transporte",
  servicio_tecnico: "Servicio técnico",
  cosmetologia: "Cosmetología",
  otro: "Otro",
};

function formatearBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
}

function Metrica({ label, valor, sub }: { label: string; valor: string; sub?: string }) {
  return (
    <Card>
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-foreground">{valor}</p>
      {sub && <p className="mt-1 text-[11px] text-muted">{sub}</p>}
    </Card>
  );
}

export default function SuperAdminResumenPage() {
  const router = useRouter();
  const [metricas, setMetricas] = useState<MetricasSuperAdmin | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!obtenerTokenSuperAdmin()) {
      router.replace("/superadmin/login");
      return;
    }
    (async () => {
      const res = await superadminFetch("/api/superadmin/metricas");
      if (!res.ok) {
        if (res.status === 401) {
          router.replace("/superadmin/login");
          return;
        }
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? "No se pudieron cargar las métricas");
        return;
      }
      setMetricas(await res.json());
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const distribucionSuscripcion = metricas
    ? Object.entries(metricas.empresas_por_estado_suscripcion).map(([estado, n]) => ({
        estado: ETIQUETA_ESTADO_SUSCRIPCION[estado] ?? estado,
        cantidad: n,
      }))
    : [];

  const variacion = metricas?.mrr.variacion_pct;

  return (
    <SuperAdminShell>
      <PageHeader
        title="Resumen"
        subtitle={
          metricas
            ? `${metricas.total_empresas} empresas · datos ${metricas.cacheado ? "cacheados" : "recién calculados"} — ${new Date(
                metricas.generado_en
              ).toLocaleString("es-CL")}${metricas.obsoleto ? " (el recálculo falló, mostrando el último snapshot)" : ""}`
            : "Vista agregada de todo el negocio"
        }
      />

      {error && <ErrorText>{error}</ErrorText>}

      {metricas && (
        <div className="my-6 flex flex-col gap-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Metrica
              label="MRR aproximado (este mes)"
              valor={formatMoneda(metricas.mrr.mes_actual)}
              sub={
                variacion == null
                  ? "sin base del mes anterior"
                  : `${variacion > 0 ? "▲" : variacion < 0 ? "▼" : ""} ${Math.abs(variacion)}% vs mes anterior (${formatMoneda(
                      metricas.mrr.mes_anterior
                    )})`
              }
            />
            <Metrica
              label="Churn (últimos 30 días)"
              valor={metricas.churn.tasa_pct == null ? "—" : `${metricas.churn.tasa_pct}%`}
              sub={`${metricas.churn.canceladas_30d} canceladas / base ${metricas.churn.base}`}
            />
            <Metrica label="OS creadas (este mes)" valor={metricas.uso_mes.os_creadas.toLocaleString("es-CL")} sub="todas las empresas" />
            <Metrica
              label="Storage total usado"
              valor={formatearBytes(metricas.uso_mes.storage_bytes_total)}
              sub={`${metricas.uso_mes.tokens_ia.toLocaleString("es-CL")} tokens de IA este mes`}
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <h2 className="mb-3 text-sm font-semibold text-foreground">Empresas por estado de suscripción</h2>
              <GraficoDistribucion datos={distribucionSuscripcion} mensajeVacio="Sin empresas todavía." />
            </Card>

            <Card>
              <h2 className="mb-3 text-sm font-semibold text-foreground">Empresas por rubro</h2>
              <div className="flex flex-col gap-2">
                {Object.entries(metricas.empresas_por_rubro).map(([rubro, n]) => (
                  <div key={rubro} className="flex items-center justify-between text-sm">
                    <span className="text-muted">{ETIQUETA_RUBRO[rubro] ?? rubro}</span>
                    <span className="font-medium text-foreground">{n}</span>
                  </div>
                ))}
                <div className="mt-2 border-t border-border pt-2 text-[11px] text-muted">
                  Estado operativo:{" "}
                  {Object.entries(metricas.empresas_por_estado_operativo)
                    .map(([e, n]) => `${e.replaceAll("_", " ")} ${n}`)
                    .join(" · ")}
                </div>
              </div>
            </Card>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <h2 className="mb-1 text-sm font-semibold text-foreground">Top 5 — consumo de IA este mes</h2>
              <p className="mb-3 text-[11px] text-muted">Para detectar outliers de costo.</p>
              {metricas.top_ia.length === 0 ? (
                <p className="text-sm text-muted">Sin consumo de IA este mes.</p>
              ) : (
                <div className="flex flex-col divide-y divide-border">
                  {metricas.top_ia.map((e) => (
                    <Link key={e.id} href={`/superadmin/empresas/${e.id}`} className="flex items-center justify-between py-2 text-sm hover:underline">
                      <span className="text-foreground">{e.nombre}</span>
                      <span className="text-muted">{e.tokens.toLocaleString("es-CL")} tokens</span>
                    </Link>
                  ))}
                </div>
              )}
            </Card>

            <Card>
              <h2 className="mb-1 text-sm font-semibold text-foreground">Top 5 — storage usado</h2>
              <p className="mb-3 text-[11px] text-muted">Para detectar outliers de costo.</p>
              {metricas.top_storage.length === 0 ? (
                <p className="text-sm text-muted">Ninguna empresa usa storage todavía.</p>
              ) : (
                <div className="flex flex-col divide-y divide-border">
                  {metricas.top_storage.map((e) => (
                    <Link key={e.id} href={`/superadmin/empresas/${e.id}`} className="flex items-center justify-between py-2 text-sm hover:underline">
                      <span className="text-foreground">{e.nombre}</span>
                      <span className="text-muted">{formatearBytes(e.bytes)}</span>
                    </Link>
                  ))}
                </div>
              )}
            </Card>
          </div>

          <p className="text-[11px] text-muted">
            El MRR es una aproximación operativa (suma de cobros de suscripción exitosos del mes), no revenue reconocido contable. El
            snapshot se recalcula como máximo cada 15 minutos.
          </p>
        </div>
      )}

      {!metricas && !error && <p className="my-6 text-sm text-muted">Cargando…</p>}
    </SuperAdminShell>
  );
}
