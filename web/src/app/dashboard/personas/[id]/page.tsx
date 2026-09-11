"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Calendar, ChevronLeft } from "lucide-react";
import type { AuditoriaUsuario, DatosLaborales, Modulo, RutaPlanificada, Usuario } from "@bitacora/shared";
import { AFP_CHILE, ISAPRES_CHILE, REGIONES } from "@bitacora/shared";
import { supabase } from "@/lib/supabase";
import { apiFetch } from "@/lib/api";
import { useRolesDisponibles } from "@/lib/roles";
import { FUNCIONES } from "@/lib/funciones";
import { remuneraciones } from "@/lib/remuneracionesApi";
import { DashboardShell, type UsuarioShell } from "@/components/DashboardShell";
import { Button, Card, Input, LoadingState, Select, StatusBadge } from "@bitacora/ui/web";
import { InputMonto } from "@/components/InputMonto";
import { DocumentoForm } from "@/components/DocumentoForm";

// Ficha única de una persona. Cada pestaña conserva el gate de módulo
// que tenía su pantalla original:
//   Identidad         → editable con "flota" (endpoint /api/usuarios/:id/zona)
//   Acceso y permisos → "gestion_control"
//   Datos laborales   → "remuneraciones"
//   Documentos        → "flota"

type PestanaId = "identidad" | "acceso" | "laboral" | "documentos";

type AuditoriaFila = AuditoriaUsuario & {
  usuario_afectado: { nombre: string } | null;
  realizado_por: { nombre: string } | null;
};

const CAMPO_LABEL: Record<string, string> = { rol: "Rol", activo: "Estado", clave: "Contraseña" };
const DIAS: Record<string, string> = { lunes: "Lun", martes: "Mar", miercoles: "Mié", jueves: "Jue", viernes: "Vie", sabado: "Sáb", domingo: "Dom" };

function formatCampoValor(campo: string, valor: string | null) {
  if (valor === null) return "—";
  if (campo === "activo") return valor === "true" ? "Activo" : "Inactivo";
  return valor;
}

const LABORAL_VACIO = {
  rut: "",
  apellido_paterno: "",
  apellido_materno: "",
  tipo_contrato: "indefinido",
  fecha_ingreso: "",
  sueldo_base: "",
  gratificacion_legal: true,
  colacion_mensual: "",
  movilizacion_mensual: "",
  afp: "",
  sistema_salud: "fonasa",
  plan_isapre_uf: "",
  codigo_isapre: "",
  cargas_familiares: "",
};

