"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import type { RutaPlanificada, Usuario } from "@bitacora/shared";
import { REGIONES } from "@bitacora/shared";
import { supabase } from "@/lib/supabase";
import { apiFetch } from "@/lib/api";
import { DashboardShell, type UsuarioShell } from "@/components/DashboardShell";
import { Badge, Button, Card, ErrorText, Input, Label, PageHeader, Select, SuccessText } from "@/components/ui";
import { DocumentoForm } from "@/components/DocumentoForm";
import { IconCalendar, IconChevronLeft } from "@/components/icons";

export default function ColaboradorFlotaDetallePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [usuario, setUsuario] = useState<UsuarioShell | null>(null);
  const [colaborador, setColaborador] = useState<Usuario | null>(null);
  const [rutas, setRutas] = useState<RutaPlanificada[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [nombre, setNombre] = useState("");
  const [telefono, setTelefono] = useState("");
  const [zona, setZona] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const [errorForm, setErrorForm] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      router.replace("/login");
      return;
    }
    const [resMe, resUsuarios, resRutas] = await Promise.all([apiFetch("/api/me"), apiFetch("/api/usuarios"), apiFetch("/api/rutas-planificadas")]);
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
      setError("No se pudo cargar el colaborador");
      return;
    }
    const todos: Usuario[] = await resUsuarios.json();
    const c = todos.find((u2) => u2.id === params.id);
    if (!c) {
      setError("Colaborador no encontrado");
      return;
    }
    setColaborador(c);
    setNombre(c.nombre ?? "");
    setTelefono(c.telefono ?? "");
    setZona(c.zona ?? "");
    if (resRutas.ok) {
      const todasRutas: RutaPlanificada[] = await resRutas.json();
      setRutas(todasRutas.filter((r) => r.responsable_id === params.id));
    }
  }, [params.id, router]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  async function onGuardar() {
    setErrorForm(null);
    setAviso(null);
    if (!nombre.trim()) {
      setErrorForm("El nombre no puede quedar vacío");
      return;
    }
    setGuardando(true);
    const res = await apiFetch(`/api/usuarios/${params.id}/zona`, {
      method: "PATCH",
      body: JSON.stringify({ nombre: nombre.trim(), telefono: telefono.trim(), zona }),
    });
    setGuardando(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setErrorForm(body.error ?? "No se pudo guardar");
      return;
    }
    setAviso("Datos actualizados");
    cargar();
  }

  const DIAS: Record<string, string> = { lunes: "Lun", martes: "Mar", miercoles: "Mié", jueves: "Jue", viernes: "Vie", sabado: "Sáb", domingo: "Dom" };

  if (!usuario) return null;
  if (error) {
    return (
      <DashboardShell usuario={usuario}>
        <ErrorText>{error}</ErrorText>
      </DashboardShell>
    );
  }
  if (!colaborador) return null;

  return (
    <DashboardShell usuario={usuario}>
      <Link href="/dashboard/flota/colaboradores" className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-brand hover:underline">
        <IconChevronLeft className="h-4 w-4" />
        Colaboradores
      </Link>

      <PageHeader title={colaborador.nombre} subtitle={colaborador.telefono ?? "Sin teléfono"} action={<Badge value={colaborador.activo ? "activo" : "inactivo"} />} />

      <div className="my-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="mb-4 text-sm font-semibold text-foreground">Datos del colaborador</h2>
          <div className="flex flex-col gap-4">
            <div>
              <Label>Nombre</Label>
              <Input type="text" value={nombre} onChange={(e) => setNombre(e.target.value)} />
            </div>
            <div>
              <Label>Teléfono</Label>
              <Input type="tel" placeholder="+56 9 1234 5678" value={telefono} onChange={(e) => setTelefono(e.target.value)} />
              <p className="mt-1 text-xs text-muted">Con código de país. Necesario para que use el bot de WhatsApp.</p>
            </div>
            <div>
              <Label>Zona / área de cobertura</Label>
              <Select value={zona} onChange={(e) => setZona(e.target.value)}>
                <option value="">Sin zona</option>
                {REGIONES.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
                {zona && !REGIONES.includes(zona) && <option value={zona}>{zona} (actual)</option>}
              </Select>
            </div>
          </div>
          {errorForm && (
            <div className="mt-3">
              <ErrorText>{errorForm}</ErrorText>
            </div>
          )}
          {aviso && (
            <div className="mt-3">
              <SuccessText>{aviso}</SuccessText>
            </div>
          )}
          <Button type="button" onClick={onGuardar} disabled={guardando} className="mt-4">
            {guardando ? "Guardando…" : "Guardar"}
          </Button>
        </Card>

        <Card>
          <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-foreground">
            <IconCalendar className="h-4 w-4 text-brand" />
            Jornada / rutas planificadas
          </h2>
          {rutas.length === 0 ? (
            <p className="text-sm text-muted">
              Sin rutas planificadas asignadas — se configuran en{" "}
              <Link href="/dashboard/rutas" className="font-medium text-brand hover:underline">
                Rutas
              </Link>
              .
            </p>
          ) : (
            <div className="flex flex-col gap-3">
              {rutas.map((r) => (
                <div key={r.id} className="border-b border-border pb-3 last:border-0">
                  <p className="text-sm font-medium text-foreground">{r.nombre ?? "Ruta sin nombre"}</p>
                  <p className="text-xs text-muted">
                    {r.dias_semana.map((d) => DIAS[d] ?? d).join(", ")} · {r.hora_inicio}–{r.hora_fin}
                  </p>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <DocumentoForm entidadTipo="colaborador" entidadId={colaborador.id} />
    </DashboardShell>
  );
}
