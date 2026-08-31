"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { Equipo, Usuario } from "@bitacora/shared";
import { supabase } from "@/lib/supabase";
import { apiFetch } from "@/lib/api";
import { DashboardShell, type UsuarioShell } from "@/components/DashboardShell";
import { ErrorText } from "@/components/ui";
import { DataTable } from "@/components/DataTable";
import { IconUsers } from "@/components/icons";

type EquipoConAsignacion = Equipo & { asignacion_vigente: { colaborador_id: string; colaborador_nombre: string } | null };

export default function ColaboradoresFlotaPage() {
  const router = useRouter();
  const [usuario, setUsuario] = useState<UsuarioShell | null>(null);
  const [colaboradores, setColaboradores] = useState<Usuario[] | null>(null);
  const [vehiculoPorColaborador, setVehiculoPorColaborador] = useState<Map<string, string>>(new Map());
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      router.replace("/login");
      return;
    }
    const [resMe, resUsuarios, resEquipos] = await Promise.all([apiFetch("/api/me"), apiFetch("/api/usuarios"), apiFetch("/api/equipos")]);
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
    if (!resUsuarios.ok) {
      setError("No se pudieron cargar los colaboradores");
      return;
    }
    const todos: Usuario[] = await resUsuarios.json();
    setColaboradores(todos.filter((u) => u.rol === "colaborador"));

    if (resEquipos.ok) {
      const equipos: EquipoConAsignacion[] = await resEquipos.json();
      const mapa = new Map<string, string>();
      for (const e of equipos) {
        if (e.categoria === "Vehículo" && e.asignacion_vigente && e.patente) mapa.set(e.asignacion_vigente.colaborador_id, e.patente);
      }
      setVehiculoPorColaborador(mapa);
    }
  }, [router]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  if (!usuario) return null;

  return (
    <DashboardShell usuario={usuario}>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Colaboradores</h1>
        <p className="mt-1 text-sm text-muted">Perfil operativo, zona y vehículo asignado</p>
      </div>

      {error && <ErrorText>{error}</ErrorText>}

      <DataTable
        rows={colaboradores ?? []}
        rowKey={(c) => c.id}
        loading={colaboradores === null && !error}
        columns={[
          { header: "Nombre", cell: (c) => <span className="font-medium text-foreground">{c.nombre}</span> },
          { header: "Teléfono", cell: (c) => <span className="text-muted">{c.telefono ?? "—"}</span> },
          { header: "Zona", cell: (c) => <span className="text-muted">{c.zona ?? "—"}</span> },
          { header: "Vehículo asignado", cell: (c) => <span className="text-muted">{vehiculoPorColaborador.get(c.id) ?? "Sin asignar"}</span> },
        ]}
        actions={[{ label: "Ver ficha", onClick: (c) => router.push(`/dashboard/flota/colaboradores/${c.id}`), variant: "brand" }]}
        emptyState={{ icon: IconUsers, message: "Todavía no hay colaboradores registrados — invítalos desde Gestión y Control." }}
      />
    </DashboardShell>
  );
}
