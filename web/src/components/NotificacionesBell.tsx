"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Notificacion } from "@bitacora/shared";
import { apiFetch } from "@/lib/api";
import { IconBell } from "./icons";

const RUTA_POR_ENTIDAD: Record<string, (id: string) => string> = {
  trabajo: (id) => `/dashboard/trabajos/${id}`,
  factura: () => `/dashboard/financiero/cobros`,
  ruta: () => `/dashboard/rutas`,
  usuario: () => `/dashboard/equipo`,
  cotizacion: (id) => `/dashboard/financiero/cotizaciones/${id}`,
  tarea: () => `/dashboard/agenda`,
};

function tiempoRelativo(iso: string) {
  const ms = Date.now() - new Date(iso).getTime();
  const min = Math.floor(ms / 60000);
  if (min < 1) return "recién";
  if (min < 60) return `hace ${min} min`;
  const horas = Math.floor(min / 60);
  if (horas < 24) return `hace ${horas} h`;
  const dias = Math.floor(horas / 24);
  return `hace ${dias} d`;
}

export function NotificacionesBell() {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [cargado, setCargado] = useState(false);
  const [notificaciones, setNotificaciones] = useState<Notificacion[]>([]);
  const ref = useRef<HTMLDivElement>(null);

  const noLeidas = notificaciones.filter((n) => !n.leido).length;

  async function cargar() {
    const res = await apiFetch("/api/notificaciones-feed");
    if (res.ok) setNotificaciones(await res.json());
    setCargado(true);
  }

  // Refresca el contador cada 60s sin necesidad de abrir el panel, para
  // que la campana no quede muda mientras la pestaña está abierta.
  useEffect(() => {
    cargar();
    const id = setInterval(cargar, 60000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    function onClickFuera(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setAbierto(false);
    }
    document.addEventListener("mousedown", onClickFuera);
    return () => document.removeEventListener("mousedown", onClickFuera);
  }, []);

  async function alAbrir() {
    setAbierto((v) => !v);
    if (!cargado) await cargar();
  }

  async function marcarLeida(n: Notificacion) {
    if (!n.leido) {
      setNotificaciones((prev) => prev.map((x) => (x.id === n.id ? { ...x, leido: true } : x)));
      apiFetch(`/api/notificaciones-feed/${n.id}`, { method: "PATCH", body: JSON.stringify({ leido: true }) });
    }
    setAbierto(false);
    if (n.entidad_tipo && n.entidad_id) {
      router.push(RUTA_POR_ENTIDAD[n.entidad_tipo]?.(n.entidad_id) ?? "/dashboard");
    }
  }

  async function marcarTodas() {
    setNotificaciones((prev) => prev.map((x) => ({ ...x, leido: true })));
    await apiFetch("/api/notificaciones-feed/marcar-todas", { method: "POST" });
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={alAbrir}
        className="relative inline-flex h-9 w-9 items-center justify-center rounded-lg text-muted hover:bg-brand-soft hover:text-brand"
      >
        <IconBell className="h-5 w-5" />
        {noLeidas > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-semibold text-white">
            {noLeidas > 9 ? "9+" : noLeidas}
          </span>
        )}
      </button>

      {abierto && (
        <div className="absolute right-0 top-full mt-2 w-80 overflow-hidden rounded-lg border border-border bg-surface shadow-lg">
          <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
            <span className="text-sm font-semibold text-foreground">Notificaciones</span>
            {noLeidas > 0 && (
              <button type="button" onClick={marcarTodas} className="text-xs font-medium text-brand hover:underline">
                Marcar todas leídas
              </button>
            )}
          </div>
          <div className="max-h-96 overflow-y-auto">
            {notificaciones.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-muted">No tienes notificaciones</p>
            ) : (
              notificaciones.map((n) => (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => marcarLeida(n)}
                  className={`flex w-full flex-col gap-0.5 border-b border-border px-4 py-2.5 text-left transition-colors last:border-b-0 hover:bg-brand-soft ${
                    n.leido ? "" : "bg-brand-soft/40"
                  }`}
                >
                  <span className="flex items-center gap-2 text-sm font-medium text-foreground">
                    {!n.leido && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-brand" />}
                    {n.titulo}
                  </span>
                  {n.cuerpo && <span className="text-xs text-muted">{n.cuerpo}</span>}
                  <span className="text-[11px] text-muted">{tiempoRelativo(n.creado_en)}</span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
