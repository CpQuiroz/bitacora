"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { OrdenServicio, Trabajo } from "@bitacora/shared";
import { supabase } from "@/lib/supabase";
import { apiFetch } from "@/lib/api";
import { DashboardShell, type UsuarioShell } from "@/components/DashboardShell";
import { Badge, Card, ErrorText, buttonClass } from "@/components/ui";
import { IconCalendar, IconChevronLeft, IconChevronRight, IconPlus } from "@/components/icons";

type OrdenListado = Trabajo & {
  cliente_info: { nombre: string } | null;
  responsable: { nombre: string } | null;
  orden: OrdenServicio | null;
};

type EstadoAgenda = "agendado" | "en_progreso" | "completado" | "cancelado";

const ESTADOS_AGENDA: { valor: EstadoAgenda; etiqueta: string; clase: string }[] = [
  { valor: "agendado", etiqueta: "Agendado", clase: "bg-brand-soft text-brand" },
  { valor: "en_progreso", etiqueta: "En progreso", clase: "bg-warning-soft text-warning" },
  { valor: "completado", etiqueta: "Completado", clase: "bg-success-soft text-success" },
  { valor: "cancelado", etiqueta: "Cancelado", clase: "bg-danger-soft text-danger" },
];

// Estado "de agenda" derivado — no es una columna propia, se calcula a
// partir de trabajos.estado + ordenes_servicio.estado_os, que ya cubren
// exactamente esta semántica (evita duplicar un enum nuevo en la DB).
function estadoAgendaDe(t: OrdenListado): EstadoAgenda {
  if (t.estado === "cancelado") return "cancelado";
  if (t.orden?.estado_os === "en_proceso") return "en_progreso";
  if (t.estado === "completado" || t.orden?.estado_os === "completada" || t.orden?.estado_os === "firmada") {
    return "completado";
  }
  return "agendado";
}

// Evita el desfase de un día que da toISOString() (usa UTC) al convertir
// un Date local a "YYYY-MM-DD" — clave para no dibujar la OS en el día
// equivocado del calendario.
function fmtLocal(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function fechaDesdeString(fecha: string): Date {
  return new Date(`${fecha}T00:00:00`);
}

const NOMBRES_MES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];
const NOMBRES_DIA_CORTOS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

