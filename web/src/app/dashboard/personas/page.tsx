"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import type { Usuario } from "@bitacora/shared";
import { supabase } from "@/lib/supabase";
import { apiFetch } from "@/lib/api";
import { useRolesDisponibles } from "@/lib/roles";
import { FUNCIONES } from "@/lib/funciones";
import { DashboardShell, type UsuarioShell } from "@/components/DashboardShell";
import { Badge, Button, Card, ErrorText, Input, Label, PageHeader, Select, SuccessText } from "@/components/ui";
import { IconMail, IconUsers } from "@/components/icons";
import { EstadoCargando, EstadoVacio } from "@/components/estados";

// Ficha única de personas — reemplaza Flota → Colaboradores, Grupo y
// usuario, y Remuneraciones → Datos del equipo. Esta pantalla lista al
// equipo y concentra las acciones que NO son de una persona concreta
// (invitar, accesos autorizados, historial) — todas gateadas por
// `gestion_control`. Lo de cada persona (rol, contrato, documentos…) va
// en su ficha: /dashboard/personas/[id].

type AccesoFila = { id: string; tipo: "correo" | "dominio"; valor: string; rol: string; creado_en: string };

export default function PersonasPage() {
  const router = useRouter();
  const [usuario, setUsuario] = useState<UsuarioShell | null>(null);
  const [puedeGestionar, setPuedeGestionar] = useState(false);
  const [usuarios, setUsuarios] = useState<(Usuario & { correo?: string | null })[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const rolesDisponibles = useRolesDisponibles();
  const etiquetaRol = (slug: string) => rolesDisponibles.find((r) => r.value === slug)?.label ?? slug;

  // Invitar
  const [email, setEmail] = useState("");
  const [nombre, setNombre] = useState("");
  const [telefono, setTelefono] = useState("");
  const [rol, setRol] = useState("colaborador");
  const [funcion, setFuncion] = useState("");
  const [invitando, setInvitando] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [exito, setExito] = useState<string | null>(null);

  // Accesos autorizados
  const [accesos, setAccesos] = useState<AccesoFila[] | null>(null);
  const [accesoTipo, setAccesoTipo] = useState<"correo" | "dominio">("correo");
  const [accesoValor, setAccesoValor] = useState("");
  const [accesoRol, setAccesoRol] = useState("colaborador");
  const [guardandoAcceso, setGuardandoAcceso] = useState(false);
  const [errorAcceso, setErrorAcceso] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      router.replace("/login");
      return;
    }
    const [resMe, resConCorreo] = await Promise.all([apiFetch("/api/me"), apiFetch("/api/usuarios?con_correo=1")]);
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

    if (resConCorreo.ok) {
      setPuedeGestionar(true);
      setUsuarios(await resConCorreo.json());
      const resAccesos = await apiFetch("/api/accesos");
      if (resAccesos.ok) setAccesos((await resAccesos.json()).accesos ?? []);
    } else {
      // Sin gestion_control (supervisor/contador): la lista base igual se
      // puede ver, solo sin la columna de correo ni las acciones de admin.
      const resPlano = await apiFetch("/api/usuarios");
      if (!resPlano.ok) {
        setError("No se pudo cargar el equipo");
        return;
      }
      setUsuarios(await resPlano.json());
    }
  }, [router]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  async function onInvitar(e: FormEvent) {
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
      setFormError(body.error ?? "No se pudo invitar");
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
    const resAccesos = await apiFetch("/api/accesos");
    if (resAccesos.ok) setAccesos((await resAccesos.json()).accesos ?? []);
  }

  async function onQuitarAcceso(id: string) {
    setErrorAcceso(null);
    const res = await apiFetch(`/api/accesos/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setErrorAcceso(body.error ?? "No se pudo quitar");
      return;
    }
    setAccesos((prev) => (prev ? prev.filter((a) => a.id !== id) : prev));
  }

  if (!usuario) return null;

  return (
    <DashboardShell usuario={usuario}>
      <PageHeader title="Personas" subtitle="El equipo de la empresa: identidad, acceso, datos laborales y documentos" />

      {puedeGestionar && (
        <Card className="my-6">
          <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-foreground">
            <IconMail className="h-4 w-4 text-brand" />
            Invitar a alguien nuevo
          </h2>
          <form onSubmit={onInvitar} className="flex flex-col gap-4">
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
                <Input type="tel" placeholder="+56 9 1234 5678" value={telefono} onChange={(e) => setTelefono(e.target.value)} />
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
      )}

      {error && <ErrorText>{error}</ErrorText>}
      {usuarios === null && !error && <EstadoCargando />}
      {usuarios?.length === 0 && <EstadoVacio icono={IconUsers} titulo="Todavía no hay nadie en el equipo" />}

      {usuarios && usuarios.length > 0 && (
        <Card className="my-6 overflow-x-auto p-0">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border bg-surface-sunken font-mono text-[10px] uppercase tracking-[0.1em] text-muted">
                <th className="px-5 py-3 font-medium">Nombre</th>
                {puedeGestionar && <th className="px-5 py-3 font-medium">Correo</th>}
                <th className="px-5 py-3 font-medium">Rol</th>
                <th className="px-5 py-3 font-medium">Estado</th>
                <th className="px-5 py-3 font-medium" />
              </tr>
            </thead>
            <tbody>
              {usuarios.map((u) => (
                <tr
                  key={u.id}
                  onClick={() => router.push(`/dashboard/personas/${u.id}`)}
                  className="cursor-pointer border-b border-border-soft last:border-0 hover:bg-surface-sunken"
                >
                  <td className="px-5 py-3 font-medium text-foreground">{u.nombre}</td>
                  {puedeGestionar && <td className="px-5 py-3 text-muted">{u.correo ?? "—"}</td>}
                  <td className="px-5 py-3">
                    <Badge value={etiquetaRol(u.rol)} />
                  </td>
                  <td className="px-5 py-3">
                    <Badge value={u.activo ? "activo" : "inactivo"} />
                  </td>
                  <td className="px-5 py-3 text-right">
                    <span className="text-xs font-medium text-brand">Ver ficha →</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {puedeGestionar && (
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
      )}
    </DashboardShell>
  );
}
