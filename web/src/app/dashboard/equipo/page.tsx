"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { AuditoriaUsuario, Usuario } from "@bitacora/shared";
import { supabase } from "@/lib/supabase";
import { apiFetch } from "@/lib/api";
import { useRolesDisponibles } from "@/lib/roles";
import { FUNCIONES } from "@/lib/funciones";
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
import { EstadoCargando, EstadoVacio } from "@/components/estados";

type AuditoriaFila = AuditoriaUsuario & {
  usuario_afectado: { nombre: string } | null;
  realizado_por: { nombre: string } | null;
};

const CAMPO_LABEL: Record<string, string> = { rol: "Rol", activo: "Estado", clave: "Contraseña" };

function formatCampoValor(campo: string, valor: string | null) {
  if (valor === null) return "—";
  if (campo === "activo") return valor === "true" ? "Activo" : "Inactivo";
  return valor;
}

export default function EquipoPage() {
  const router = useRouter();
  const [usuario, setUsuario] = useState<UsuarioShell | null>(null);
  const [usuarioId, setUsuarioId] = useState<string | null>(null);
  const [usuarios, setUsuarios] = useState<(Usuario & { correo: string | null })[] | null>(null);
  const [auditoria, setAuditoria] = useState<AuditoriaFila[] | null>(null);
  const [sinAcceso, setSinAcceso] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [exito, setExito] = useState<string | null>(null);
  const [invitando, setInvitando] = useState(false);

  const [email, setEmail] = useState("");
  const [nombre, setNombre] = useState("");
  const [telefono, setTelefono] = useState("");
  const rolesDisponibles = useRolesDisponibles();
  const etiquetaRol = (slug: string) => rolesDisponibles.find((r) => r.value === slug)?.label ?? slug;
  const [rol, setRol] = useState("colaborador");
  const [funcion, setFuncion] = useState<string>("");

  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [editRol, setEditRol] = useState<string>("colaborador");
  const [editActivo, setEditActivo] = useState(true);
  const [editError, setEditError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [reseteandoId, setReseteandoId] = useState<string | null>(null);
  const [passwordGenerada, setPasswordGenerada] = useState<{ usuarioId: string; nombre: string; password: string } | null>(null);

  const [accesos, setAccesos] = useState<
    { id: string; tipo: "correo" | "dominio"; valor: string; rol: string; creado_en: string }[] | null
  >(null);
  const [accesoTipo, setAccesoTipo] = useState<"correo" | "dominio">("correo");
  const [accesoValor, setAccesoValor] = useState("");
  const [accesoRol, setAccesoRol] = useState("colaborador");
  const [guardandoAcceso, setGuardandoAcceso] = useState(false);
  const [errorAcceso, setErrorAcceso] = useState<string | null>(null);

  async function cargar() {
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      router.replace("/login");
      return;
    }
    const [resMe, resUsuarios, resAuditoria] = await Promise.all([
      apiFetch("/api/me"),
      apiFetch("/api/usuarios?con_correo=1"),
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
    cargarAccesos();
  }

  async function cargarAccesos() {
    const res = await apiFetch("/api/accesos");
    if (res.ok) setAccesos((await res.json()).accesos ?? []);
  }

  async function onAgregarAcceso(e: FormEvent) {
    e.preventDefault();
    setErrorAcceso(null);
    setGuardandoAcceso(true);
    const res = await apiFetch("/api/accesos", {
      method: "POST",
      body: JSON.stringify({ tipo: accesoTipo, valor: accesoValor.trim(), rol: accesoRol }),
    });
    setGuardandoAcceso(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setErrorAcceso(body.error ?? "No se pudo agregar");
      return;
    }
    setAccesoValor("");
    cargarAccesos();
  }

  async function onQuitarAcceso(id: string) {
    setErrorAcceso(null);
    const res = await apiFetch(`/api/accesos/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setErrorAcceso(body.error ?? "No se pudo quitar");
      return;
    }
    cargarAccesos();
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
      body: JSON.stringify({
        email,
        nombre,
        rol,
        telefono: telefono.trim() || undefined,
        funcion: rol === "colaborador" && funcion ? funcion : undefined,
      }),
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
    setFuncion("");
    cargar();
  }

  function iniciarEdicion(u: Usuario) {
    setEditandoId(u.id);
    setEditRol(u.rol);
    setEditActivo(u.activo);
    setEditError(null);
  }

  async function onRestablecerPassword(u: Usuario) {
    if (!confirm(`¿Generar una contraseña nueva para ${u.nombre}? La actual deja de funcionar de inmediato.`)) return;
    setReseteandoId(u.id);
    setEditError(null);
    const res = await apiFetch(`/api/usuarios/${u.id}/restablecer-password`, { method: "POST" });
    setReseteandoId(null);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setEditError(body.error ?? "No se pudo restablecer la contraseña");
      return;
    }
    const body = await res.json();
    setPasswordGenerada({ usuarioId: u.id, nombre: u.nombre, password: body.password });
    setEditandoId(null);
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
              <Select value={rol} onChange={(e) => setRol(e.target.value)}>
                {rolesDisponibles.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </Select>
            </div>
            {rol === "colaborador" && (
              <div>
                <Label>Función (opcional)</Label>
                <Select value={funcion} onChange={(e) => setFuncion(e.target.value)}>
                  <option value="">Sin definir</option>
                  {FUNCIONES.map((f) => (
                    <option key={f.value} value={f.value}>
                      {f.label}
                    </option>
                  ))}
                </Select>
                <p className="mt-1 text-xs text-muted">Define qué ve en la app móvil (un chofer no ve Órdenes de servicio).</p>
              </div>
            )}
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

      <Card className="my-6">
        <h2 className="mb-1 text-sm font-semibold text-foreground">Correos y dominios autorizados</h2>
        <p className="mb-4 text-sm text-muted">
          Un correo (<code>persona@tuempresa.cl</code>) o un dominio entero (<code>tuempresa.cl</code>) de esta lista puede entrar
          a la empresa sin invitación — la primera vez que inicia sesión se le crea el usuario con el rol indicado. Un correo que
          no está acá ni fue invitado no puede entrar.
        </p>

        {accesos === null ? (
          <EstadoCargando />
        ) : accesos.length === 0 ? (
          <p className="text-sm text-muted">Sin correos ni dominios autorizados.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {accesos.map((a) => (
              <div key={a.id} className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2 text-sm">
                <span className="flex flex-wrap items-center gap-2">
                  <Badge value={a.tipo} />
                  <span className="font-mono text-foreground">{a.valor}</span>
                  <span className="text-muted">→ {etiquetaRol(a.rol)}</span>
                </span>
                <Button type="button" variant="ghost" onClick={() => onQuitarAcceso(a.id)}>
                  Quitar
                </Button>
              </div>
            ))}
          </div>
        )}

        <form onSubmit={onAgregarAcceso} className="mt-4 grid gap-2 sm:grid-cols-[auto_1fr_auto_auto] sm:items-end">
          <div>
            <Label>Tipo</Label>
            <Select value={accesoTipo} onChange={(e) => setAccesoTipo(e.target.value as "correo" | "dominio")}>
              <option value="correo">Correo</option>
              <option value="dominio">Dominio</option>
            </Select>
          </div>
          <div>
            <Label>{accesoTipo === "correo" ? "Correo" : "Dominio"}</Label>
            <Input
              type="text"
              value={accesoValor}
              onChange={(e) => setAccesoValor(e.target.value)}
              placeholder={accesoTipo === "correo" ? "persona@tuempresa.cl" : "tuempresa.cl"}
            />
          </div>
          <div>
            <Label>Rol</Label>
            <Select value={accesoRol} onChange={(e) => setAccesoRol(e.target.value)}>
              {rolesDisponibles.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </Select>
          </div>
          <Button type="submit" disabled={guardandoAcceso || accesoValor.trim().length < 3}>
            {guardandoAcceso ? "Agregando…" : "Agregar"}
          </Button>
        </form>
        {errorAcceso && (
          <div className="mt-3">
            <ErrorText>{errorAcceso}</ErrorText>
          </div>
        )}
      </Card>

      {error && <ErrorText>{error}</ErrorText>}
      {usuarios === null && !error && <EstadoCargando />}
      {usuarios?.length === 0 && (
        <EstadoVacio icono={IconUsers} titulo="Todavía no hay nadie en el equipo" />
      )}
      {passwordGenerada && (
        <Card className="mb-4 border-brand/40 bg-brand-soft/20">
          <h2 className="text-sm font-semibold text-foreground">Contraseña nueva de {passwordGenerada.nombre}</h2>
          <p className="mt-1 text-xs text-muted">
            Pásasela a mano — no se guarda ni se envía por correo, y no vas a poder volver a verla. La contraseña anterior ya no
            funciona.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <code className="rounded-md bg-surface px-3 py-2 font-mono text-sm text-foreground">{passwordGenerada.password}</code>
            <Button type="button" variant="outline" onClick={() => navigator.clipboard.writeText(passwordGenerada.password)}>
              Copiar
            </Button>
            <Button type="button" variant="ghost" onClick={() => setPasswordGenerada(null)}>
              Listo
            </Button>
          </div>
        </Card>
      )}

      {usuarios && usuarios.length > 0 && (
        <Card className="overflow-x-auto p-0">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border bg-surface-sunken font-mono text-[10px] uppercase tracking-[0.1em] text-muted">
                <th className="px-5 py-3 font-medium">Nombre</th>
                <th className="px-5 py-3 font-medium">Correo</th>
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
                    <td className="px-5 py-3 text-muted">{u.correo ?? "—"}</td>
                    <td className="px-5 py-3">
                      <Select value={editRol} onChange={(e) => setEditRol(e.target.value)} className="min-w-36">
                        {rolesDisponibles.map((r) => (
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
                        <div className="flex flex-wrap justify-end gap-2">
                          <Button type="button" onClick={() => guardarEdicion(u)} disabled={guardando} className="px-3 py-1.5 text-xs">
                            {guardando ? "Guardando…" : "Guardar"}
                          </Button>
                          <Button type="button" variant="outline" onClick={() => setEditandoId(null)} className="px-3 py-1.5 text-xs">
                            Cancelar
                          </Button>
                          {u.rol !== "admin" && (
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => onRestablecerPassword(u)}
                              disabled={reseteandoId === u.id}
                              className="px-3 py-1.5 text-xs"
                            >
                              {reseteandoId === u.id ? "Generando…" : "Restablecer contraseña"}
                            </Button>
                          )}
                        </div>
                        {editError && <span className="text-xs text-danger">{editError}</span>}
                      </div>
                    </td>
                  </tr>
                ) : (
                  <tr key={u.id} className="border-b border-border-soft last:border-0 hover:bg-surface-sunken">
                    <td className="px-5 py-3 font-medium text-foreground">{u.nombre}</td>
                    <td className="px-5 py-3 text-muted">{u.correo ?? "—"}</td>
                    <td className="px-5 py-3">
                      <Badge value={etiquetaRol(u.rol)} />
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
              <tr className="border-b border-border bg-surface-sunken font-mono text-[10px] uppercase tracking-[0.1em] text-muted">
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
