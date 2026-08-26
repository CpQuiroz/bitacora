"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { Usuario } from "@bitacora/shared";
import { supabase } from "@/lib/supabase";
import { apiFetch } from "@/lib/api";
import { DashboardShell, type UsuarioShell } from "@/components/DashboardShell";
import { Card, ErrorText, Label, Select, buttonClass } from "@/components/ui";
import { IconMapPin, IconRoute } from "@/components/icons";
import { MapaRutas, type Parada } from "@/components/MapaRutas";

function wazeUrl(lat: number, lng: number) {
  return `https://waze.com/ul?ll=${lat},${lng}&navigate=yes`;
}

function googleMapsRutaCompleta(paradas: Parada[]) {
  const puntos = paradas.filter((p) => p.lat != null && p.lng != null);
  const ruta = puntos.map((p) => `${p.lat},${p.lng}`).join("/");
  return `https://www.google.com/maps/dir/${ruta}`;
}

export default function RutasPage() {
  const router = useRouter();
  const [usuario, setUsuario] = useState<UsuarioShell | null>(null);
  const [equipo, setEquipo] = useState<Usuario[]>([]);
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
      const [resMe, resUsuarios] = await Promise.all([apiFetch("/api/me"), apiFetch("/api/usuarios")]);
      if (resMe.ok) {
        const { usuario: u } = await resMe.json();
        if (u) setUsuario({ nombre: u.nombre, rol: u.rol, empresaNombre: u.empresa?.nombre ?? "", empresaLogoUrl: u.empresa?.logo_url ?? null });
      }
      if (resUsuarios.ok) {
        const lista: Usuario[] = await resUsuarios.json();
        setEquipo(lista);
        if (lista.length > 0) setResponsableId(lista[0].id);
      }
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
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight text-foreground">
            <IconRoute className="h-6 w-6 text-brand" />
            Planificación de rutas
          </h1>
          <p className="mt-1 text-sm text-muted">
            Trabajos del día de un responsable, en el orden que quedaron registrados.
          </p>
        </div>
        <div className="flex gap-3">
          <div>
            <Label>Responsable</Label>
            <Select value={responsableId} onChange={(e) => setResponsableId(e.target.value)}>
              {equipo.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.nombre}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label>Fecha</Label>
            <input
              type="date"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              className="w-full rounded-lg border border-border bg-surface px-3.5 py-2.5 text-sm text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
            />
          </div>
        </div>
      </div>

      {error && <ErrorText>{error}</ErrorText>}
      {cargando && <p className="text-sm text-muted">Cargando…</p>}

      {paradas && paradas.length === 0 && (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border py-16 text-center">
          <IconMapPin className="h-8 w-8 text-muted" />
          <p className="text-sm text-muted">No hay trabajos para esta fecha.</p>
        </div>
      )}

      {paradas && paradas.length > 0 && (
        <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
          <MapaRutas paradas={paradas} />

          <Card className="p-0">
            <div className="flex flex-col divide-y divide-border">
              {conCoords.map((p, i) => (
                <div key={p.trabajo_id} className="flex items-start gap-3 p-4">
                  <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand text-xs font-semibold text-brand-foreground">
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-foreground">{p.cliente_nombre}</p>
                    <p className="truncate text-xs text-muted">{p.direccion}</p>
                    <a
                      href={wazeUrl(p.lat!, p.lng!)}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-1 inline-block text-xs font-medium text-brand hover:underline"
                    >
                      Abrir en Waze →
                    </a>
                  </div>
                </div>
              ))}
              {sinCoords.map((p) => (
                <div key={p.trabajo_id} className="p-4">
                  <p className="font-medium text-foreground">{p.cliente_nombre}</p>
                  <p className="text-xs text-muted">
                    {p.direccion || "Sin dirección"} — sin coordenadas, no aparece en el mapa
                  </p>
                </div>
              ))}
            </div>
            {conCoords.length > 1 && (
              <div className="border-t border-border p-4">
                <a
                  href={googleMapsRutaCompleta(conCoords)}
                  target="_blank"
                  rel="noreferrer"
                  className={buttonClass("outline", "w-full")}
                >
                  Ver ruta completa en Google Maps
                </a>
              </div>
            )}
          </Card>
        </div>
      )}
    </DashboardShell>
  );
}