export default function AgendaPage() {
  const router = useRouter();
  const [usuario, setUsuario] = useState<UsuarioShell | null>(null);
  const [vista, setVista] = useState<"mes" | "dia">("mes");
  const [fechaActual, setFechaActual] = useState(() => new Date());
  const [ordenes, setOrdenes] = useState<OrdenListado[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filtros, setFiltros] = useState<Set<EstadoAgenda>>(new Set());
  const [diaSeleccionado, setDiaSeleccionado] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setError(null);
    const primerDia = new Date(fechaActual.getFullYear(), fechaActual.getMonth(), 1);
    const ultimoDia = new Date(fechaActual.getFullYear(), fechaActual.getMonth() + 1, 0);
    const params = new URLSearchParams({ desde: fmtLocal(primerDia), hasta: fmtLocal(ultimoDia) });
    const res = await apiFetch(`/api/ordenes-servicio?${params.toString()}`);
    if (!res.ok) {
      setError("No se pudieron cargar las órdenes de servicio");
      return;
    }
    setOrdenes(await res.json());
  }, [fechaActual]);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        router.replace("/login");
        return;
      }
      const res = await apiFetch("/api/me");
      if (res.ok) {
        const { usuario: u } = await res.json();
        if (u) {
          setUsuario({
            nombre: u.nombre,
            rol: u.rol,
            empresaNombre: u.empresa?.nombre ?? "",
            empresaLogoUrl: u.empresa?.logo_url ?? null,
            colorPrimario: u.empresa?.color_primario ?? null,
            colorPrimarioForeground: u.empresa?.color_primario_foreground ?? null,
            moneda: u.empresa?.moneda ?? "CLP",
          });
        }
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const ordenesFiltradas = useMemo(() => {
    if (!ordenes) return [];
    if (filtros.size === 0) return ordenes;
    return ordenes.filter((o) => filtros.has(estadoAgendaDe(o)));
  }, [ordenes, filtros]);

  const ordenesPorDia = useMemo(() => {
    const mapa = new Map<string, OrdenListado[]>();
    for (const o of ordenesFiltradas) {
      const lista = mapa.get(o.fecha) ?? [];
      lista.push(o);
      mapa.set(o.fecha, lista);
    }
    for (const lista of mapa.values()) {
      lista.sort((a, b) => (a.hora_programada ?? "").localeCompare(b.hora_programada ?? ""));
    }
    return mapa;
  }, [ordenesFiltradas]);

  function alternarFiltro(estado: EstadoAgenda) {
    setFiltros((prev) => {
      const next = new Set(prev);
      if (next.has(estado)) next.delete(estado);
      else next.add(estado);
      return next;
    });
  }

  function irMes(delta: number) {
    setFechaActual((prev) => new Date(prev.getFullYear(), prev.getMonth() + delta, 1));
    setDiaSeleccionado(null);
  }
  function irDia(delta: number) {
    setFechaActual((prev) => {
      const next = new Date(prev);
      next.setDate(next.getDate() + delta);
      return next;
    });
  }

  if (!usuario) return null;

  const hoy = fmtLocal(new Date());

  const primerDiaMes = new Date(fechaActual.getFullYear(), fechaActual.getMonth(), 1);
  const offsetInicio = primerDiaMes.getDay();
  const diasEnMes = new Date(fechaActual.getFullYear(), fechaActual.getMonth() + 1, 0).getDate();
  const celdas: (Date | null)[] = [
    ...Array(offsetInicio).fill(null),
    ...Array.from({ length: diasEnMes }, (_, i) => new Date(fechaActual.getFullYear(), fechaActual.getMonth(), i + 1)),
  ];
  while (celdas.length % 7 !== 0) celdas.push(null);

  const tituloMes = `${NOMBRES_MES[fechaActual.getMonth()]} ${fechaActual.getFullYear()}`;
  const tituloDia = `${fechaActual.getDate()} de ${NOMBRES_MES[fechaActual.getMonth()]}, ${fechaActual.getFullYear()}`;

  const ordenesDiaSeleccionado = diaSeleccionado ? ordenesPorDia.get(diaSeleccionado) ?? [] : [];
  const ordenesDelDiaVista = vista === "dia" ? ordenesPorDia.get(fmtLocal(fechaActual)) ?? [] : [];

  return (
    <DashboardShell usuario={usuario}>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight text-foreground">
          <IconCalendar className="h-6 w-6 text-brand" />
          Agenda
        </h1>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border border-border p-0.5">
            <button
              type="button"
              onClick={() => setVista("mes")}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                vista === "mes" ? "bg-brand-soft text-brand" : "text-muted"
              }`}
            >
              Mes
            </button>
            <button
              type="button"
              onClick={() => setVista("dia")}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                vista === "dia" ? "bg-brand-soft text-brand" : "text-muted"
              }`}
            >
              Día
            </button>
          </div>
          <Link href="/dashboard/ordenes/nueva" className={buttonClass("primary")}>
            <IconPlus className="h-4 w-4" />
            Nueva OS
          </Link>
        </div>
      </div>

      <Card className="mb-6">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          {ESTADOS_AGENDA.map((e) => (
            <button
              key={e.valor}
              type="button"
              onClick={() => alternarFiltro(e.valor)}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                filtros.has(e.valor) ? `${e.clase} border-transparent` : "border-border text-muted hover:bg-brand-soft"
              }`}
            >
              {e.etiqueta}
            </button>
          ))}
          {filtros.size > 0 && (
            <button type="button" onClick={() => setFiltros(new Set())} className="text-xs font-medium text-muted hover:text-brand">
              Limpiar
            </button>
          )}
        </div>

        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => (vista === "mes" ? irMes(-1) : irDia(-1))}
            className="rounded-lg p-2 text-muted transition-colors hover:bg-brand-soft hover:text-brand"
          >
            <IconChevronLeft className="h-4 w-4" />
          </button>
          <h2 className="text-sm font-semibold capitalize text-foreground">{vista === "mes" ? tituloMes : tituloDia}</h2>
          <button
            type="button"
            onClick={() => (vista === "mes" ? irMes(1) : irDia(1))}
            className="rounded-lg p-2 text-muted transition-colors hover:bg-brand-soft hover:text-brand"
          >
            <IconChevronRight className="h-4 w-4" />
          </button>
        </div>
      </Card>

      {error && (
        <div className="mb-6">
          <ErrorText>{error}</ErrorText>
        </div>
      )}

      {vista === "mes" ? (
        <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
          <Card className="overflow-hidden p-0">
            <div className="grid grid-cols-7 border-b border-border text-center text-xs font-medium text-muted">
              {NOMBRES_DIA_CORTOS.map((d) => (
                <div key={d} className="py-2">
                  {d}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7">
              {celdas.map((dia, i) => {
                if (!dia) return <div key={i} className="min-h-[6.5rem] border-b border-r border-border last:border-r-0" />;
                const clave = fmtLocal(dia);
                const esHoy = clave === hoy;
                const ordenesDia = ordenesPorDia.get(clave) ?? [];
                const seleccionado = diaSeleccionado === clave;
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setDiaSeleccionado(seleccionado ? null : clave)}
                    className={`flex min-h-[6.5rem] flex-col items-stretch gap-1 border-b border-r border-border p-1.5 text-left transition-colors last:border-r-0 hover:bg-brand-soft/40 ${
                      seleccionado ? "bg-brand-soft/60" : ""
                    }`}
                  >
                    <span
                      className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium ${
                        esHoy ? "bg-brand text-brand-foreground" : "text-foreground"
                      }`}
                    >
                      {dia.getDate()}
                    </span>
                    <div className="flex flex-col gap-1">
                      {ordenesDia.slice(0, 2).map((o) => {
                        const est = ESTADOS_AGENDA.find((e) => e.valor === estadoAgendaDe(o))!;
                        return (
                          <span key={o.id} className={`truncate rounded px-1.5 py-0.5 text-[11px] font-medium ${est.clase}`}>
                            {o.hora_programada ? `${o.hora_programada} ` : ""}
                            {o.cliente_info?.nombre ?? o.cliente}
                          </span>
                        );
                      })}
                      {ordenesDia.length > 2 && (
                        <span className="text-[11px] font-medium text-muted">+{ordenesDia.length - 2} más</span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </Card>

          <Card>
            {diaSeleccionado ? (
              <>
                <h3 className="mb-3 text-sm font-semibold capitalize text-foreground">
                  {fechaDesdeString(diaSeleccionado).toLocaleDateString("es-CL", {
                    weekday: "long",
                    day: "numeric",
                    month: "long",
                  })}
                </h3>
                {ordenesDiaSeleccionado.length === 0 ? (
                  <p className="text-sm text-muted">Sin OS agendadas este día.</p>
                ) : (
                  <div className="flex flex-col divide-y divide-border">
                    {ordenesDiaSeleccionado.map((o) => (
                      <button
                        key={o.id}
                        type="button"
                        onClick={() => router.push(`/dashboard/ordenes/${o.id}`)}
                        className="flex items-center justify-between gap-2 py-2.5 text-left hover:text-brand"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-foreground">{o.cliente_info?.nombre ?? o.cliente}</p>
                          <p className="text-xs text-muted">
                            {o.hora_programada ?? "Sin hora"} · {o.responsable?.nombre ?? "—"}
                          </p>
                        </div>
                        <Badge value={estadoAgendaDe(o)} />
                      </button>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <p className="text-sm text-muted">Haz clic en un día para ver el detalle completo.</p>
            )}
          </Card>
        </div>
      ) : (
        <Card>
          {ordenesDelDiaVista.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-16 text-center">
              <IconCalendar className="h-8 w-8 text-muted" />
              <p className="text-sm text-muted">Sin OS agendadas este día.</p>
            </div>
          ) : (
            <div className="flex flex-col divide-y divide-border">
              {ordenesDelDiaVista.map((o) => (
                <button
                  key={o.id}
                  type="button"
                  onClick={() => router.push(`/dashboard/ordenes/${o.id}`)}
                  className="flex items-center justify-between gap-3 py-3 text-left hover:text-brand"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium text-foreground">{o.cliente_info?.nombre ?? o.cliente}</p>
                    <p className="text-xs text-muted">
                      {o.hora_programada ?? "Sin hora"} · {o.responsable?.nombre ?? "—"}
                      {o.descripcion ? ` · ${o.descripcion}` : ""}
                    </p>
                  </div>
                  <Badge value={estadoAgendaDe(o)} />
                </button>
              ))}
            </div>
          )}
        </Card>
      )}
    </DashboardShell>
  );
}
