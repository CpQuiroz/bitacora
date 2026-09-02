"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { AuditoriaUsuario, Rol, Usuario } from "@bitacora/shared";
import { supabase } from "@/lib/supabase";
import { apiFetch } from "@/lib/api";
import { ROLES } from "@/lib/roles";
import { DashboardShell, type UsuarioShell } from "@/components/DashboardShell";
import {
  Badge,
  Button,
  Card,
  ErrorText,
  Input,
  Label,
  PageHeader,
  Select,
  SinAutorizacion,
  SuccessText,
} from "@/components/ui";
import { IconMail, IconUsers } from "@/components/icons";

type AuditoriaFila = AuditoriaUsuario & {
  usuario_afectado: { nombre: string } | null;
  realizado_por: { nombre: string } | null;
};

const CAMPO_LABEL: Record<string, string> = { rol: "Rol", activo: "Estado" };

function formatCampoValor(campo: string, valor: string | null) {
  if (valor === null) return "—";
  if (campo === "activo") return valor === "true" ? "Activo" : "Inactivo";
  return valor;
}

export default function EquipoPage() {
  const router = useRouter();
  const [usuario, setUsuario] = useState<UsuarioShell | null>(null);
  const [usuarioId, setUsuarioId] = useState<string | null>(null);
  const [usuarios, setUsuarios] = useState<Usuario[] | null>(null);
  const [auditoria, setAuditoria] = useState<AuditoriaFila[] | null>(null);
  const [sinAcceso, setSinAcceso] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [exito, setExito] = useState<string | null>(null);
  const [invitando, setInvitando] = useState(false);

  const [email, setEmail] = useState("");
  const [nombre, setNombre] = useState("");
  const [telefono, setTelefono] = useState("");
  const [rol, setRol] = useState<Rol>("colaborador");

  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [editRol, setEditRol] = useState<Rol>("colaborador");
  const [editActivo, setEditActivo] = useState(true);
  const [editError, setEditError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  async function cargar() {
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      router.replace("/login");
      return;
    }
    const [resMe, resUsuarios, resAuditoria] = await Promise.all([
      apiFetch("/api/me"),
      apiFetch("/api/usuarios"),
      apiFetch("/api/usuarios/auditoria"),
    ]);
    if (resMe.ok) {
      const { usuario: u } = await resMe.json();
      if (u) {
        setUsuarioId(u.id);
        setUsuario({ nombre: u.nombre, rol: u.rol, empresaNombre: u.empresa?.nombre ?? "", empresaLogoUrl: u.empresa?.logo_url ?? null, colorPrimario: u.empresa?.color_primario ?? null, colorPrimarioForeground: u.empresa?.color_primario_foreground ?? null, colorSecundario: u.empresa?.color_secundario ?? null, fuente: u.empresa?.fuente ?? null, moneda: u.empresa?.moneda ?? "CLP" });
      }
    }
    if (resUsuarios.status === 403) {
      setSinAcceso(true);
      return;
    }
    if (!resUsuarios.ok) {
      setError("No se pudo cargar el equipo");
      return;
    }
    setUsuarios(await resUsuarios.json());
    if (resAuditoria.ok) setAuditoria(await resAuditoria.json());
  }

  useEffect(() => {
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    setExito(null);
    setInvitando(true);
    const res = await apiFetch("/api/usuarios/invitar", {
      method: "POST",
      body: JSON.stringify({ email, nombre, rol, telefono: telefono.trim() || undefined }),
    });
    setInvitando(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setFormError(body.error ?? "No se pudo invitar al usuario");
      return;
    }
    setExito(`Invitación enviada a ${email}`);
    setEmail("");
    setNombre("");
    setTelefono("");
    setRol("colaborador");
    cargar();
  }

  function iniciarEdicion(u: Usuario) {
    setEditandoId(u.id);
    setEditRol(u.rol);
    setEditActivo(u.activo);
    setEditError(null);
  }

  async function guardarEdicion(u: Usuario) {
    setGuardando(true);
    setEditError(null);
    const cambios: Record<string, unknown> = {};
    if (editRol !== u.rol) cambios.rol = editRol;
    if (editActivo !== u.activo) cambios.activo = editActivo;

    if (Object.keys(cambios).length === 0) {
      setEditandoId(null);
      setGuardando(false);
      return;
    }

    const res = await apiFetch(`/api/usuarios/${u.id}`, { method: "PATCH", body: JSON.stringify(cambios) });
    setGuardando(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setEditError(body.error ?? "No se pudo actualizar");
      return;
    }
    setEditandoId(null);
    cargar();
  }

  if (sinAcceso) {
    return usuario ? (
      <DashboardShell usuario={usuario}>
        <SinAutorizacion mensaje="Solo un administrador puede ver Grupo y usuario." />
      </DashboardShell>
    ) : null;
  }

  if (!usuario) return null;

  return (
    <DashboardShell usuario={usuario}>
      <PageHeader title="Grupo y usuario" subtitle="Invita al equipo, asigna roles y controla el acceso" />

      <Card className="my-6">
        <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-foreground">
          <IconMail className="h-4 w-4 text-brand" />
          Invitar a alguien nuevo
        </h2>
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label>Correo</Label>
              <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div>
              <Label>Nombre</Label>
              <Input type="text" required value={nombre} onChange={(e) => setNombre(e.target.value)} />
            </div>
            <div>
              <Label>Rol</Label>
              <Select value={rol} onChange={(e) => setRol(e.target.value as Rol)}>
                {ROLES.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </Select>
            </div>
            <div className="sm:col-span-2">
              <Label>Teléfono (opcional)</Label>
              <Input
                type="tel"
                placeholder="+56 9 1234 5678"
                value={telefono}
                onChange={(e) => setTelefono(e.target.value)}
              />
              <p className="mt-1 text-xs text-muted">Con código de país. Sirve para que un chofer use el bot de WhatsApp.</p>
            </div>
          </div>
          {formError && <ErrorText>{formError}</ErrorText>}
          {exito && <SuccessText>{exito}</SuccessText>}
          <Button type="submit" disabled={invitando} className="self-start">
            {invitando ? "Invitando…" : "Invitar"}
          </Button>
        </form>
      </Card>

      {error && <ErrorText>{error}</ErrorText>}
      {usuarios === null && !error && <p className="text-sm text-muted">Cargando…</p>}
      {usuarios?.length === 0 && (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border py-16 text-center">
          <IconUsers className="h-8 w-8 text-muted" />
          <p className="text-sm text-muted">Todavía no hay nadie en el equipo.</p>
        </div>
      )}
      {usuarios && usuarios.length > 0 && (
        <Card className="overflow-x-auto p-0">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border text-xs text-muted">
                <th className="px-5 py-3 font-medium">Nombre</th>
                <th className="px-5 py-3 font-medium">Rol</th>
                <th className="px-5 py-3 font-medium">Estado</th>
                <th className="px-5 py-3 font-medium">Documentos</th>
                <th className="px-5 py-3 font-medium" />
              </tr>
            </thead>
            <tbody>
              {usuarios.map((u) =>
                editandoId === u.id ? (
                  <tr key={u.id} className="border-b border-border bg-brand-soft/30 last:border-0">
                    <td className="px-5 py-3 font-medium text-foreground">{u.nombre}</td>
                    <td className="px-5 py-3">
                      <Select value={editRol} onChange={(e) => setEditRol(e.target.value as Rol)} className="min-w-36">
                        {ROLES.map((r) => (
                          <option key={r.value} value={r.value}>
                            {r.label}
                          </option>
                        ))}
                      </Select>
                    </td>
                    <td className="px-5 py-3">
                      <label className="flex items-center gap-2 text-sm text-foreground">
                        <input type="checkbox" checked={editActivo} onChange={(e) => setEditActivo(e.target.checked)} />
                        Activo
                      </label>
                    </td>
                    <td className="px-5 py-3">
                      <Link href={`/dashboard/flota/colaboradores/${u.id}`} className="text-xs font-medium text-brand hover:underline">
                        Ver documentos →
                      </Link>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex flex-col items-end gap-1.5">
                        <div className="flex gap-2">
                          <Button type="button" onClick={() => guardarEdicion(u)} disabled={guardando} className="px-3 py-1.5 text-xs">
                            {guardando ? "Guardando…" : "Guardar"}
                          </Button>
                          <Button type="button" variant="outline" onClick={() => setEditandoId(null)} className="px-3 py-1.5 text-xs">
                            Cancelar
                          </Button>
                        </div>
                        {editError && <span className="text-xs text-danger">{editError}</span>}
                      </div>
                    </td>
                  </tr>
                ) : (
                  <tr key={u.id} className="border-b border-border last:border-0 hover:bg-brand-soft/40">
                    <td className="px-5 py-3 font-medium text-foreground">{u.nombre}</td>
                    <td className="px-5 py-3">
                      <Badge value={u.rol} />
                    </td>
                    <td className="px-5 py-3">
                      <Badge value={u.activo ? "activo" : "inactivo"} />
                    </td>
                    <td className="px-5 py-3">
                      <Link href={`/dashboard/flota/colaboradores/${u.id}`} className="text-xs font-medium text-brand hover:underline">
                        Ver documentos →
                      </Link>
                    </td>
                    <td className="px-5 py-3 text-right">
                      {u.id !== usuarioId && (
                        <button type="button" onClick={() => iniciarEdicion(u)} className="text-xs font-medium text-brand hover:underline">
                          Editar
                        </button>
                      )}
                    </td>
                  </tr>
                )
              )}
            </tbody>
          </table>
        </Card>
      )}

      {auditoria && auditoria.length > 0 && (
        <Card className="mt-6 overflow-x-auto p-0">
          <h2 className="px-5 pt-5 text-sm font-semibold text-foreground">Historial de cambios</h2>
          <table className="mt-3 w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border text-xs text-muted">
                <th className="px-5 py-3 font-medium">Usuario</th>
                <th className="px-5 py-3 font-medium">Campo</th>
                <th className="px-5 py-3 font-medium">Cambio</th>
                <th className="px-5 py-3 font-medium">Realizado por</th>
                <th className="px-5 py-3 font-medium">Fecha</th>
              </tr>
            </thead>
            <tbody>
              {auditoria.map((a) => (
                <tr key={a.id} className="border-b border-border text-muted last:border-0">
                  <td className="px-5 py-3 font-medium text-foreground">{a.usuario_afectado?.nombre ?? "—"}</td>
                  <td className="px-5 py-3">{CAMPO_LABEL[a.campo] ?? a.campo}</td>
                  <td className="px-5 py-3">
                    {formatCampoValor(a.campo, a.valor_anterior)} → {formatCampoValor(a.campo, a.valor_nuevo)}
                  </td>
                  <td className="px-5 py-3">{a.realizado_por?.nombre ?? "—"}</td>
                  <td className="px-5 py-3">{new Date(a.creado_en).toLocaleString("es-CL")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </DashboardShell>
  );
}
