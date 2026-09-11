"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, ClipboardCheck, Clock } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { apiFetch } from "@/lib/api";
import { DashboardShell, type UsuarioShell } from "@/components/DashboardShell";
import { Card, LoadingState } from "@bitacora/ui/web";
import { Stat } from "@/components/Stat";

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

// PASO 6 (sistema de diseño) — migrado. Ver docs/design-system.md.
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
      <Link href="/dashboard/registros/equipos" className="mb-ds-4 inline-flex items-center gap-ds-1 font-ds-body text-ds-small font-medium text-ds-brand hover:underline">
        <ChevronLeft size={16} strokeWidth={2.75} />
        Equipos
      </Link>
      <p className="ds-heading text-ds-h2 text-ds-text">Dashboard de Equipos</p>
      <p className="mt-ds-1 font-ds-body text-ds-small text-ds-text/70">Vista general de tus activos, mantenciones y garantías</p>

      {error ? <p className="mt-ds-6 font-ds-body text-ds-small text-ds-accent-700">{error}</p> : null}
      {!datos && !error ? <LoadingState /> : null}

      {datos && (
        <div className="mt-ds-6 flex flex-col gap-ds-6">
          <div className="grid gap-ds-4 sm:grid-cols-2 lg:grid-cols-4">
            <Stat etiqueta="Total de equipos" valor={datos.total_equipos} />
            <Stat etiqueta="Equipos activos" valor={datos.equipos_activos} />
            <Stat etiqueta="Planes de mantención activos" valor={datos.planes_mantencion_activos} />
            <Stat
              etiqueta="Garantías por vencer"
              valor={datos.garantias_por_vencer}
              nota={datos.garantias_por_vencer > 0 ? "en los próximos 30 días" : undefined}
              tono="alerta"
            />
          </div>

          <div className="grid gap-ds-6 lg:grid-cols-2">
            <Card>
              <p className="mb-ds-4 font-ds-body text-ds-small font-semibold text-ds-text">Equipos por categoría</p>
              {datos.equipos_por_categoria.length === 0 ? (
                <p className="font-ds-body text-ds-small text-ds-text/70">Sin equipos registrados.</p>
              ) : (
                <div className="flex flex-col gap-ds-2">
                  {datos.equipos_por_categoria
                    .sort((a, b) => b.cantidad - a.cantidad)
                    .map((c) => (
                      <div key={c.categoria} className="flex items-center justify-between font-ds-body text-ds-small">
                        <span className="text-ds-text">{c.categoria}</span>
                        <span className="text-ds-text/60">{c.cantidad}</span>
                      </div>
                    ))}
                </div>
              )}
            </Card>

            <Card>
              <p className="mb-ds-4 font-ds-body text-ds-small font-semibold text-ds-text">Equipos con más órdenes de servicio</p>
              {datos.equipos_con_mas_os.length === 0 ? (
                <p className="font-ds-body text-ds-small text-ds-text/70">Ninguna OS vinculada a un equipo todavía.</p>
              ) : (
                <div className="flex flex-col divide-y divide-ds-divider">
                  {datos.equipos_con_mas_os.map((e) => (
                    <button
                      key={e.equipo_id}
                      type="button"
                      onClick={() => router.push(`/dashboard/registros/equipos/${e.equipo_id}`)}
                      className="flex items-center justify-between py-2 text-left font-ds-body text-ds-small hover:text-ds-brand"
                    >
                      <span className="text-ds-text">{e.nombre}</span>
                      <span className="text-ds-text/60">{e.cantidad_os} OS</span>
                    </button>
                  ))}
                </div>
              )}
            </Card>
          </div>

          <Card>
            <p className="mb-ds-4 font-ds-body text-ds-small font-semibold text-ds-text">Próximas mantenciones (30 días)</p>
            {datos.proximas_mantenciones.length === 0 ? (
              <div className="flex flex-col items-center gap-ds-2 py-ds-6 text-center">
                <ClipboardCheck size={22} strokeWidth={2.75} className="text-ds-text/60" />
                <p className="font-ds-body text-ds-small text-ds-text/70">Nada programado en los próximos 30 días.</p>
              </div>
            ) : (
              <div className="flex flex-col divide-y divide-ds-divider">
                {datos.proximas_mantenciones.map((p) => (
                  <div key={p.id} className="flex items-center justify-between py-2 font-ds-body text-ds-small">
                    <span className="text-ds-text">{p.equipo_nombre}</span>
                    <span className="text-ds-text/60">{p.proxima_fecha}</span>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card>
            <p className="mb-ds-4 font-ds-body text-ds-small font-semibold text-ds-text">Documentos de equipos por vencer</p>
            {datos.documentos_por_vencer.length === 0 ? (
              <div className="flex flex-col items-center gap-ds-2 py-ds-6 text-center">
                <Clock size={22} strokeWidth={2.75} className="text-ds-text/60" />
                <p className="font-ds-body text-ds-small text-ds-text/70">Nada por vencer en los próximos 30 días.</p>
              </div>
            ) : (
              <div className="flex flex-col divide-y divide-ds-divider">
                {datos.documentos_por_vencer.map((d) => {
                  const dias = diasRestantes(d.fecha_vencimiento);
                  const vencido = dias < 0;
                  return (
                    <div key={d.id} className="flex items-center justify-between gap-ds-3 py-2 font-ds-body text-ds-small">
                      <div className="min-w-0">
                        <span className="text-ds-text">{d.equipo_nombre}</span>
                        <span className="text-ds-text/60"> · {d.tipo_nombre}</span>
                      </div>
                      <div className="flex shrink-0 items-center gap-ds-3">
                        <span className="text-ds-text/60">{d.fecha_vencimiento}</span>
                        <span className={`font-medium ${vencido ? "text-ds-accent-800" : dias <= 7 ? "text-ds-accent-700" : "text-ds-text/60"}`}>
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
