"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import type { Usuario, Vehiculo } from "@bitacora/shared";
import { supabase } from "@/lib/supabase";
import { apiFetch } from "@/lib/api";
import { DashboardShell, type UsuarioShell } from "@/components/DashboardShell";
import { Badge, Button, Card, ErrorText, Input, Label, PageHeader, Select, SuccessText } from "@/components/ui";
import { DocumentoForm } from "@/components/DocumentoForm";
import { IconChevronLeft } from "@/components/icons";

type VehiculoDetalle = Vehiculo & { asignacion_vigente: { colaborador_id: string; colaborador_nombre: string } | null };
type Asignacion = { id: string; colaborador_id: string; desde: string; hasta: string | null; colaborador: { nombre: string } | null };

export default function VehiculoDetallePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [usuario, setUsuario] = useState<UsuarioShell | null>(null);
  const [vehiculo, setVehiculo] = useState<VehiculoDetalle | null>(null);
  const [asignaciones, setAsignaciones] = useState<Asignacion[]>([]);
  const [colaboradores, setColaboradores] = useState<Usuario[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [editando, setEditando] = useState(false);
  const [patente, setPatente] = useState("");
  const [marca, setMarca] = useState("");
  const [modelo, setModelo] = useState("");
  const [anio, setAnio] = useState("");
  const [tipo, setTipo] = useState("");
  const [capacidadCarga, setCapacidadCarga] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [errorForm, setErrorForm] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  const [colaboradorAsignar, setColaboradorAsignar] = useState("");
  const [asignando, setAsignando] = useState(false);

  const cargar = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      router.replace("/login");
      return;
    }
    const [resMe, resVehiculo, resAsignaciones, resUsuarios] = await Promise.all([
      apiFetch("/api/me"),
      apiFetch(`/api/vehiculos/${params.id}`),
      apiFetch(`/api/vehiculos/${params.id}/asignaciones`),
      apiFetch("/api/usuarios"),
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
    if (!resVehiculo.ok) {
      setError("No se pudo cargar el vehículo");
      return;
    }
    const v: VehiculoDetalle = await resVehiculo.json();
    setVehiculo(v);
    setPatente(v.patente);
    setMarca(v.marca ?? "");
    setModelo(v.modelo ?? "");
    setAnio(v.anio ? String(v.anio) : "");
    setTipo(v.tipo ?? "");
    setCapacidadCarga(v.capacidad_carga ?? "");
    if (resAsignaciones.ok) setAsignaciones(await resAsignaciones.json());
    if (resUsuarios.ok) {
      const todos: Usuario[] = await resUsuarios.json();
      setColaboradores(todos.filter((u) => u.rol === "colaborador" && u.activo));
    }
  }, [params.id, router]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  async function onGuardar() {
    setErrorForm(null);
    setAviso(null);
    setGuardando(true);
    const res = await apiFetch(`/api/vehiculos/${params.id}`, {
      method: "PATCH",
      body: JSON.stringify({ patente, marca, modelo, anio: anio || null, tipo, capacidad_carga: capacidadCarga }),
    });
    setGuardando(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setErrorForm(body.error ?? "No se pudo guardar");
      return;
    }
    setEditando(false);
    setAviso("Vehículo actualizado");
    cargar();
  }

  async function onAlternarActivo() {
    if (!vehiculo) return;
    const res = await apiFetch(`/api/vehiculos/${params.id}`, { method: "PATCH", body: JSON.stringify({ activo: !vehiculo.activo }) });
    if (res.ok) cargar();
  }

  async function onAsignar() {
    if (!colaboradorAsignar) return;
    setAsignando(true);
    const res = await apiFetch(`/api/vehiculos/${params.id}/asignar`, { method: "POST", body: JSON.stringify({ colaborador_id: colaboradorAsignar }) });
    setAsignando(false);
    if (res.ok) {
      setColaboradorAsignar("");
      cargar();
    }
  }

  async function onDesasignar() {
    const res = await apiFetch(`/api/vehiculos/${params.id}/desasignar`, { method: "POST" });
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
  if (!vehiculo) return null;

  return (
    <DashboardShell usuario={usuario}>
      <Link href="/dashboard/flota/vehiculos" className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-brand hover:underline">
        <IconChevronLeft className="h-4 w-4" />
        Vehículos
      </Link>

      <PageHeader
        title={vehiculo.patente}
        subtitle={[vehiculo.marca, vehiculo.modelo, vehiculo.anio].filter(Boolean).join(" ") || "—"}
        action={
          <div className="flex gap-2">
            <Badge value={vehiculo.activo ? "activo" : "inactivo"} />
            <Button type="button" variant="outline" onClick={onAlternarActivo}>
              {vehiculo.activo ? "Desactivar" : "Activar"}
            </Button>
            <Button type="button" variant="outline" onClick={() => setEditando((v) => !v)}>
              {editando ? "Cerrar" : "Editar"}
            </Button>
          </div>
        }
      />

      {editando && (
        <Card className="my-6">
          <h2 className="mb-4 text-sm font-semibold text-foreground">Editar datos</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label>Patente</Label>
              <Input type="text" value={patente} onChange={(e) => setPatente(e.target.value)} />
            </div>
            <div>
              <Label>Tipo</Label>
              <Input type="text" value={tipo} onChange={(e) => setTipo(e.target.value)} />
            </div>
            <div>
              <Label>Marca</Label>
              <Input type="text" value={marca} onChange={(e) => setMarca(e.target.value)} />
            </div>
            <div>
              <Label>Modelo</Label>
              <Input type="text" value={modelo} onChange={(e) => setModelo(e.target.value)} />
            </div>
            <div>
              <Label>Año</Label>
              <Input type="number" value={anio} onChange={(e) => setAnio(e.target.value)} />
            </div>
            <div>
              <Label>Capacidad de carga</Label>
              <Input type="text" value={capacidadCarga} onChange={(e) => setCapacidadCarga(e.target.value)} />
            </div>
          </div>
          {errorForm && (
            <div className="mt-3">
              <ErrorText>{errorForm}</ErrorText>
            </div>
          )}
          <Button type="button" onClick={onGuardar} disabled={guardando} className="mt-4">
            {guardando ? "Guardando…" : "Guardar"}
          </Button>
        </Card>
      )}
      {aviso && (
        <div className="my-4">
          <SuccessText>{aviso}</SuccessText>
        </div>
      )}

      <div className="my-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="mb-4 text-sm font-semibold text-foreground">Colaborador asignado</h2>
          {vehiculo.asignacion_vigente ? (
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-foreground">{vehiculo.asignacion_vigente.colaborador_nombre}</p>
                <p className="text-xs text-muted">Asignación vigente</p>
              </div>
              <Button type="button" variant="outline" onClick={onDesasignar}>
                Desasignar
              </Button>
            </div>
          ) : (
            <p className="text-sm text-muted">Este vehículo no tiene un colaborador asignado.</p>
          )}
          <div className="mt-4 flex gap-2 border-t border-border pt-4">
            <Select value={colaboradorAsignar} onChange={(e) => setColaboradorAsignar(e.target.value)} className="flex-1">
              <option value="">{vehiculo.asignacion_vigente ? "Reasignar a…" : "Asignar a…"}</option>
              {colaboradores.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre}
                </option>
              ))}
            </Select>
            <Button type="button" onClick={onAsignar} disabled={asignando || !colaboradorAsignar}>
              {asignando ? "…" : "Asignar"}
            </Button>
          </div>
        </Card>

        <Card>
          <h2 className="mb-4 text-sm font-semibold text-foreground">Historial de asignaciones</h2>
          {asignaciones.length === 0 ? (
            <p className="text-sm text-muted">Sin historial todavía.</p>
          ) : (
            <div className="flex flex-col gap-2 text-sm">
              {asignaciones.map((a) => (
                <div key={a.id} className="flex items-center justify-between border-b border-border pb-2 last:border-0">
                  <span className="text-foreground">{a.colaborador?.nombre ?? "—"}</span>
                  <span className="text-xs text-muted">
                    {a.desde} → {a.hasta ?? "hoy"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <DocumentoForm entidadTipo="vehiculo" entidadId={vehiculo.id} />
    </DashboardShell>
  );
}