// PASO 6 (sistema de diseño) — migrado. Ver docs/design-system.md.
export default function PersonaFichaPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();

  const [usuario, setUsuario] = useState<UsuarioShell | null>(null);
  const [modulos, setModulos] = useState<Modulo[] | null>(null);
  const [yoId, setYoId] = useState<string | null>(null);
  const [persona, setPersona] = useState<Usuario | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pestana, setPestana] = useState<PestanaId>("identidad");

  const rolesDisponibles = useRolesDisponibles();
  const etiquetaRol = (slug: string) => rolesDisponibles.find((r) => r.value === slug)?.label ?? slug;

  const ve = (m: Modulo) => modulos?.includes(m) ?? false;

  // ── Identidad ──
  const [nombre, setNombre] = useState("");
  const [telefono, setTelefono] = useState("");
  const [funcion, setFuncion] = useState("");
  const [zona, setZona] = useState("");
  const [rutas, setRutas] = useState<RutaPlanificada[]>([]);
  const [guardandoId, setGuardandoId] = useState(false);
  const [avisoId, setAvisoId] = useState<string | null>(null);
  const [errorId, setErrorId] = useState<string | null>(null);

  // ── Acceso y permisos ──
  const [editRol, setEditRol] = useState("colaborador");
  const [editActivo, setEditActivo] = useState(true);
  const [guardandoAcc, setGuardandoAcc] = useState(false);
  const [errorAcc, setErrorAcc] = useState<string | null>(null);
  const [avisoAcc, setAvisoAcc] = useState<string | null>(null);
  const [reseteando, setReseteando] = useState(false);
  const [passwordGenerada, setPasswordGenerada] = useState<string | null>(null);
  const [auditoria, setAuditoria] = useState<AuditoriaFila[]>([]);

  // ── Datos laborales ──
  const [laboral, setLaboral] = useState<DatosLaborales | null>(null);
  const [formLaboral, setFormLaboral] = useState<Record<string, unknown>>(LABORAL_VACIO);
  const [guardandoLab, setGuardandoLab] = useState(false);
  const [errorLab, setErrorLab] = useState<string | null>(null);
  const [avisoLab, setAvisoLab] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      router.replace("/login");
      return;
    }
    const [resMe, resUsuarios] = await Promise.all([apiFetch("/api/me"), apiFetch("/api/usuarios")]);
    let mods: Modulo[] = [];
    if (resMe.ok) {
      const body = await resMe.json();
      const u = body.usuario;
      if (u) {
        setYoId(u.id);
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
      if (Array.isArray(body.modulos_visibles)) mods = body.modulos_visibles;
      setModulos(mods);
    }

    if (!resUsuarios.ok) {
      setError("No se pudo cargar la persona");
      return;
    }
    const todos: Usuario[] = await resUsuarios.json();
    const p = todos.find((u2) => u2.id === params.id);
    if (!p) {
      setError("Persona no encontrada");
      return;
    }
    setPersona(p);
    setNombre(p.nombre ?? "");
    setTelefono(p.telefono ?? "");
    setFuncion(p.funcion ?? "");
    setZona(p.zona ?? "");
    setEditRol(p.rol);
    setEditActivo(p.activo);

    if (mods.includes("flota")) {
      const resRutas = await apiFetch("/api/rutas-planificadas");
      if (resRutas.ok) {
        const todasRutas: RutaPlanificada[] = await resRutas.json();
        setRutas(todasRutas.filter((r) => r.responsable_id === params.id));
      }
    }
    if (mods.includes("gestion_control")) {
      const resAud = await apiFetch("/api/usuarios/auditoria");
      if (resAud.ok) {
        const todas: AuditoriaFila[] = await resAud.json();
        setAuditoria(todas.filter((a) => a.usuario_afectado_id === params.id));
      }
    }
    if (mods.includes("remuneraciones")) {
      try {
        const filas = await remuneraciones.datosLaborales();
        const fila = filas.find((f) => f.usuario.id === params.id);
        const d = fila?.datos_laborales ?? null;
        setLaboral(d);
        setFormLaboral(
          d
            ? {
                rut: fila?.usuario.rut ?? "",
                apellido_paterno: d.apellido_paterno ?? "",
                apellido_materno: d.apellido_materno ?? "",
                tipo_contrato: d.tipo_contrato,
                fecha_ingreso: d.fecha_ingreso ?? "",
                sueldo_base: String(d.sueldo_base || ""),
                gratificacion_legal: d.gratificacion_legal,
                colacion_mensual: String(d.colacion_mensual || ""),
                movilizacion_mensual: String(d.movilizacion_mensual || ""),
                afp: d.afp ?? "",
                sistema_salud: d.sistema_salud,
                plan_isapre_uf: d.plan_isapre_uf ? String(d.plan_isapre_uf) : "",
                codigo_isapre: d.codigo_isapre ?? "",
                cargas_familiares: String(d.cargas_familiares || ""),
              }
            : { ...LABORAL_VACIO, rut: fila?.usuario.rut ?? "" }
        );
      } catch {
        /* módulo activo pero sin permiso fino: se ignora */
      }
    }
  }, [params.id, router]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  async function guardarIdentidad() {
    setErrorId(null);
    setAvisoId(null);
    if (!nombre.trim()) {
      setErrorId("El nombre no puede quedar vacío");
      return;
    }
    setGuardandoId(true);
    const res = await apiFetch(`/api/usuarios/${params.id}/zona`, {
      method: "PATCH",
      body: JSON.stringify({ nombre: nombre.trim(), telefono: telefono.trim(), funcion, zona }),
    });
    setGuardandoId(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setErrorId(body.error ?? "No se pudo guardar");
      return;
    }
    setAvisoId("Datos actualizados");
    cargar();
  }

  async function guardarAcceso() {
    if (!persona) return;
    setErrorAcc(null);
    setAvisoAcc(null);
    const cambios: Record<string, unknown> = {};
    if (editRol !== persona.rol) cambios.rol = editRol;
    if (editActivo !== persona.activo) cambios.activo = editActivo;
    if (Object.keys(cambios).length === 0) {
      setAvisoAcc("Sin cambios");
      return;
    }
    setGuardandoAcc(true);
    const res = await apiFetch(`/api/usuarios/${params.id}`, { method: "PATCH", body: JSON.stringify(cambios) });
    setGuardandoAcc(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setErrorAcc(body.error ?? "No se pudo actualizar");
      return;
    }
    setAvisoAcc("Cambios guardados");
    cargar();
  }

  async function restablecerPassword() {
    if (!persona) return;
    if (!confirm(`¿Generar una contraseña nueva para ${persona.nombre}? La actual deja de funcionar de inmediato.`)) return;
    setReseteando(true);
    setErrorAcc(null);
    const res = await apiFetch(`/api/usuarios/${params.id}/restablecer-password`, { method: "POST" });
    setReseteando(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setErrorAcc(body.error ?? "No se pudo restablecer la contraseña");
      return;
    }
    const body = await res.json();
    setPasswordGenerada(body.password);
  }

  async function guardarLaboral() {
    setGuardandoLab(true);
    setErrorLab(null);
    setAvisoLab(null);
    try {
      await remuneraciones.guardarDatosLaborales(params.id, formLaboral);
      setAvisoLab("Datos guardados");
      await cargar();
    } catch (e) {
      setErrorLab(e instanceof Error ? e.message : "No se pudo guardar");
    } finally {
      setGuardandoLab(false);
    }
  }

  const setL = (k: string, v: unknown) => setFormLaboral((f) => ({ ...f, [k]: v }));

  if (!usuario) return null;
  if (error) {
    return (
      <DashboardShell usuario={usuario}>
        <p className="font-ds-body text-ds-small text-ds-accent-700">{error}</p>
      </DashboardShell>
    );
  }
  if (!persona || modulos === null) {
    return (
      <DashboardShell usuario={usuario}>
        <LoadingState />
      </DashboardShell>
    );
  }

  const puedeEditarIdentidad = ve("flota");
  const pestanas = (
    [
      { id: "identidad", label: "Identidad", visible: true },
      { id: "acceso", label: "Acceso y permisos", visible: ve("gestion_control") },
      { id: "laboral", label: "Datos laborales", visible: ve("remuneraciones") },
      { id: "documentos", label: "Documentos", visible: ve("flota") },
    ] as { id: PestanaId; label: string; visible: boolean }[]
  ).filter((p) => p.visible);

  const pestanaActiva = pestanas.some((p) => p.id === pestana) ? pestana : "identidad";

  return (
    <DashboardShell usuario={usuario}>
      <Link href="/dashboard/personas" className="mb-ds-4 inline-flex items-center gap-ds-1 font-ds-body text-ds-small font-medium text-ds-brand hover:underline">
        <ChevronLeft size={16} strokeWidth={2.75} />
        Personas
      </Link>

      <div className="flex flex-wrap items-center justify-between gap-ds-3">
        <div>
          <p className="ds-heading text-ds-h2 text-ds-text">{persona.nombre}</p>
          <p className="mt-ds-1 font-ds-body text-ds-small text-ds-text/70">
            {etiquetaRol(persona.rol)}
            {persona.telefono ? ` · ${persona.telefono}` : ""}
          </p>
        </div>
        <StatusBadge estado={persona.activo ? "activo" : "inactivo"} />
      </div>

      <div className="mt-ds-6 flex flex-wrap gap-ds-1 border-b border-ds-divider">
        {pestanas.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => setPestana(p.id)}
            className={`-mb-px border-b-2 px-ds-3 py-2 font-ds-body text-ds-small font-medium transition-colors ${
              pestanaActiva === p.id ? "border-ds-brand text-ds-brand" : "border-transparent text-ds-text/60 hover:text-ds-text"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* ── Identidad ── */}
      {pestanaActiva === "identidad" && (
        <div className="my-ds-6 grid gap-ds-6 lg:grid-cols-2">
          <Card>
            <p className="mb-ds-4 font-ds-body text-ds-small font-semibold text-ds-text">Datos de la persona</p>
            <div className="flex flex-col gap-ds-4">
              <Input etiqueta="Nombre" valor={nombre} deshabilitado={!puedeEditarIdentidad} onCambio={setNombre} />
              <div className="flex flex-col gap-ds-1">
                <Input etiqueta="Teléfono" tipo="tel" placeholder="+56 9 1234 5678" valor={telefono} deshabilitado={!puedeEditarIdentidad} onCambio={setTelefono} />
                <p className="font-ds-body text-ds-caption text-ds-text/60">Con código de país. Necesario para que use el bot de WhatsApp.</p>
              </div>
              <div className="flex flex-col gap-ds-1">
                <Select
                  etiqueta="Función"
                  valor={funcion}
                  deshabilitado={!puedeEditarIdentidad}
                  onCambio={setFuncion}
                  opciones={[{ valor: "", etiqueta: "Sin definir" }, ...FUNCIONES.map((f) => ({ valor: f.value, etiqueta: f.label }))]}
                />
                <p className="font-ds-body text-ds-caption text-ds-text/60">Define qué pestañas ve en la app móvil.</p>
              </div>
              <Select
                etiqueta="Zona / área de cobertura"
                valor={zona}
                deshabilitado={!puedeEditarIdentidad}
                onCambio={setZona}
                opciones={[
                  { valor: "", etiqueta: "Sin zona" },
                  ...REGIONES.map((r) => ({ valor: r, etiqueta: r })),
                  ...(zona && !REGIONES.includes(zona) ? [{ valor: zona, etiqueta: `${zona} (actual)` }] : []),
                ]}
              />
            </div>
            {!puedeEditarIdentidad && <p className="mt-ds-3 font-ds-body text-ds-caption text-ds-text/60">Solo lectura — editar identidad requiere el módulo de Flota.</p>}
            {errorId ? <p className="mt-ds-3 font-ds-body text-ds-small text-ds-accent-700">{errorId}</p> : null}
            {avisoId ? <p className="mt-ds-3 font-ds-body text-ds-small font-medium text-ds-accent2-800">{avisoId}</p> : null}
            {puedeEditarIdentidad && (
              <div className="mt-ds-4">
                <Button onPress={guardarIdentidad} cargando={guardandoId}>
                  Guardar
                </Button>
              </div>
            )}
          </Card>

          <Card>
            <p className="mb-ds-4 flex items-center gap-ds-2 font-ds-body text-ds-small font-semibold text-ds-text">
              <Calendar size={16} strokeWidth={2.75} className="text-ds-brand" />
              Jornada / rutas planificadas
            </p>
            {!ve("flota") ? (
              <p className="font-ds-body text-ds-small text-ds-text/70">Requiere el módulo de Flota.</p>
            ) : rutas.length === 0 ? (
              <p className="font-ds-body text-ds-small text-ds-text/70">
                Sin rutas planificadas asignadas — se configuran en{" "}
                <Link href="/dashboard/rutas" className="font-medium text-ds-brand hover:underline">
                  Rutas
                </Link>
                .
              </p>
            ) : (
              <div className="flex flex-col gap-ds-3">
                {rutas.map((r) => (
                  <div key={r.id} className="border-b border-ds-divider pb-ds-3 last:border-0">
                    <p className="font-ds-body text-ds-small font-medium text-ds-text">{r.nombre ?? "Ruta sin nombre"}</p>
                    <p className="font-ds-body text-ds-caption text-ds-text/60">
                      {r.dias_semana.map((d) => DIAS[d] ?? d).join(", ")} · {r.hora_inicio}–{r.hora_fin}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      )}

      {/* ── Acceso y permisos ── */}
      {pestanaActiva === "acceso" && ve("gestion_control") && (
        <div className="my-ds-6 flex flex-col gap-ds-6">
          <Card>
            <p className="mb-ds-4 font-ds-body text-ds-small font-semibold text-ds-text">Rol y estado</p>
            {persona.id === yoId ? (
              <p className="font-ds-body text-ds-small text-ds-text/70">No puedes cambiar tu propio rol ni tu estado.</p>
            ) : (
              <div className="flex flex-col gap-ds-4">
                <div className="grid gap-ds-4 sm:grid-cols-2">
                  <Select etiqueta="Rol" valor={editRol} onCambio={setEditRol} opciones={rolesDisponibles.map((r) => ({ valor: r.value, etiqueta: r.label }))} />
                  <label className="flex items-center gap-ds-2 self-end pb-2.5 font-ds-body text-ds-small text-ds-text">
                    <input type="checkbox" className="accent-[var(--ds-brand)]" checked={editActivo} onChange={(e) => setEditActivo(e.target.checked)} />
                    Activo
                  </label>
                </div>
                {errorAcc ? <p className="font-ds-body text-ds-small text-ds-accent-700">{errorAcc}</p> : null}
                {avisoAcc ? <p className="font-ds-body text-ds-small font-medium text-ds-accent2-800">{avisoAcc}</p> : null}
                <div className="flex flex-wrap gap-ds-2">
                  <Button onPress={guardarAcceso} cargando={guardandoAcc}>
                    Guardar
                  </Button>
                  {persona.rol !== "admin" && (
                    <Button variante="secundario" onPress={restablecerPassword} cargando={reseteando}>
                      Restablecer contraseña
                    </Button>
                  )}
                </div>
              </div>
            )}

            {passwordGenerada && (
              <div className="mt-ds-4 rounded-ds-md border border-ds-brand/40 bg-ds-brand/[0.06] p-ds-4">
                <p className="font-ds-body text-ds-small font-semibold text-ds-text">Contraseña nueva de {persona.nombre}</p>
                <p className="mt-ds-1 font-ds-body text-ds-caption text-ds-text/60">
                  Pásasela a mano — no se guarda ni se envía por correo, y no vas a poder volver a verla. La contraseña anterior ya
                  no funciona.
                </p>
                <div className="mt-ds-3 flex flex-wrap items-center gap-ds-2">
                  <code className="rounded-ds-md bg-ds-surface px-ds-3 py-ds-2 font-mono text-ds-small text-ds-text">{passwordGenerada}</code>
                  <Button variante="secundario" onPress={() => navigator.clipboard.writeText(passwordGenerada)}>
                    Copiar
                  </Button>
                  <Button variante="ghost" onPress={() => setPasswordGenerada(null)}>
                    Listo
                  </Button>
                </div>
              </div>
            )}
          </Card>

          {auditoria.length > 0 && (
            <Card sinRelleno elevacion="sm">
              <p className="px-ds-4 pt-ds-4 font-ds-body text-ds-small font-semibold text-ds-text">Historial de cambios</p>
              <div className="mt-ds-3 overflow-x-auto">
                <table className="w-full text-left text-ds-body">
                  <thead>
                    <tr className="border-b border-ds-divider text-[11px] font-medium uppercase tracking-[0.08em] text-ds-text/60">
                      <th className="px-ds-4 py-ds-3">Campo</th>
                      <th className="px-ds-4 py-ds-3">Cambio</th>
                      <th className="px-ds-4 py-ds-3">Realizado por</th>
                      <th className="px-ds-4 py-ds-3">Fecha</th>
                    </tr>
                  </thead>
                  <tbody>
                    {auditoria.map((a) => (
                      <tr key={a.id} className="border-b border-ds-text/[0.08] text-ds-text/70 last:border-0">
                        <td className="px-ds-4 py-ds-3">{CAMPO_LABEL[a.campo] ?? a.campo}</td>
                        <td className="px-ds-4 py-ds-3">
                          {formatCampoValor(a.campo, a.valor_anterior)} → {formatCampoValor(a.campo, a.valor_nuevo)}
                        </td>
                        <td className="px-ds-4 py-ds-3">{a.realizado_por?.nombre ?? "—"}</td>
                        <td className="px-ds-4 py-ds-3">{new Date(a.creado_en).toLocaleString("es-CL")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </div>
      )}

      {/* ── Datos laborales ── */}
      {pestanaActiva === "laboral" && ve("remuneraciones") && (
        <div className="my-ds-6">
          <Card>
            <p className="mb-ds-1 font-ds-body text-ds-small font-semibold text-ds-text">Contrato, previsión y haberes fijos</p>
            <p className="mb-ds-4 font-ds-body text-ds-small text-ds-text/70">
              Lo que la liquidación necesita y no vive en la identidad. {laboral ? "" : "Aún sin configurar."}
            </p>
            <div className="grid gap-ds-3 sm:grid-cols-2 lg:grid-cols-3">
              <Input etiqueta="RUT" placeholder="12.345.678-9" valor={String(formLaboral.rut)} onCambio={(v) => setL("rut", v)} />
              <Input etiqueta="Apellido paterno" valor={String(formLaboral.apellido_paterno)} onCambio={(v) => setL("apellido_paterno", v)} />
              <Input etiqueta="Apellido materno" valor={String(formLaboral.apellido_materno)} onCambio={(v) => setL("apellido_materno", v)} />
              <Select
                etiqueta="Tipo de contrato"
                valor={String(formLaboral.tipo_contrato)}
                onCambio={(v) => setL("tipo_contrato", v)}
                opciones={[
                  { valor: "indefinido", etiqueta: "Indefinido" },
                  { valor: "plazo_fijo", etiqueta: "Plazo fijo" },
                  { valor: "por_obra", etiqueta: "Por obra / faena" },
                ]}
              />
              <FechaCampo etiqueta="Fecha de ingreso" valor={String(formLaboral.fecha_ingreso)} onCambio={(v) => setL("fecha_ingreso", v)} />
              <div className="flex flex-col gap-ds-1">
                <label className="font-ds-body text-ds-caption font-medium text-ds-text/70">Sueldo base ($)</label>
                <InputMonto value={String(formLaboral.sueldo_base)} onChange={(v) => setL("sueldo_base", v)} moneda={usuario?.moneda} />
              </div>
              <div className="flex flex-col gap-ds-1">
                <label className="font-ds-body text-ds-caption font-medium text-ds-text/70">Colación mensual ($)</label>
                <InputMonto value={String(formLaboral.colacion_mensual)} onChange={(v) => setL("colacion_mensual", v)} moneda={usuario?.moneda} />
              </div>
              <div className="flex flex-col gap-ds-1">
                <label className="font-ds-body text-ds-caption font-medium text-ds-text/70">Movilización mensual ($)</label>
                <InputMonto value={String(formLaboral.movilizacion_mensual)} onChange={(v) => setL("movilizacion_mensual", v)} moneda={usuario?.moneda} />
              </div>
              <Select
                etiqueta="AFP"
                valor={String(formLaboral.afp)}
                onCambio={(v) => setL("afp", v)}
                opciones={[{ valor: "", etiqueta: "Sin AFP" }, ...AFP_CHILE.map((a) => ({ valor: a.afp, etiqueta: a.nombre }))]}
              />
              <Select
                etiqueta="Sistema de salud"
                valor={String(formLaboral.sistema_salud)}
                onCambio={(v) => setL("sistema_salud", v)}
                opciones={[
                  { valor: "fonasa", etiqueta: "Fonasa" },
                  { valor: "isapre", etiqueta: "Isapre" },
                ]}
              />
              {formLaboral.sistema_salud === "isapre" && (
                <>
                  <Input etiqueta="Plan Isapre (UF)" tipo="numero" valor={String(formLaboral.plan_isapre_uf)} onCambio={(v) => setL("plan_isapre_uf", v)} />
                  <Select
                    etiqueta="Isapre"
                    valor={String(formLaboral.codigo_isapre)}
                    onCambio={(v) => setL("codigo_isapre", v)}
                    opciones={[{ valor: "", etiqueta: "Elegir…" }, ...ISAPRES_CHILE.map((i) => ({ valor: i.codigo, etiqueta: i.nombre }))]}
                  />
                </>
              )}
              <Input etiqueta="Cargas familiares" tipo="numero" valor={String(formLaboral.cargas_familiares)} onCambio={(v) => setL("cargas_familiares", v)} />
              <label className="flex items-center gap-ds-2 self-end pb-2.5 font-ds-body text-ds-small text-ds-text">
                <input type="checkbox" className="accent-[var(--ds-brand)]" checked={Boolean(formLaboral.gratificacion_legal)} onChange={(e) => setL("gratificacion_legal", e.target.checked)} />
                Paga gratificación (Art. 50)
              </label>
            </div>
            {errorLab ? <p className="mt-ds-3 font-ds-body text-ds-small text-ds-accent-700">{errorLab}</p> : null}
            {avisoLab ? <p className="mt-ds-3 font-ds-body text-ds-small font-medium text-ds-accent2-800">{avisoLab}</p> : null}
            <div className="mt-ds-4">
              <Button onPress={guardarLaboral} cargando={guardandoLab}>
                Guardar
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* ── Documentos ── */}
      {pestanaActiva === "documentos" && ve("flota") && (
        <div className="my-ds-6">
          <DocumentoForm entidadTipo="colaborador" entidadId={persona.id} />
        </div>
      )}
    </DashboardShell>
  );
}

// Input nativo type="date" — ver el mismo helper en rutas/nueva/page.tsx.
function FechaCampo({ etiqueta, valor, onCambio }: { etiqueta: string; valor: string; onCambio: (v: string) => void }) {
  return (
    <div className="flex flex-col gap-ds-1">
      <label className="font-ds-body text-ds-caption font-medium text-ds-text/70">{etiqueta}</label>
      <input
        type="date"
        value={valor}
        onChange={(e) => onCambio(e.target.value)}
        className="h-11 w-full rounded-ds-md border border-ds-divider bg-ds-surface px-ds-3 font-ds-body text-ds-body text-ds-text transition-colors hover:border-ds-text/30 focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ds-brand)]"
      />
    </div>
  );
}
