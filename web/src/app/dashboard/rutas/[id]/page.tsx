"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import type { Cliente, RutaPlanificada, Trabajo, Usuario } from "@bitacora/shared";
import { supabase } from "@/lib/supabase";
import { apiFetch } from "@/lib/api";
import { DashboardShell, type UsuarioShell } from "@/components/DashboardShell";
import { Badge, Button, Card, ErrorText } from "@/components/ui";
import { IconChevronLeft, IconRoute } from "@/components/icons";
import dynamic from "next/dynamic";
import type { Parada } from "@/components/MapaRutas";
// Leaflet ~148 KB — carga aparte (AUDITORIA_PERFORMANCE_COSTOS.md #7).
const MapaRutas = dynamic(() => import("@/components/MapaRutas").then((m) => m.MapaRutas), {
  ssr: false,
  loading: () => <div className="h-64 animate-pulse rounded-lg bg-surface" />,
});

type TareaConCliente = Trabajo & { cliente_info: Cliente | null };
type RutaConTareas = RutaPlanificada & { tareas: TareaConCliente[] };

export default function VerRutaPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();

  const [usuario, setUsuario] = useState<UsuarioShell | null>(null);
  const [equipo, setEquipo] = useState<Usuario[]>([]);
  const [ruta, setRuta] = useState<RutaConTareas | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [optimizando, setOptimizando] = useState(false);

  const cargar = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      router.replace("/login");
      return;
    }
    const [resMe, resEquipo, resRuta] = await Promise.all([
      apiFetch("/api/me"),
      apiFetch("/api/usuarios"),
      apiFetch(`/api/rutas-planificadas/${params.id}`),
    ]);
    if (resMe.ok) {
      const { usuario: u } = await resMe.json();
      if (u) setUsuario({ nombre: u.nombre, rol: u.rol, empresaNombre: u.empresa?.nombre ?? "", empresaLogoUrl: u.empresa?.logo_url ?? null, colorPrimario: u.empresa?.color_primario ?? null, colorPrimarioForeground: u.empresa?.color_primario_foreground ?? null, colorSecundario: u.empresa?.color_secundario ?? null, fuente: u.empresa?.fuente ?? null, moneda: u.empresa?.moneda ?? "CLP" });
    }
    if (resEquipo.ok) setEquipo(await resEquipo.json());
    if (!resRuta.ok) {
      setError("No se pudo cargar la ruta");
      return;
    }
    setRuta(await resRuta.json());
  }, [params.id, router]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  async function onOptimizar() {
    setOptimizando(true);
    const res = await apiFetch(`/api/rutas-planificadas/${params.id}/optimizar`, { method: "POST" });
    setOptimizando(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "No se pudo optimizar la ruta");
      return;
    }
    setRuta(await res.json());
  }

  if (!usuario) return null;

  return (
    <DashboardShell usuario={usuario}>
      <Link href="/dashboard/rutas" className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-brand hover:underline">
        <IconChevronLeft className="h-4 w-4" />
        Rutas
      </Link>

      {error && <ErrorText>{error}</ErrorText>}

      {ruta && (
        <>
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight text-foreground">
                <IconRoute className="h-6 w-6 text-brand" />
                {ruta.nombre || `Ruta de ${equipo.find((u) => u.id === ruta.responsable_id)?.nombre ?? "—"}`}
              </h1>
              <p className="mt-1 text-sm text-muted">
                {ruta.fecha_inicio} · {ruta.hora_inicio}–{ruta.hora_fin} · desde {ruta.punto_base_direccion}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Badge value={ruta.estado} />
              {ruta.estado === "borrador" && (
                <Button onClick={onOptimizar} disabled={optimizando || ruta.tareas.length === 0}>
                  {optimizando ? "Calculando…" : "Finalizar ruterización"}
                </Button>
              )}
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
            <MapaRutas
              paradas={ruta.tareas.map((t) => ({
                trabajo_id: t.id,
                cliente_nombre: t.cliente,
                direccion: t.ubicacion ?? "",
                lat: t.cliente_info?.lat ?? null,
                lng: t.cliente_info?.lng ?? null,
              }))}
              puntoBase={{ direccion: ruta.punto_base_direccion, lat: ruta.punto_base_lat, lng: ruta.punto_base_lng }}
              mostrarLinea={ruta.estado === "finalizada"}
            />

            <Card className="p-0">
              <div className="flex flex-col divide-y divide-border">
                {ruta.tareas.length === 0 && (
                  <p className="p-4 text-sm text-muted">Esta ruta no tiene tareas.</p>
                )}
                {ruta.tareas.map((t, i) => (
                  <div key={t.id} className="flex items-start gap-3 p-4">
                    <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand text-xs font-semibold text-brand-foreground">
                      {t.orden_en_ruta != null ? t.orden_en_ruta + 1 : i + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate font-medium text-foreground">{t.cliente}</p>
                        <Badge value={t.prioridad} />
                      </div>
                      <p className="truncate text-xs text-muted">{t.ubicacion}</p>
                      {t.hora_estimada_llegada && (
                        <p className="text-xs text-muted">Llegada estimada: {t.hora_estimada_llegada}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              {ruta.estado === "finalizada" && (
                <div className="border-t border-border p-4 text-xs text-muted">
                  Distancia total: {ruta.distancia_total_km ?? "—"} km · Duración total:{" "}
                  {ruta.duracion_total_min ?? "—"} min
                </div>
              )}
            </Card>
          </div>
        </>
      )}
    </DashboardShell>
  );
}
