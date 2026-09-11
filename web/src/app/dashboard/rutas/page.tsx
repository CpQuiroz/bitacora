"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MapPin, Route as RouteIcon } from "lucide-react";
import type { RutaPlanificada, Usuario } from "@bitacora/shared";
import { supabase } from "@/lib/supabase";
import { apiFetch } from "@/lib/api";
import { DashboardShell, type UsuarioShell } from "@/components/DashboardShell";
import { Button, Card, DatePicker, ErrorState, LoadingState, EmptyState, Select, StatusBadge, Table } from "@bitacora/ui/web";
import dynamic from "next/dynamic";
import type { Parada } from "@/components/MapaRutas";
// Leaflet ~148 KB — carga aparte (AUDITORIA_PERFORMANCE_COSTOS.md #7).
const MapaRutas = dynamic(() => import("@/components/MapaRutas").then((m) => m.MapaRutas), {
  ssr: false,
  loading: () => <div className="h-64 animate-pulse rounded-ds-md bg-ds-surface" />,
});

function wazeUrl(lat: number, lng: number) {
  return `https://waze.com/ul?ll=${lat},${lng}&navigate=yes`;
}

function googleMapsRutaCompleta(paradas: Parada[]) {
  const puntos = paradas.filter((p) => p.lat != null && p.lng != null);
  const ruta = puntos.map((p) => `${p.lat},${p.lng}`).join("/");
  return `https://www.google.com/maps/dir/${ruta}`;
}

function aFecha(texto: string): Date | null {
  if (!texto) return null;
  const [y, m, d] = texto.split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}
