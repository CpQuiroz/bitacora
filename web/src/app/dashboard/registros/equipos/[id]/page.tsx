"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import type { Equipo, OrdenServicio, PlanMantencion, Trabajo } from "@bitacora/shared";
import { estadoOsDeTrabajo } from "@bitacora/shared";
import { supabase } from "@/lib/supabase";
import { apiFetch } from "@/lib/api";
import { DashboardShell, type UsuarioShell } from "@/components/DashboardShell";
import { Badge, Button, Card, ErrorText, Input, Label, PageHeader, SuccessText, Textarea } from "@/components/ui";
import { EstadoVacio } from "@/components/estados";
import { IconChevronLeft, IconClipboardCheck, IconPlus, IconWrench } from "@/components/icons";
import { RegistrosMantencion } from "./RegistrosMantencion";

type TrabajoConOrden = Trabajo & { orden: Pick<OrdenServicio, "folio" | "estado_os"> | null };
type EquipoDetalle = Equipo & {
  cliente: { id: string; nombre: string } | null;
  asignacion_vigente: { colaborador_id: string; colaborador_nombre: string } | null;
  historico_mantenciones: TrabajoConOrden[];
};

type Tab = "datos" | "plan" | "historico_os" | "mantencion";

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
        <ErrorText>{error}</ErrorText>
      </DashboardShell>
    );
  }
  if (!equipo) return null;

  return (
    <DashboardShell usuario={usuario}>
      <Link href="/dashboard/registros/equipos" className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-brand hover:underline">
        <IconChevronLeft className="h-4 w-4" />
        Equipos
      </Link>

      <PageHeader
        title={equipo.nombre}
        subtitle={[equipo.marca, equipo.modelo].filter(Boolean).join(" ") || equipo.categoria || "—"}
        action={<Badge value={equipo.activo ? "activo" : "inactivo"} />}
      />

      {aviso && (
        <div className="mt-6">
          <SuccessText>{aviso}</SuccessText>
        </div>
      )}

      <nav className="mt-6 flex gap-1 overflow-x-auto border-b border-border" aria-label="Secciones del equipo">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            aria-current={tab === t.id ? "page" : undefined}
            className={`-mb-px whitespace-nowrap border-b-2 px-3.5 py-2.5 text-sm font-semibold transition-colors ${
              tab === t.id
                ? "border-brand text-brand"
                : "border-transparent text-muted hover:text-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {tab === "datos" && (
        <Card className="mt-6">
          <h2 className="mb-4 text-sm font-semibold text-foreground">Datos del equipo</h2>
          <div className="grid gap-4 text-sm sm:grid-cols-3">
            <div>
              <p className="text-xs text-muted">Cliente</p>
              <p className="text-foreground">{equipo.cliente?.nombre ?? "Propio de la empresa"}</p>
            </div>
            <div>
              <p className="text-xs text-muted">Categoría</p>
              <p className="text-foreground">{equipo.categoria ?? "—"}</p>
            </div>
            <div>
              <p className="text-xs text-muted">N° de serie</p>
              <p className="text-foreground">{equipo.numero_serie ?? "—"}</p>
            </div>
            {esVehiculo && (
              <>
                <div>
                  <p className="text-xs text-muted">Patente</p>
                  <p className="font-mono text-foreground">{equipo.patente ?? "—"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted">Asignado a</p>
                  <p className="text-foreground">{equipo.asignacion_vigente?.colaborador_nombre ?? "Sin asignar"}</p>
                </div>
              </>
            )}
            <div>
              <p className="text-xs text-muted">Vencimiento de garantía</p>
              <p className="font-mono text-foreground">{equipo.garantia_vencimiento ?? "—"}</p>
            </div>
          </div>
          <p className="mt-4 text-xs text-muted">
            Para editar estos datos, hacelo desde el{" "}
            <Link href="/dashboard/registros/equipos" className="font-medium text-brand hover:underline">
              listado de Equipos
            </Link>
            .
          </p>
        </Card>
      )}

      {tab === "plan" && (
        <Card className="mt-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-foreground">Plan de Mantención Preventiva</h2>
            <Button type="button" variant="outline" onClick={() => (formPlanAbierto ? setFormPlanAbierto(false) : abrirFormPlan())}>
              <IconPlus className="h-4 w-4" />
              Nuevo plan
            </Button>
          </div>

          {formPlanAbierto && (
            <form onSubmit={onCrearPlan} className="mb-4 flex flex-col gap-3 rounded-lg border border-border p-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label>Frecuencia (días)</Label>
                  <Input type="number" min="1" required value={frecuenciaDias} onChange={(e) => setFrecuenciaDias(e.target.value)} />
                </div>
                <div>
                  <Label>Próxima fecha</Label>
                  <Input type="date" required value={proximaFecha} onChange={(e) => setProximaFecha(e.target.value)} />
                </div>
              </div>
              <div>
                <Label>Notas (opcional)</Label>
                <Textarea rows={2} value={notasPlan} onChange={(e) => setNotasPlan(e.target.value)} />
              </div>
              {errorPlan && <ErrorText>{errorPlan}</ErrorText>}
              <Button type="submit" disabled={guardandoPlan} className="self-start">
                {guardandoPlan ? "Guardando…" : "Crear plan"}
              </Button>
            </form>
          )}

          {planes.length === 0 ? (
            <p className="text-sm text-muted">Sin plan de mantención registrado.</p>
          ) : (
            <div className="flex flex-col divide-y divide-border">
              {planes.map((p) => (
                <div key={p.id} className="flex items-center justify-between py-2.5 text-sm">
                  <div>
                    <p className="font-medium text-foreground">
                      Cada {p.frecuencia_dias} días — próxima: <span className="font-mono">{p.proxima_fecha}</span>
                    </p>
                    {p.notas && <p className="text-xs text-muted">{p.notas}</p>}
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge value={p.activo ? "activo" : "inactivo"} />
                    <Button type="button" variant="ghost" onClick={() => onAlternarPlan(p)}>
                      {p.activo ? "Desactivar" : "Activar"}
                    </Button>
                    <Button type="button" variant="ghost" onClick={() => onEliminarPlan(p)}>
                      Eliminar
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {tab === "historico_os" && (
        <Card className="mt-6">
          <h2 className="mb-4 text-sm font-semibold text-foreground">Histórico de OS</h2>
          {equipo.historico_mantenciones.length === 0 ? (
            <EstadoVacio icono={IconWrench} titulo="Sin órdenes de servicio asociadas a este equipo todavía" />
          ) : (
            <div className="flex flex-col divide-y divide-border">
              {equipo.historico_mantenciones.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => router.push(`/dashboard/ordenes/${t.id}`)}
                  className="flex items-center justify-between py-2.5 text-left text-sm hover:text-brand"
                >
                  <div className="flex items-center gap-2">
                    <IconClipboardCheck className="h-3.5 w-3.5 shrink-0 text-muted" />
                    <div>
                      <p className="font-medium text-foreground">
                        {t.orden?.folio != null ? `OS N° ${t.orden.folio}` : t.descripcion || "Sin folio"}
                      </p>
                      <p className="font-mono text-xs text-muted">{t.fecha}</p>
                    </div>
                  </div>
                  <Badge value={t.orden?.estado_os ?? estadoOsDeTrabajo(t.estado)} />
                </button>
              ))}
            </div>
          )}
        </Card>
      )}

      {tab === "mantencion" && esVehiculo && (
        <div className="mt-6">
          <RegistrosMantencion equipo={equipo} puedeGestionar={puedeGestionar} />
        </div>
      )}
    </DashboardShell>
  );
}
