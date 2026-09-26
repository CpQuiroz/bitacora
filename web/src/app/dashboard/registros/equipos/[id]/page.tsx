"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ChevronLeft, Plus } from "lucide-react";
import type { Equipo, EstadoDocumento, Modulo, PlanMantencion } from "@bitacora/shared";
import { ROLES_SUPERVISION } from "@bitacora/shared";
import { supabase } from "@/lib/supabase";
import { apiFetch } from "@/lib/api";
import { DashboardShell, type UsuarioShell } from "@/components/DashboardShell";
import { Button, Card, Input, StatusBadge, Textarea } from "@bitacora/ui/web";
import { RegistrosMantencion } from "./RegistrosMantencion";
import { EventosFlota } from "./EventosFlota";
import { ActividadDelEquipo, type TrabajoConOrden } from "./ActividadDelEquipo";
import { DocumentoForm } from "@/components/DocumentoForm";

type EquipoDetalle = Equipo & {
  cliente: { id: string; nombre: string } | null;
  asignacion_vigente: { colaborador_id: string; colaborador_nombre: string } | null;
  historico_mantenciones: TrabajoConOrden[];
};

// Tareas 148 y 150 (aprobado por la usuaria, referencia Fleetio): Resumen ·
// Actividad (OS + viajes) · Mantención (plan + registros) · Documentos ·
// Eventos.
type Tab = "resumen" | "actividad" | "mantencion" | "documentos" | "eventos";

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
  // Error al pausar/eliminar un plan (p. ej. 403 sin el módulo Flota en un vehículo).
  const [errorAccion, setErrorAccion] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("resumen");
  const [modulos, setModulos] = useState<Modulo[]>([]);
  const [estadoDocs, setEstadoDocs] = useState<{ vencidos: number; porVencer: number } | null>(null);

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
      if (Array.isArray(cuerpoMe.modulos_visibles)) setModulos(cuerpoMe.modulos_visibles);
      if (u) {
        setRol(u.rol);
        setUsuario({
          nombre: u.nombre,
          rol: u.rol,
          empresaNombre: u.empresa?.nombre ?? "",
          empresaLogoUrl: u.empresa?.logo_url ?? null,
          colorPrimario: u.empresa?.color_primario ?? null,
          tema: u.empresa?.tema ?? "faena",
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
    const eq: EquipoDetalle = await resEquipo.json();
    setEquipo(eq);
    if (resPlanes.ok) setPlanes(await resPlanes.json());
    // Resumen de documentos para el encabezado (solo vehículos y con permiso).
    if (eq.categoria === "Vehículo") {
      const resDocs = await apiFetch(`/api/documentos?entidad_tipo=vehiculo&entidad_id=${eq.id}`);
      if (resDocs.ok) {
        const docs: { estado: EstadoDocumento | null }[] = await resDocs.json();
        setEstadoDocs({ vencidos: docs.filter((d) => d.estado === "vencido").length, porVencer: docs.filter((d) => d.estado === "por_vencer").length });
      }
    }
  }, [params.id, router]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const esVehiculo = equipo?.categoria === "Vehículo";
  const puedeGestionar = ROLES_SUPERVISION.includes(rol ?? "");

  const veViajes = modulos.includes("viajes");
  const veDocumentos = modulos.includes("flota");
  const tabs = useMemo<{ id: Tab; label: string }[]>(
    () => [
      { id: "resumen", label: "Resumen" },
      // Tarea 150: OS y viajes juntos en "Actividad".
      { id: "actividad", label: "Actividad" },
      { id: "mantencion", label: "Mantención" },
      ...(esVehiculo && veDocumentos ? [{ id: "documentos" as Tab, label: "Documentos" }] : []),
      ...(esVehiculo ? [{ id: "eventos" as Tab, label: "Eventos" }] : []),
    ],
    [esVehiculo, veDocumentos]
  );
  // Si la pestaña activa deja de existir (cambian módulos o categoría), volver al resumen.
  useEffect(() => {
    if (!tabs.some((t) => t.id === tab)) setTab("resumen");
  }, [tabs, tab]);
  // Próxima mantención: la fecha más cercana entre los planes activos.
  const proximaMantencion = planes.filter((p) => p.activo).map((p) => p.proxima_fecha).sort()[0] ?? null;

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
    setErrorAccion(null);
    const res = await apiFetch(`/api/planes-mantencion/${plan.id}`, { method: "PATCH", body: JSON.stringify({ activo: !plan.activo }) });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setErrorAccion(body.error ?? "No se pudo actualizar el plan");
      return;
    }
    cargar();
  }

  async function onEliminarPlan(plan: PlanMantencion) {
    if (!confirm("¿Eliminar este plan de mantención?")) return;
    setErrorAccion(null);
    const res = await apiFetch(`/api/planes-mantencion/${plan.id}`, { method: "DELETE" });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setErrorAccion(body.error ?? "No se pudo eliminar el plan");
      return;
    }
    cargar();
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

      <div className="mt-ds-4 flex flex-wrap gap-ds-2 font-ds-body text-ds-caption">
        {esVehiculo && equipo.patente ? <Dato etiqueta="Patente" valor={equipo.patente} mono /> : null}
        {esVehiculo ? <Dato etiqueta="Chofer" valor={equipo.asignacion_vigente?.colaborador_nombre ?? "Sin asignar"} /> : null}
        <Dato etiqueta="Próxima mantención" valor={proximaMantencion ?? "Sin plan"} mono={Boolean(proximaMantencion)} onPress={() => setTab("mantencion")} />
        {estadoDocs ? (
          <Dato
            etiqueta="Documentos"
            valor={estadoDocs.vencidos ? `${estadoDocs.vencidos} vencido${estadoDocs.vencidos > 1 ? "s" : ""}` : estadoDocs.porVencer ? `${estadoDocs.porVencer} por vencer` : "Al día"}
            alerta={estadoDocs.vencidos > 0 ? "peligro" : estadoDocs.porVencer > 0 ? "aviso" : undefined}
            onPress={veDocumentos ? () => setTab("documentos") : undefined}
          />
        ) : null}
      </div>

      {aviso ? <p className="mt-ds-6 font-ds-body text-ds-small font-medium text-ds-accent2-800">{aviso}</p> : null}
      {errorAccion ? <p className="mt-ds-6 font-ds-body text-ds-small text-ds-accent-700">{errorAccion}</p> : null}

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

      {tab === "resumen" && (
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

      {tab === "mantencion" && (
        <div className="mt-ds-6 flex flex-col gap-ds-6">
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
          {esVehiculo ? <RegistrosMantencion equipo={equipo} puedeGestionar={puedeGestionar} /> : null}
        </div>
      )}

      {tab === "actividad" && (
        <div className="mt-ds-6">
          <ActividadDelEquipo
            equipoId={equipo.id}
            os={equipo.historico_mantenciones}
            incluirViajes={Boolean(esVehiculo && veViajes)}
            verMontos={puedeGestionar}
            moneda={usuario.moneda}
          />
        </div>
      )}

      {tab === "documentos" && esVehiculo && veDocumentos && (
        <div className="mt-ds-6">
          <DocumentoForm entidadTipo="vehiculo" entidadId={equipo.id} />
        </div>
      )}

      {tab === "eventos" && esVehiculo && equipo && (
        <div className="mt-ds-6">
          <EventosFlota equipo={equipo} puedeGestionar={puedeGestionar} />
        </div>
      )}
    </DashboardShell>
  );
}

// Dato del encabezado de la ficha (resumen tipo Fleetio). Con onPress lleva a su pestaña.
function Dato({ etiqueta, valor, mono, alerta, onPress }: { etiqueta: string; valor: string; mono?: boolean; alerta?: "peligro" | "aviso"; onPress?: () => void }) {
  const color = alerta === "peligro" ? "text-ds-accent-700" : alerta === "aviso" ? "text-ds-accent-800" : "text-ds-text";
  const contenido = (
    <>
      <span className="text-ds-text/60">{etiqueta}</span>
      <span className={`font-semibold ${color} ${mono ? "font-mono" : ""}`}>{valor}</span>
    </>
  );
  const clase = "inline-flex items-center gap-ds-2 rounded-ds-pill border border-ds-divider bg-ds-surface px-ds-3 py-ds-1";
  return onPress ? (
    <button type="button" onClick={onPress} className={`${clase} hover:border-ds-brand`}>
      {contenido}
    </button>
  ) : (
    <span className={clase}>{contenido}</span>
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