function aTexto(fecha: Date | null): string {
  if (!fecha) return "";
  const y = fecha.getFullYear();
  const m = String(fecha.getMonth() + 1).padStart(2, "0");
  const d = String(fecha.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

// PASO 6 (sistema de diseño) — migrado. Ver docs/design-system.md.
export default function RutasPage() {
  const router = useRouter();
  const [usuario, setUsuario] = useState<UsuarioShell | null>(null);
  const [equipo, setEquipo] = useState<Usuario[]>([]);
  const [rutasGuardadas, setRutasGuardadas] = useState<RutaPlanificada[]>([]);
  const [responsableId, setResponsableId] = useState("");
  const [fecha, setFecha] = useState(() => new Date().toISOString().slice(0, 10));
  const [paradas, setParadas] = useState<Parada[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        router.replace("/login");
        return;
      }
      const [resMe, resUsuarios, resRutas] = await Promise.all([
        apiFetch("/api/me"),
        apiFetch("/api/usuarios"),
        apiFetch("/api/rutas-planificadas"),
      ]);
      if (resMe.ok) {
        const { usuario: u } = await resMe.json();
        if (u) setUsuario({ nombre: u.nombre, rol: u.rol, empresaNombre: u.empresa?.nombre ?? "", empresaLogoUrl: u.empresa?.logo_url ?? null, colorPrimario: u.empresa?.color_primario ?? null, colorPrimarioForeground: u.empresa?.color_primario_foreground ?? null, colorSecundario: u.empresa?.color_secundario ?? null, fuente: u.empresa?.fuente ?? null, moneda: u.empresa?.moneda ?? "CLP" });
      }
      if (resUsuarios.ok) {
        const lista: Usuario[] = await resUsuarios.json();
        setEquipo(lista);
        if (lista.length > 0) setResponsableId(lista[0].id);
      }
      if (resRutas.ok) setRutasGuardadas(await resRutas.json());
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!responsableId || !fecha) return;
    (async () => {
      setCargando(true);
      setError(null);
      const res = await apiFetch(
        `/api/rutas?responsable_id=${encodeURIComponent(responsableId)}&fecha=${fecha}`
      );
      setCargando(false);
      if (!res.ok) {
        setError("No se pudo cargar la ruta");
        return;
      }
      const body = await res.json();
      setParadas(body.paradas);
    })();
  }, [responsableId, fecha]);

  if (!usuario) return null;

  const conCoords = (paradas ?? []).filter((p) => p.lat != null && p.lng != null);
  const sinCoords = (paradas ?? []).filter((p) => p.lat == null || p.lng == null);

  return (
    <DashboardShell usuario={usuario}>
      <div className="mb-ds-6 flex flex-wrap items-center justify-between gap-ds-3">
        <p className="ds-heading flex items-center gap-ds-2 text-ds-h2 text-ds-text">
          <RouteIcon size={24} strokeWidth={2.75} className="text-ds-brand" />
          Rutas
        </p>
        <Link href="/dashboard/rutas/nueva">
          <Button>Nueva ruta</Button>
        </Link>
      </div>

      {rutasGuardadas.length > 0 && (
        <div className="mb-ds-6">
          <Table<RutaPlanificada>
            filas={rutasGuardadas}
            claveFila={(r) => r.id}
            vacio={{ titulo: "Sin rutas guardadas" }}
            columnas={[
              {
                encabezado: "Ruta",
                celda: (r) => (
                  <Link href={`/dashboard/rutas/${r.id}`} className="font-medium text-ds-brand hover:underline">
                    {r.nombre || equipo.find((u) => u.id === r.responsable_id)?.nombre || "Ruta"}
                  </Link>
                ),
              },
              { encabezado: "Fecha", celda: (r) => r.fecha_inicio },
              {
                encabezado: "Estado",
                celda: (r) => <StatusBadge estado={r.estado} tonoForzado={r.estado === "finalizada" ? "completado" : "en_progreso"} />,
              },
            ]}
          />
        </div>
      )}

      <div className="mb-ds-6 flex flex-col gap-ds-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="font-ds-body text-ds-small font-semibold text-ds-text">Vista rápida del día</p>
          <p className="mt-ds-1 font-ds-body text-ds-small text-ds-text/70">
            Trabajos del día de un responsable, en el orden que quedaron registrados.
          </p>
        </div>
        <div className="flex gap-ds-3">
          <Select
            etiqueta="Responsable"
            valor={responsableId}
            onCambio={setResponsableId}
            opciones={equipo.map((u) => ({ valor: u.id, etiqueta: u.nombre }))}
          />
          <DatePicker etiqueta="Fecha" valor={aFecha(fecha)} onCambio={(f) => setFecha(aTexto(f))} />
        </div>
      </div>

      {error ? <ErrorState mensaje={error} /> : null}
      {cargando ? <LoadingState /> : null}

      {paradas && paradas.length === 0 && <EmptyState titulo="No hay trabajos para esta fecha" icono={<MapPin size={28} strokeWidth={2.75} />} />}

      {paradas && paradas.length > 0 && (
        <div className="grid gap-ds-6 lg:grid-cols-[1fr_20rem]">
          <MapaRutas paradas={paradas} />

          <Card sinRelleno>
            <div className="flex flex-col divide-y divide-ds-divider">
              {conCoords.map((p, i) => (
                <div key={p.trabajo_id} className="flex items-start gap-ds-3 p-ds-4">
                  <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-ds-pill bg-ds-brand text-xs font-semibold text-ds-brand-foreground">
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-ds-body font-medium text-ds-text">{p.cliente_nombre}</p>
                    <p className="truncate font-ds-body text-ds-caption text-ds-text/60">{p.direccion}</p>
                    <a
                      href={wazeUrl(p.lat!, p.lng!)}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-ds-1 inline-block font-ds-body text-ds-caption font-medium text-ds-brand hover:underline"
                    >
                      Abrir en Waze →
                    </a>
                  </div>
                </div>
              ))}
              {sinCoords.map((p) => (
                <div key={p.trabajo_id} className="p-ds-4">
                  <p className="font-ds-body font-medium text-ds-text">{p.cliente_nombre}</p>
                  <p className="font-ds-body text-ds-caption text-ds-text/60">
                    {p.direccion || "Sin dirección"} — sin coordenadas, no aparece en el mapa
                  </p>
                </div>
              ))}
            </div>
            {conCoords.length > 1 && (
              <div className="border-t border-ds-divider p-ds-4">
                <a href={googleMapsRutaCompleta(conCoords)} target="_blank" rel="noreferrer" className="block">
                  <Button variante="secundario" bloque>
                    Ver ruta completa en Google Maps
                  </Button>
                </a>
              </div>
            )}
          </Card>
        </div>
      )}
    </DashboardShell>
  );
}
