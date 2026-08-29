"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Vehiculo } from "@bitacora/shared";
import { supabase } from "@/lib/supabase";
import { apiFetch } from "@/lib/api";
import { DashboardShell, type UsuarioShell } from "@/components/DashboardShell";
import { Badge, Button, Card, ErrorText, Input, Label, PageHeader, SuccessText } from "@/components/ui";
import { DataTable } from "@/components/DataTable";
import { IconPlus, IconTruck } from "@/components/icons";

type VehiculoConAsignacion = Vehiculo & { asignacion_vigente: { colaborador_id: string; colaborador_nombre: string } | null };

export default function VehiculosPage() {
  const router = useRouter();
  const [usuario, setUsuario] = useState<UsuarioShell | null>(null);
  const [vehiculos, setVehiculos] = useState<VehiculoConAsignacion[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [formAbierto, setFormAbierto] = useState(false);
  const [patente, setPatente] = useState("");
  const [marca, setMarca] = useState("");
  const [modelo, setModelo] = useState("");
  const [anio, setAnio] = useState("");
  const [tipo, setTipo] = useState("");
  const [capacidadCarga, setCapacidadCarga] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [errorForm, setErrorForm] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      router.replace("/login");
      return;
    }
    const [resMe, resVehiculos] = await Promise.all([apiFetch("/api/me"), apiFetch("/api/vehiculos")]);
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
    if (!resVehiculos.ok) {
      setError("No se pudieron cargar los vehículos");
      return;
    }
    setVehiculos(await resVehiculos.json());
  }, [router]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  function limpiarForm() {
    setFormAbierto(false);
    setPatente("");
    setMarca("");
    setModelo("");
    setAnio("");
    setTipo("");
    setCapacidadCarga("");
    setErrorForm(null);
  }

  async function onCrear() {
    setErrorForm(null);
    setAviso(null);
    if (!patente.trim()) {
      setErrorForm("Falta la patente");
      return;
    }
    setGuardando(true);
    const res = await apiFetch("/api/vehiculos", {
      method: "POST",
      body: JSON.stringify({ patente, marca, modelo, anio: anio || null, tipo, capacidad_carga: capacidadCarga }),
    });
    setGuardando(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setErrorForm(body.error ?? "No se pudo crear el vehículo");
      return;
    }
    setAviso("Vehículo creado");
    limpiarForm();
    cargar();
  }

  if (!usuario) return null;

  return (
    <DashboardShell usuario={usuario}>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <PageHeader title="Vehículos" subtitle="Flota, documentos y asignación a colaboradores" />
        <Button type="button" onClick={() => (formAbierto ? limpiarForm() : setFormAbierto(true))}>
          <IconPlus className="h-4 w-4" />
          Nuevo Vehículo
        </Button>
      </div>

      {formAbierto && (
        <Card className="mb-6">
          <h2 className="mb-4 text-sm font-semibold text-foreground">Nuevo vehículo</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label>Patente</Label>
              <Input type="text" required value={patente} onChange={(e) => setPatente(e.target.value)} />
            </div>
            <div>
              <Label>Tipo</Label>
              <Input type="text" placeholder="Camión, camioneta…" value={tipo} onChange={(e) => setTipo(e.target.value)} />
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
              <Input type="text" placeholder="ej. 5.000 kg" value={capacidadCarga} onChange={(e) => setCapacidadCarga(e.target.value)} />
            </div>
          </div>
          {errorForm && (
            <div className="mt-3">
              <ErrorText>{errorForm}</ErrorText>
            </div>
          )}
          <Button type="button" onClick={onCrear} disabled={guardando} className="mt-4">
            {guardando ? "Guardando…" : "Guardar"}
          </Button>
        </Card>
      )}

      {aviso && (
        <div className="mb-4">
          <SuccessText>{aviso}</SuccessText>
        </div>
      )}
      {error && <ErrorText>{error}</ErrorText>}

      <DataTable
        rows={vehiculos ?? []}
        rowKey={(v) => v.id}
        loading={vehiculos === null && !error}
        columns={[
          { header: "Patente", cell: (v) => <span className="font-medium text-foreground">{v.patente}</span> },
          { header: "Marca / Modelo", cell: (v) => <span className="text-muted">{[v.marca, v.modelo].filter(Boolean).join(" ") || "—"}</span> },
          { header: "Tipo", cell: (v) => <span className="text-muted">{v.tipo ?? "—"}</span> },
          { header: "Asignado a", cell: (v) => <span className="text-muted">{v.asignacion_vigente?.colaborador_nombre ?? "Sin asignar"}</span> },
          { header: "Estado", cell: (v) => <Badge value={v.activo ? "activo" : "inactivo"} /> },
        ]}
        actions={[{ label: "Ver ficha", onClick: (v) => router.push(`/dashboard/flota/vehiculos/${v.id}`), variant: "brand" }]}
        emptyState={{ icon: IconTruck, message: "Todavía no hay vehículos registrados." }}
      />
    </DashboardShell>
  );
}
