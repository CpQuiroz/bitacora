"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Mail, Users } from "lucide-react";
import type { Usuario } from "@bitacora/shared";
import { supabase } from "@/lib/supabase";
import { apiFetch } from "@/lib/api";
import { useRolesDisponibles } from "@/lib/roles";
import { FUNCIONES } from "@/lib/funciones";
import { DashboardShell, type UsuarioShell } from "@/components/DashboardShell";
import { Button, Card, EmptyState, ErrorState, Input, LoadingState, Select, StatusBadge, Table, Tag } from "@bitacora/ui/web";

// Ficha única de personas — reemplaza Flota → Colaboradores, Grupo y
// usuario, y Remuneraciones → Datos del equipo. Esta pantalla lista al
// equipo y concentra las acciones que NO son de una persona concreta
// (invitar, accesos autorizados, historial) — todas gateadas por
// `gestion_control`. Lo de cada persona (rol, contrato, documentos…) va
// en su ficha: /dashboard/personas/[id].

type AccesoFila = { id: string; tipo: "correo" | "dominio"; valor: string; rol: string; creado_en: string };

// PASO 6 (sistema de diseño) — migrado. Ver docs/design-system.md.
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
      <p className="ds-heading text-ds-h2 text-ds-text">Personas</p>
      <p className="mt-ds-1 font-ds-body text-ds-small text-ds-text/70">El equipo de la empresa: identidad, acceso, datos laborales y documentos</p>

      {puedeGestionar && (
        <div className="my-ds-6">
          <Card>
            <p className="mb-ds-4 flex items-center gap-ds-2 font-ds-body text-ds-small font-semibold text-ds-text">
              <Mail size={16} strokeWidth={2.75} className="text-ds-brand" />
              Invitar a alguien nuevo
            </p>
            <form onSubmit={onInvitar} className="flex flex-col gap-ds-4">
              <div className="grid gap-ds-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <Input etiqueta="Correo" tipo="email" requerido valor={email} onCambio={setEmail} />
                </div>
                <Input etiqueta="Nombre" requerido valor={nombre} onCambio={setNombre} />
                <Select etiqueta="Rol" valor={rol} onCambio={setRol} opciones={rolesDisponibles.map((r) => ({ valor: r.value, etiqueta: r.label }))} />
                {rol === "colaborador" && (
                  <div className="flex flex-col gap-ds-1">
                    <Select
                      etiqueta="Función (opcional)"
                      valor={funcion}
                      onCambio={setFuncion}
                      opciones={[{ valor: "", etiqueta: "Sin definir" }, ...FUNCIONES.map((f) => ({ valor: f.value, etiqueta: f.label }))]}
                    />
                    <p className="font-ds-body text-ds-caption text-ds-text/60">Define qué ve en la app móvil (un chofer no ve Órdenes de servicio).</p>
                  </div>
                )}
                <div className="sm:col-span-2">
                  <Input etiqueta="Teléfono (opcional)" tipo="tel" placeholder="+56 9 1234 5678" valor={telefono} onCambio={setTelefono} />
                  <p className="mt-ds-1 font-ds-body text-ds-caption text-ds-text/60">Con código de país. Sirve para que un chofer use el bot de WhatsApp.</p>
                </div>
              </div>
              {formError ? <p className="font-ds-body text-ds-small text-ds-accent-700">{formError}</p> : null}
              {exito ? <p className="font-ds-body text-ds-small font-medium text-ds-accent2-800">{exito}</p> : null}
              <div>
                <Button tipo="submit" cargando={invitando}>
                  Invitar
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {error ? <ErrorState mensaje={error} /> : null}
      {usuarios === null && !error ? <LoadingState /> : null}
      {usuarios?.length === 0 && <EmptyState icono={<Users size={28} strokeWidth={2.75} />} titulo="Todavía no hay nadie en el equipo" />}

      {usuarios && usuarios.length > 0 && (
        <div className="my-ds-6">
          <Table<Usuario & { correo?: string | null }>
            filas={usuarios}
            claveFila={(u) => u.id}
            onFilaClick={(u) => router.push(`/dashboard/personas/${u.id}`)}
            vacio={{ titulo: "Todavía no hay nadie en el equipo" }}
            columnas={[
              { encabezado: "Nombre", celda: (u) => u.nombre },
              ...(puedeGestionar ? [{ encabezado: "Correo", celda: (u: Usuario & { correo?: string | null }) => u.correo ?? "—" }] : []),
              { encabezado: "Rol", celda: (u) => <Tag>{etiquetaRol(u.rol)}</Tag> },
              { encabezado: "Estado", celda: (u) => <StatusBadge estado={u.activo ? "activo" : "inactivo"} /> },
              { encabezado: "", celda: () => <span className="font-ds-body text-ds-caption font-medium text-ds-brand">Ver ficha →</span> },
            ]}
          />
        </div>
      )}

      {puedeGestionar && (
        <div className="my-ds-6">
          <Card>
            <p className="mb-ds-1 font-ds-body text-ds-small font-semibold text-ds-text">Correos y dominios autorizados</p>
            <p className="mb-ds-4 font-ds-body text-ds-small text-ds-text/70">
              Un correo (<code>persona@tuempresa.cl</code>) o un dominio entero (<code>tuempresa.cl</code>) de esta lista puede entrar
              a la empresa sin invitación — la primera vez que inicia sesión se le crea el usuario con el rol indicado. Un correo que
              no está acá ni fue invitado no puede entrar.
            </p>

            {accesos === null ? (
              <LoadingState />
            ) : accesos.length === 0 ? (
              <p className="font-ds-body text-ds-small text-ds-text/70">Sin correos ni dominios autorizados.</p>
            ) : (
              <div className="flex flex-col gap-ds-2">
                {accesos.map((a) => (
                  <div key={a.id} className="flex items-center justify-between gap-ds-3 rounded-ds-md border border-ds-divider px-ds-3 py-ds-2 font-ds-body text-ds-small">
                    <span className="flex flex-wrap items-center gap-ds-2">
                      <Tag tono="outline">{a.tipo}</Tag>
                      <span className="font-mono text-ds-text">{a.valor}</span>
                      <span className="text-ds-text/60">→ {etiquetaRol(a.rol)}</span>
                    </span>
                    <Button variante="ghost" onPress={() => onQuitarAcceso(a.id)}>
                      Quitar
                    </Button>
                  </div>
                ))}
              </div>
            )}

            <form onSubmit={onAgregarAcceso} className="mt-ds-4 grid gap-ds-2 sm:grid-cols-[auto_1fr_auto_auto] sm:items-end">
              <Select etiqueta="Tipo" valor={accesoTipo} onCambio={(v) => setAccesoTipo(v as "correo" | "dominio")} opciones={[{ valor: "correo", etiqueta: "Correo" }, { valor: "dominio", etiqueta: "Dominio" }]} />
              <Input etiqueta={accesoTipo === "correo" ? "Correo" : "Dominio"} valor={accesoValor} onCambio={setAccesoValor} placeholder={accesoTipo === "correo" ? "persona@tuempresa.cl" : "tuempresa.cl"} />
              <Select etiqueta="Rol" valor={accesoRol} onCambio={setAccesoRol} opciones={rolesDisponibles.map((r) => ({ valor: r.value, etiqueta: r.label }))} />
              <Button tipo="submit" deshabilitado={guardandoAcceso || accesoValor.trim().length < 3} cargando={guardandoAcceso}>
                Agregar
              </Button>
            </form>
            {errorAcceso ? <p className="mt-ds-3 font-ds-body text-ds-small text-ds-accent-700">{errorAcceso}</p> : null}
          </Card>
        </div>
      )}
    </DashboardShell>
  );
}
