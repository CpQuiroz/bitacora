"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ChevronLeft, Route as RouteIcon } from "lucide-react";
import type { Cliente, Prioridad, RutaPlanificada, Trabajo, Usuario } from "@bitacora/shared";
import { supabase } from "@/lib/supabase";
import { apiFetch } from "@/lib/api";
import { DashboardShell, type UsuarioShell } from "@/components/DashboardShell";
import { Button, Card, StatusBadge, Tag } from "@bitacora/ui/web";
import dynamic from "next/dynamic";
import type { Parada } from "@/components/MapaRutas";
// Leaflet ~148 KB — carga aparte (AUDITORIA_PERFORMANCE_COSTOS.md #7).
const MapaRutas = dynamic(() => import("@/components/MapaRutas").then((m) => m.MapaRutas), {
  ssr: false,
  loading: () => <div className="h-64 animate-pulse rounded-ds-md bg-ds-surface" />,
});

type TareaConCliente = Trabajo & { cliente_info: Cliente | null };
type RutaConTareas = RutaPlanificada & { tareas: TareaConCliente[] };

const TONO_PRIORIDAD: Record<Prioridad, "accent" | "neutral" | "outline"> = {
  alta: "accent",
  media: "neutral",
  baja: "outline",
};

// PASO 6 (sistema de diseño) — migrado. Ver docs/design-system.md.
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
      <Link href="/dashboard/rutas" className="mb-ds-4 inline-flex items-center gap-ds-1 font-ds-body text-ds-small font-medium text-ds-brand hover:underline">
        <ChevronLeft size={16} strokeWidth={2.75} />
        Rutas
      </Link>

      {error ? <p className="font-ds-body text-ds-small text-ds-accent-700">{error}</p> : null}

      {ruta && (
        <>
          <div className="mb-ds-6 flex flex-wrap items-center justify-between gap-ds-3">
            <div>
              <p className="ds-heading flex items-center gap-ds-2 text-ds-h2 text-ds-text">
                <RouteIcon size={24} strokeWidth={2.75} className="text-ds-brand" />
                {ruta.nombre || `Ruta de ${equipo.find((u) => u.id === ruta.responsable_id)?.nombre ?? "—"}`}
              </p>
              <p className="mt-ds-1 font-ds-body text-ds-small text-ds-text/70">
                {ruta.fecha_inicio} · {ruta.hora_inicio}–{ruta.hora_fin} · desde {ruta.punto_base_direccion}
              </p>
            </div>
            <div className="flex items-center gap-ds-3">
              <StatusBadge estado={ruta.estado} tonoForzado={ruta.estado === "finalizada" ? "completado" : "en_progreso"} />
              {ruta.estado === "borrador" && (
                <Button onPress={onOptimizar} deshabilitado={optimizando || ruta.tareas.length === 0} cargando={optimizando}>
                  Finalizar ruterización
                </Button>
              )}
            </div>
          </div>

          <div className="grid gap-ds-6 lg:grid-cols-[1fr_20rem]">
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

            <Card sinRelleno>
              <div className="flex flex-col divide-y divide-ds-divider">
                {ruta.tareas.length === 0 && (
                  <p className="p-ds-4 font-ds-body text-ds-small text-ds-text/70">Esta ruta no tiene tareas.</p>
                )}
                {ruta.tareas.map((t, i) => (
                  <div key={t.id} className="flex items-start gap-ds-3 p-ds-4">
                    <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-ds-pill bg-ds-brand text-xs font-semibold text-ds-brand-foreground">
                      {t.orden_en_ruta != null ? t.orden_en_ruta + 1 : i + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-ds-2">
                        <p className="truncate font-ds-body font-medium text-ds-text">{t.cliente}</p>
                        <Tag tono={TONO_PRIORIDAD[t.prioridad]}>{t.prioridad}</Tag>
                      </div>
                      <p className="truncate font-ds-body text-ds-caption text-ds-text/60">{t.ubicacion}</p>
                      {t.hora_estimada_llegada && (
                        <p className="font-ds-body text-ds-caption text-ds-text/60">Llegada estimada: {t.hora_estimada_llegada}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              {ruta.estado === "finalizada" && (
                <div className="border-t border-ds-divider p-ds-4 font-ds-body text-ds-caption text-ds-text/60">
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
