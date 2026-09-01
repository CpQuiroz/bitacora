"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { apiFetch } from "@/lib/api";
import { DashboardShell, type UsuarioShell } from "@/components/DashboardShell";
import { Card, ErrorText, PageHeader } from "@/components/ui";
import { IconChevronLeft, IconClipboardCheck, IconClock, IconLayers, IconShield, IconWrench } from "@/components/icons";

type DashboardEquipos = {
  total_equipos: number;
  equipos_activos: number;
  planes_mantencion_activos: number;
  garantias_por_vencer: number;
  equipos_por_categoria: { categoria: string; cantidad: number }[];
  proximas_mantenciones: { id: string; proxima_fecha: string; equipo_nombre: string }[];
  documentos_por_vencer: {
    id: string;
    equipo_nombre: string;
    tipo_nombre: string;
    fecha_vencimiento: string;
    estado: "vigente" | "por_vencer" | "vencido" | null;
  }[];
  equipos_con_mas_os: { equipo_id: string; nombre: string; cantidad_os: number }[];
};

// Días entre hoy y la fecha de vencimiento (negativo = ya vencido).
function diasRestantes(fecha: string): number {
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const venc = new Date(fecha + "T00:00:00");
  return Math.round((venc.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24));
}

export default function EquiposDashboardPage() {
  const router = useRouter();
  const [usuario, setUsuario] = useState<UsuarioShell | null>(null);
  const [datos, setDatos] = useState<DashboardEquipos | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        router.replace("/login");
        return;
      }
      const [resMe, resDash] = await Promise.all([apiFetch("/api/me"), apiFetch("/api/equipos/dashboard")]);
      if (resMe.ok) {
        const { usuario: u } = await resMe.json();
        if (u)
          setUsuario({
            nombre: u.nombre,
            rol: u.rol,
            empresaNombre: u.empresa?.nombre ?? "",
            empresaLogoUrl: u.empresa?.logo_url ?? null,
            colorPrimario: u.empresa?.color_primario ?? null,
            colorPrimarioForeground: u.empresa?.color_primario_foreground ?? null,
            colorSecundario: u.empresa?.color_secundario ?? null,
            fuente: u.empresa?.fuente ?? null,
            moneda: u.empresa?.moneda ?? "CLP",
          });
      }
      if (!resDash.ok) {
        setError("No se pudo cargar el dashboard de Equipos");
        return;
      }
      setDatos(await resDash.json());
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!usuario) return null;

  return (
    <DashboardShell usuario={usuario}>
      <Link href="/dashboard/registros/equipos" className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-brand hover:underline">
        <IconChevronLeft className="h-4 w-4" />
        Equipos
      </Link>
      <PageHeader title="Dashboard de Equipos" subtitle="Vista general de tus activos, mantenciones y garantías" />

      {error && (
        <div className="mt-6">
          <ErrorText>{error}</ErrorText>
        </div>
      )}
      {!datos && !error && <p className="mt-6 text-sm text-muted">Cargando…</p>}

      {datos && (
        <div className="mt-6 flex flex-col gap-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card>
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-soft text-brand">
                  <IconLayers className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-2xl font-semibold text-foreground">{datos.total_equipos}</p>
                  <p className="text-xs text-muted">Total de equipos</p>
                </div>
              </div>
            </Card>
            <Card>
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-success-soft text-success">
                  <IconWrench className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-2xl font-semibold text-foreground">{datos.equipos_activos}</p>
                  <p className="text-xs text-muted">Equipos activos</p>
                </div>
              </div>
            </Card>
            <Card>
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-soft text-brand">
                  <IconClock className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-2xl font-semibold text-foreground">{datos.planes_mantencion_activos}</p>
                  <p className="text-xs text-muted">Planes de mantención activos</p>
                </div>
              </div>
            </Card>
            <Card>
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-warning-soft text-warning">
                  <IconShield className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-2xl font-semibold text-foreground">{datos.garantias_por_vencer}</p>
                  <p className="text-xs text-muted">Garantías por vencer (30 días)</p>
                </div>
              </div>
            </Card>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <h2 className="mb-4 text-sm font-semibold text-foreground">Equipos por categoría</h2>
              {datos.equipos_por_categoria.length === 0 ? (
                <p className="text-sm text-muted">Sin equipos registrados.</p>
              ) : (
                <div className="flex flex-col gap-2">
                  {datos.equipos_por_categoria
                    .sort((a, b) => b.cantidad - a.cantidad)
                    .map((c) => (
                      <div key={c.categoria} className="flex items-center justify-between text-sm">
                        <span className="text-foreground">{c.categoria}</span>
                        <span className="text-muted">{c.cantidad}</span>
                      </div>
                    ))}
                </div>
              )}
            </Card>

            <Card>
              <h2 className="mb-4 text-sm font-semibold text-foreground">Equipos con más órdenes de servicio</h2>
              {datos.equipos_con_mas_os.length === 0 ? (
                <p className="text-sm text-muted">Ninguna OS vinculada a un equipo todavía.</p>
              ) : (
                <div className="flex flex-col divide-y divide-border">
                  {datos.equipos_con_mas_os.map((e) => (
                    <button
                      key={e.equipo_id}
                      type="button"
                      onClick={() => router.push(`/dashboard/registros/equipos/${e.equipo_id}`)}
                      className="flex items-center justify-between py-2 text-left text-sm hover:text-brand"
                    >
                      <span className="text-foreground">{e.nombre}</span>
                      <span className="text-muted">{e.cantidad_os} OS</span>
                    </button>
                  ))}
                </div>
              )}
            </Card>
          </div>

          <Card>
            <h2 className="mb-4 text-sm font-semibold text-foreground">Próximas mantenciones (30 días)</h2>
            {datos.proximas_mantenciones.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-6 text-center">
                <IconClipboardCheck className="h-6 w-6 text-muted" />
                <p className="text-sm text-muted">Nada programado en los próximos 30 días.</p>
              </div>
            ) : (
              <div className="flex flex-col divide-y divide-border">
                {datos.proximas_mantenciones.map((p) => (
                  <div key={p.id} className="flex items-center justify-between py-2 text-sm">
                    <span className="text-foreground">{p.equipo_nombre}</span>
                    <span className="text-muted">{p.proxima_fecha}</span>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card>
            <h2 className="mb-4 text-sm font-semibold text-foreground">Documentos de equipos por vencer</h2>
            {datos.documentos_por_vencer.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-6 text-center">
                <IconClock className="h-6 w-6 text-muted" />
                <p className="text-sm text-muted">Nada por vencer en los próximos 30 días.</p>
              </div>
            ) : (
              <div className="flex flex-col divide-y divide-border">
                {datos.documentos_por_vencer.map((d) => {
                  const dias = diasRestantes(d.fecha_vencimiento);
                  const vencido = dias < 0;
                  return (
                    <div key={d.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                      <div className="min-w-0">
                        <span className="text-foreground">{d.equipo_nombre}</span>
                        <span className="text-muted"> · {d.tipo_nombre}</span>
                      </div>
                      <div className="flex shrink-0 items-center gap-3">
                        <span className="text-muted">{d.fecha_vencimiento}</span>
                        <span className={`font-medium ${vencido ? "text-danger" : dias <= 7 ? "text-warning" : "text-muted"}`}>
                          {vencido ? "Vencido" : dias === 0 ? "Vence hoy" : `${dias} día${dias === 1 ? "" : "s"}`}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </div>
      )}
    </DashboardShell>
  );
}
