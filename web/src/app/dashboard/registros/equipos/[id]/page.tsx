"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ChevronLeft, ClipboardCheck, Plus, Wrench } from "lucide-react";
import type { Equipo, OrdenServicio, PlanMantencion, Trabajo } from "@bitacora/shared";
import { estadoOsDeTrabajo } from "@bitacora/shared";
import { supabase } from "@/lib/supabase";
import { apiFetch } from "@/lib/api";
import { DashboardShell, type UsuarioShell } from "@/components/DashboardShell";
import { Button, Card, EmptyState, Input, StatusBadge, Textarea } from "@bitacora/ui/web";
import { RegistrosMantencion } from "./RegistrosMantencion";

type TrabajoConOrden = Trabajo & { orden: Pick<OrdenServicio, "folio" | "estado_os"> | null };
type EquipoDetalle = Equipo & {
  cliente: { id: string; nombre: string } | null;
  asignacion_vigente: { colaborador_id: string; colaborador_nombre: string } | null;
  historico_mantenciones: TrabajoConOrden[];
};

type Tab = "datos" | "plan" | "historico_os" | "mantencion";

// PASO 6 (sistema de diseño) — migrado. Ver docs/design-system.md.
export default function EquipoDetallePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [usuario, setUsuario] = useState<UsuarioShell | null>(null);
  const [rol, setRol] = useState<string | null>(null);
  const [equipo, setEquipo] = useState<EquipoDetalle | null>(null);
  const [planes, setPlanes] = useState<PlanMantencion[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("datos");

  const [formPlanAbierto, setFormPlanAbierto] = useState(false);
  const [frecuenciaDias, setFrecuenciaDias] = useState("90");
  const [proximaFecha, setProximaFecha] = useState("");
  const [notasPlan, setNotasPlan] = useState("");
  const [guardandoPlan, setGuardandoPlan] = useState(false);
  const [errorPlan, setErrorPlan] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      router.replace("/login");
      return;
    }
    const [resMe, resEquipo, resPlanes] = await Promise.all([
      apiFetch("/api/me"),
      apiFetch(`/api/equipos/${params.id}`),
      apiFetch(`/api/planes-mantencion?equipo_id=${params.id}`),
    ]);
    if (resMe.ok) {
      const cuerpoMe = await resMe.json();
      const u = cuerpoMe.usuario;
      if (u) {
        setRol(u.rol);
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
    }
    if (!resEquipo.ok) {
      setError("No se pudo cargar el equipo");
      return;
    }
    setEquipo(await resEquipo.json());
    if (resPlanes.ok) setPlanes(await resPlanes.json());
  }, [params.id, router]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const esVehiculo = equipo?.categoria === "Vehículo";
  const puedeGestionar = rol === "admin" || rol === "supervisor";

  const tabs = useMemo<{ id: Tab; label: string }[]>(
    () => [
      { id: "datos", label: "Datos básicos" },
      { id: "plan", label: "Plan de mantención" },
      { id: "historico_os", label: "Histórico de OS" },
      ...(esVehiculo ? ([{ id: "mantencion" as Tab, label: "Mantención" }]) : []),
    ],
    [esVehiculo]
  );

  function abrirFormPlan() {
    setFrecuenciaDias("90");
    setProximaFecha(new Date().toISOString().slice(0, 10));
    setNotasPlan("");
    setErrorPlan(null);
    setFormPlanAbierto(true);
  }

  async function onCrearPlan(e: FormEvent) {
    e.preventDefault();
    setErrorPlan(null);
    setGuardandoPlan(true);
    const res = await apiFetch("/api/planes-mantencion", {
      method: "POST",
      body: JSON.stringify({ equipo_id: params.id, frecuencia_dias: Number(frecuenciaDias), proxima_fecha: proximaFecha, notas: notasPlan || null }),
    });
    setGuardandoPlan(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setErrorPlan(body.error ?? "No se pudo crear el plan");
      return;
    }
    setFormPlanAbierto(false);
    setAviso("Plan de mantención creado.");
    cargar();
  }

  async function onAlternarPlan(plan: PlanMantencion) {
    const res = await apiFetch(`/api/planes-mantencion/${plan.id}`, { method: "PATCH", body: JSON.stringify({ activo: !plan.activo }) });
    if (res.ok) cargar();
  }

  async function onEliminarPlan(plan: PlanMantencion) {
    if (!confirm("¿Eliminar este plan de mantención?")) return;
    const res = await apiFetch(`/api/planes-mantencion/${plan.id}`, { method: "DELETE" });
    if (res.ok) cargar();
  }

  if (!usuario) return null;
  if (error) {
    return (
      <DashboardShell usuario={usuario}>
        <p className="font-ds-body text-ds-small text-ds-accent-700">{error}</p>
      </DashboardShell>
    );
  }
  if (!equipo) return null;

  return (
    <DashboardShell usuario={usuario}>
      <Link href="/dashboard/registros/equipos" className="mb-ds-4 inline-flex items-center gap-ds-1 font-ds-body text-ds-small font-medium text-ds-brand hover:underline">
        <ChevronLeft size={16} strokeWidth={2.75} />
        Equipos
      </Link>

      <div className="flex flex-wrap items-center justify-between gap-ds-3">
        <div>
          <p className="ds-heading text-ds-h2 text-ds-text">{equipo.nombre}</p>
          <p className="mt-ds-1 font-ds-body text-ds-small text-ds-text/70">{[equipo.marca, equipo.modelo].filter(Boolean).join(" ") || equipo.categoria || "—"}</p>
        </div>
        <StatusBadge estado={equipo.activo ? "activo" : "inactivo"} />
      </div>

      {aviso ? <p className="mt-ds-6 font-ds-body text-ds-small font-medium text-ds-accent2-800">{aviso}</p> : null}

      <nav className="mt-ds-6 flex gap-ds-1 overflow-x-auto border-b border-ds-divider" aria-label="Secciones del equipo">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            aria-current={tab === t.id ? "page" : undefined}
            className={`-mb-px whitespace-nowrap border-b-2 px-ds-3 py-2.5 font-ds-body text-ds-small font-semibold transition-colors ${
              tab === t.id ? "border-ds-brand text-ds-brand" : "border-transparent text-ds-text/60 hover:text-ds-text"
            }`}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {tab === "datos" && (
        <div className="mt-ds-6">
          <Card>
            <p className="mb-ds-4 font-ds-body text-ds-small font-semibold text-ds-text">Datos del equipo</p>
            <div className="grid gap-ds-4 font-ds-body text-ds-small sm:grid-cols-3">
              <div>
                <p className="text-ds-caption text-ds-text/60">Cliente</p>
                <p className="text-ds-text">{equipo.cliente?.nombre ?? "Propio de la empresa"}</p>
              </div>
              <div>
                <p className="text-ds-caption text-ds-text/60">Categoría</p>
                <p className="text-ds-text">{equipo.categoria ?? "—"}</p>
              </div>
              <div>
                <p className="text-ds-caption text-ds-text/60">N° de serie</p>
                <p className="text-ds-text">{equipo.numero_serie ?? "—"}</p>
              </div>
              {esVehiculo && (
                <>
                  <div>
                    <p className="text-ds-caption text-ds-text/60">Patente</p>
                    <p className="font-mono text-ds-text">{equipo.patente ?? "—"}</p>
                  </div>
                  <div>
                    <p className="text-ds-caption text-ds-text/60">Asignado a</p>
                    <p className="text-ds-text">{equipo.asignacion_vigente?.colaborador_nombre ?? "Sin asignar"}</p>
                  </div>
                </>
              )}
              <div>
                <p className="text-ds-caption text-ds-text/60">Vencimiento de garantía</p>
                <p className="font-mono text-ds-text">{equipo.garantia_vencimiento ?? "—"}</p>
              </div>
            </div>
            <p className="mt-ds-4 font-ds-body text-ds-caption text-ds-text/60">
              Para editar estos datos, hacelo desde el{" "}
              <Link href="/dashboard/registros/equipos" className="font-medium text-ds-brand hover:underline">
                listado de Equipos
              </Link>
              .
            </p>
          </Card>
        </div>
      )}

      {tab === "plan" && (
        <div className="mt-ds-6">
          <Card>
            <div className="mb-ds-4 flex items-center justify-between">
              <p className="font-ds-body text-ds-small font-semibold text-ds-text">Plan de Mantención Preventiva</p>
              <Button variante="secundario" iconoIzq={<Plus size={16} strokeWidth={2.75} />} onPress={() => (formPlanAbierto ? setFormPlanAbierto(false) : abrirFormPlan())}>
                Nuevo plan
              </Button>
            </div>

            {formPlanAbierto && (
              <form onSubmit={onCrearPlan} className="mb-ds-4 flex flex-col gap-ds-3 rounded-ds-md border border-ds-divider p-ds-3">
                <div className="grid gap-ds-3 sm:grid-cols-2">
                  <Input etiqueta="Frecuencia (días)" tipo="numero" requerido valor={frecuenciaDias} onCambio={setFrecuenciaDias} />
                  <FechaCampo etiqueta="Próxima fecha" requerido valor={proximaFecha} onCambio={setProximaFecha} />
                </div>
                <Textarea etiqueta="Notas (opcional)" filas={2} valor={notasPlan} onCambio={setNotasPlan} />
                {errorPlan ? <p className="font-ds-body text-ds-small text-ds-accent-700">{errorPlan}</p> : null}
                <div>
                  <Button tipo="submit" cargando={guardandoPlan}>
                    Crear plan
                  </Button>
                </div>
              </form>
            )}

            {planes.length === 0 ? (
              <p className="font-ds-body text-ds-small text-ds-text/70">Sin plan de mantención registrado.</p>
            ) : (
              <div className="flex flex-col divide-y divide-ds-divider">
                {planes.map((p) => (
                  <div key={p.id} className="flex items-center justify-between py-2.5 font-ds-body text-ds-small">
                    <div>
                      <p className="font-medium text-ds-text">
                        Cada {p.frecuencia_dias} días — próxima: <span className="font-mono">{p.proxima_fecha}</span>
                      </p>
                      {p.notas && <p className="font-ds-body text-ds-caption text-ds-text/60">{p.notas}</p>}
                    </div>
                    <div className="flex items-center gap-ds-2">
                      <StatusBadge estado={p.activo ? "activo" : "inactivo"} />
                      <Button variante="ghost" onPress={() => onAlternarPlan(p)}>
                        {p.activo ? "Desactivar" : "Activar"}
                      </Button>
                      <Button variante="ghost" onPress={() => onEliminarPlan(p)}>
                        Eliminar
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      )}

      {tab === "historico_os" && (
        <div className="mt-ds-6">
          <Card>
            <p className="mb-ds-4 font-ds-body text-ds-small font-semibold text-ds-text">Histórico de OS</p>
            {equipo.historico_mantenciones.length === 0 ? (
              <EmptyState icono={<Wrench size={28} strokeWidth={2.75} />} titulo="Sin órdenes de servicio asociadas a este equipo todavía" />
            ) : (
              <div className="flex flex-col divide-y divide-ds-divider">
                {equipo.historico_mantenciones.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => router.push(`/dashboard/ordenes/${t.id}`)}
                    className="flex items-center justify-between py-2.5 text-left font-ds-body text-ds-small hover:text-ds-brand"
                  >
                    <div className="flex items-center gap-ds-2">
                      <ClipboardCheck size={14} strokeWidth={2.75} className="shrink-0 text-ds-text/60" />
                      <div>
                        <p className="font-medium text-ds-text">{t.orden?.folio != null ? `OS N° ${t.orden.folio}` : t.descripcion || "Sin folio"}</p>
                        <p className="font-mono text-ds-caption text-ds-text/60">{t.fecha}</p>
                      </div>
                    </div>
                    <StatusBadge estado={t.orden?.estado_os ?? estadoOsDeTrabajo(t.estado)} />
                  </button>
                ))}
              </div>
            )}
          </Card>
        </div>
      )}

      {tab === "mantencion" && esVehiculo && (
        <div className="mt-ds-6">
          <RegistrosMantencion equipo={equipo} puedeGestionar={puedeGestionar} />
        </div>
      )}
    </DashboardShell>
  );
}

// Input nativo type="date" — ver el mismo helper en rutas/nueva/page.tsx.
function FechaCampo({ etiqueta, valor, onCambio, requerido }: { etiqueta: string; valor: string; onCambio: (v: string) => void; requerido?: boolean }) {
  return (
    <div className="flex flex-col gap-ds-1">
      <label className="font-ds-body text-ds-caption font-medium text-ds-text/70">{etiqueta}</label>
      <input
        type="date"
        required={requerido}
        value={valor}
        onChange={(e) => onCambio(e.target.value)}
        className="h-11 w-full rounded-ds-md border border-ds-divider bg-ds-surface px-ds-3 font-ds-body text-ds-body text-ds-text transition-colors hover:border-ds-text/30 focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ds-brand)]"
      />
    </div>
  );
}
