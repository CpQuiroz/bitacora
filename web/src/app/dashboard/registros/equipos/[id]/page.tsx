"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import type { Equipo, OrdenServicio, PlanMantencion, Trabajo } from "@bitacora/shared";
import { supabase } from "@/lib/supabase";
import { apiFetch } from "@/lib/api";
import { DashboardShell, type UsuarioShell } from "@/components/DashboardShell";
import { Badge, Button, Card, ErrorText, Input, Label, PageHeader, SuccessText, Textarea } from "@/components/ui";
import { IconChevronLeft, IconClipboardCheck, IconPlus, IconWrench } from "@/components/icons";

type TrabajoConOrden = Trabajo & { orden: Pick<OrdenServicio, "folio" | "estado_os"> | null };
type EquipoDetalle = Equipo & {
  cliente: { id: string; nombre: string } | null;
  asignacion_vigente: { colaborador_id: string; colaborador_nombre: string } | null;
  historico_mantenciones: TrabajoConOrden[];
};

export default function EquipoDetallePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [usuario, setUsuario] = useState<UsuarioShell | null>(null);
  const [equipo, setEquipo] = useState<EquipoDetalle | null>(null);
  const [planes, setPlanes] = useState<PlanMantencion[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

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

      <Card className="my-6">
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
          {equipo.categoria === "Vehículo" && (
            <>
              <div>
                <p className="text-xs text-muted">Patente</p>
                <p className="text-foreground">{equipo.patente ?? "—"}</p>
              </div>
              <div>
                <p className="text-xs text-muted">Asignado a</p>
                <p className="text-foreground">{equipo.asignacion_vigente?.colaborador_nombre ?? "Sin asignar"}</p>
              </div>
            </>
          )}
          <div>
            <p className="text-xs text-muted">Vencimiento de garantía</p>
            <p className="text-foreground">{equipo.garantia_vencimiento ?? "—"}</p>
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

      {aviso && (
        <div className="mb-6">
          <SuccessText>{aviso}</SuccessText>
        </div>
      )}

      <Card className="my-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground">Plan de Mantención Preventiva</h2>
          <Button type="button" variant="outline" onClick={() => (formPlanAbierto ? setFormPlanAbierto(false) : abrirFormPlan())}>
            <IconPlus className="h-4 w-4" />
            Nuevo plan
          </Button>
        </div>

        {/* TODO: decisión pendiente — generar automáticamente una OS
            cuando proxima_fecha se cumple. Hoy es solo CRUD del plan;
            requiere definir con qué datos se arma esa OS (responsable,
            tipo de servicio, etc.) antes de automatizarlo. */}

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
                    Cada {p.frecuencia_dias} días — próxima: {p.proxima_fecha}
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

      <Card className="my-6">
        <h2 className="mb-4 text-sm font-semibold text-foreground">Histórico de Mantenciones</h2>
        {equipo.historico_mantenciones.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-8 text-center">
            <IconWrench className="h-6 w-6 text-muted" />
            <p className="text-sm text-muted">Sin órdenes de servicio asociadas a este equipo todavía.</p>
          </div>
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
                    <p className="text-xs text-muted">{t.fecha}</p>
                  </div>
                </div>
                <Badge value={t.orden?.estado_os ?? t.estado} />
              </button>
            ))}
          </div>
        )}
      </Card>
    </DashboardShell>
  );
}
