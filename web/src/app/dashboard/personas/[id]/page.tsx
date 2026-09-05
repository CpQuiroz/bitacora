"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import type { AuditoriaUsuario, DatosLaborales, Modulo, RutaPlanificada, Usuario } from "@bitacora/shared";
import { AFP_CHILE, ISAPRES_CHILE, REGIONES } from "@bitacora/shared";
import { supabase } from "@/lib/supabase";
import { apiFetch } from "@/lib/api";
import { useRolesDisponibles } from "@/lib/roles";
import { FUNCIONES } from "@/lib/funciones";
import { remuneraciones } from "@/lib/remuneracionesApi";
import { DashboardShell, type UsuarioShell } from "@/components/DashboardShell";
import { Badge, Button, Card, ErrorText, Input, Label, PageHeader, Select, SuccessText } from "@/components/ui";
import { DocumentoForm } from "@/components/DocumentoForm";
import { IconCalendar, IconChevronLeft } from "@/components/icons";
import { EstadoCargando } from "@/components/estados";

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
        <ErrorText>{error}</ErrorText>
      </DashboardShell>
    );
  }
  if (!persona || modulos === null) {
    return (
      <DashboardShell usuario={usuario}>
        <EstadoCargando />
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
      <Link href="/dashboard/personas" className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-brand hover:underline">
        <IconChevronLeft className="h-4 w-4" />
        Personas
      </Link>

      <PageHeader
        title={persona.nombre}
        subtitle={`${etiquetaRol(persona.rol)}${persona.telefono ? ` · ${persona.telefono}` : ""}`}
        action={<Badge value={persona.activo ? "activo" : "inactivo"} />}
      />

      <div className="mt-6 flex flex-wrap gap-1 border-b border-border">
        {pestanas.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => setPestana(p.id)}
            className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
              pestanaActiva === p.id
                ? "border-brand text-brand"
                : "border-transparent text-muted hover:text-foreground"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* ── Identidad ── */}
      {pestanaActiva === "identidad" && (
        <div className="my-6 grid gap-6 lg:grid-cols-2">
          <Card>
            <h2 className="mb-4 text-sm font-semibold text-foreground">Datos de la persona</h2>
            <div className="flex flex-col gap-4">
              <div>
                <Label>Nombre</Label>
                <Input type="text" value={nombre} disabled={!puedeEditarIdentidad} onChange={(e) => setNombre(e.target.value)} />
              </div>
              <div>
                <Label>Teléfono</Label>
                <Input
                  type="tel"
                  placeholder="+56 9 1234 5678"
                  value={telefono}
                  disabled={!puedeEditarIdentidad}
                  onChange={(e) => setTelefono(e.target.value)}
                />
                <p className="mt-1 text-xs text-muted">Con código de país. Necesario para que use el bot de WhatsApp.</p>
              </div>
              <div>
                <Label>Función</Label>
                <Select value={funcion} disabled={!puedeEditarIdentidad} onChange={(e) => setFuncion(e.target.value)}>
                  <option value="">Sin definir</option>
                  {FUNCIONES.map((f) => (
                    <option key={f.value} value={f.value}>
                      {f.label}
                    </option>
                  ))}
                </Select>
                <p className="mt-1 text-xs text-muted">Define qué pestañas ve en la app móvil.</p>
              </div>
              <div>
                <Label>Zona / área de cobertura</Label>
                <Select value={zona} disabled={!puedeEditarIdentidad} onChange={(e) => setZona(e.target.value)}>
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
            {!puedeEditarIdentidad && (
              <p className="mt-3 text-xs text-muted">Solo lectura — editar identidad requiere el módulo de Flota.</p>
            )}
            {errorId && (
              <div className="mt-3">
                <ErrorText>{errorId}</ErrorText>
              </div>
            )}
            {avisoId && (
              <div className="mt-3">
                <SuccessText>{avisoId}</SuccessText>
              </div>
            )}
            {puedeEditarIdentidad && (
              <Button type="button" onClick={guardarIdentidad} disabled={guardandoId} className="mt-4">
                {guardandoId ? "Guardando…" : "Guardar"}
              </Button>
            )}
          </Card>

          <Card>
            <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-foreground">
              <IconCalendar className="h-4 w-4 text-brand" />
              Jornada / rutas planificadas
            </h2>
            {!ve("flota") ? (
              <p className="text-sm text-muted">Requiere el módulo de Flota.</p>
            ) : rutas.length === 0 ? (
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
      )}

      {/* ── Acceso y permisos ── */}
      {pestanaActiva === "acceso" && ve("gestion_control") && (
        <div className="my-6 flex flex-col gap-6">
          <Card>
            <h2 className="mb-4 text-sm font-semibold text-foreground">Rol y estado</h2>
            {persona.id === yoId ? (
              <p className="text-sm text-muted">No puedes cambiar tu propio rol ni tu estado.</p>
            ) : (
              <div className="flex flex-col gap-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <Label>Rol</Label>
                    <Select value={editRol} onChange={(e) => setEditRol(e.target.value)}>
                      {rolesDisponibles.map((r) => (
                        <option key={r.value} value={r.value}>
                          {r.label}
                        </option>
                      ))}
                    </Select>
                  </div>
                  <label className="flex items-center gap-2 self-end pb-2.5 text-sm text-foreground">
                    <input type="checkbox" checked={editActivo} onChange={(e) => setEditActivo(e.target.checked)} />
                    Activo
                  </label>
                </div>
                {errorAcc && <ErrorText>{errorAcc}</ErrorText>}
                {avisoAcc && <SuccessText>{avisoAcc}</SuccessText>}
                <div className="flex flex-wrap gap-2">
                  <Button type="button" onClick={guardarAcceso} disabled={guardandoAcc}>
                    {guardandoAcc ? "Guardando…" : "Guardar"}
                  </Button>
                  {persona.rol !== "admin" && (
                    <Button type="button" variant="outline" onClick={restablecerPassword} disabled={reseteando}>
                      {reseteando ? "Generando…" : "Restablecer contraseña"}
                    </Button>
                  )}
                </div>
              </div>
            )}

            {passwordGenerada && (
              <div className="mt-4 rounded-lg border border-brand/40 bg-brand-soft/20 p-4">
                <h3 className="text-sm font-semibold text-foreground">Contraseña nueva de {persona.nombre}</h3>
                <p className="mt-1 text-xs text-muted">
                  Pásasela a mano — no se guarda ni se envía por correo, y no vas a poder volver a verla. La contraseña anterior ya
                  no funciona.
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <code className="rounded-md bg-surface px-3 py-2 font-mono text-sm text-foreground">{passwordGenerada}</code>
                  <Button type="button" variant="outline" onClick={() => navigator.clipboard.writeText(passwordGenerada)}>
                    Copiar
                  </Button>
                  <Button type="button" variant="ghost" onClick={() => setPasswordGenerada(null)}>
                    Listo
                  </Button>
                </div>
              </div>
            )}
          </Card>

          {auditoria.length > 0 && (
            <Card className="overflow-x-auto p-0">
              <h2 className="px-5 pt-5 text-sm font-semibold text-foreground">Historial de cambios</h2>
              <table className="mt-3 w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-border bg-surface-sunken font-mono text-[10px] uppercase tracking-[0.1em] text-muted">
                    <th className="px-5 py-3 font-medium">Campo</th>
                    <th className="px-5 py-3 font-medium">Cambio</th>
                    <th className="px-5 py-3 font-medium">Realizado por</th>
                    <th className="px-5 py-3 font-medium">Fecha</th>
                  </tr>
                </thead>
                <tbody>
                  {auditoria.map((a) => (
                    <tr key={a.id} className="border-b border-border text-muted last:border-0">
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
        </div>
      )}

      {/* ── Datos laborales ── */}
      {pestanaActiva === "laboral" && ve("remuneraciones") && (
        <Card className="my-6">
          <h2 className="mb-1 text-sm font-semibold text-foreground">Contrato, previsión y haberes fijos</h2>
          <p className="mb-4 text-sm text-muted">
            Lo que la liquidación necesita y no vive en la identidad. {laboral ? "" : "Aún sin configurar."}
          </p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <Label>RUT</Label>
              <Input placeholder="12.345.678-9" value={String(formLaboral.rut)} onChange={(e) => setL("rut", e.target.value)} />
            </div>
            <div>
              <Label>Apellido paterno</Label>
              <Input value={String(formLaboral.apellido_paterno)} onChange={(e) => setL("apellido_paterno", e.target.value)} />
            </div>
            <div>
              <Label>Apellido materno</Label>
              <Input value={String(formLaboral.apellido_materno)} onChange={(e) => setL("apellido_materno", e.target.value)} />
            </div>
            <div>
              <Label>Tipo de contrato</Label>
              <Select value={String(formLaboral.tipo_contrato)} onChange={(e) => setL("tipo_contrato", e.target.value)}>
                <option value="indefinido">Indefinido</option>
                <option value="plazo_fijo">Plazo fijo</option>
                <option value="por_obra">Por obra / faena</option>
              </Select>
            </div>
            <div>
              <Label>Fecha de ingreso</Label>
              <Input type="date" value={String(formLaboral.fecha_ingreso)} onChange={(e) => setL("fecha_ingreso", e.target.value)} />
            </div>
            <div>
              <Label>Sueldo base ($)</Label>
              <Input type="number" value={String(formLaboral.sueldo_base)} onChange={(e) => setL("sueldo_base", e.target.value)} />
            </div>
            <div>
              <Label>Colación mensual ($)</Label>
              <Input type="number" value={String(formLaboral.colacion_mensual)} onChange={(e) => setL("colacion_mensual", e.target.value)} />
            </div>
            <div>
              <Label>Movilización mensual ($)</Label>
              <Input
                type="number"
                value={String(formLaboral.movilizacion_mensual)}
                onChange={(e) => setL("movilizacion_mensual", e.target.value)}
              />
            </div>
            <div>
              <Label>AFP</Label>
              <Select value={String(formLaboral.afp)} onChange={(e) => setL("afp", e.target.value)}>
                <option value="">Sin AFP</option>
                {AFP_CHILE.map((a) => (
                  <option key={a.afp} value={a.afp}>
                    {a.nombre}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label>Sistema de salud</Label>
              <Select value={String(formLaboral.sistema_salud)} onChange={(e) => setL("sistema_salud", e.target.value)}>
                <option value="fonasa">Fonasa</option>
                <option value="isapre">Isapre</option>
              </Select>
            </div>
            {formLaboral.sistema_salud === "isapre" && (
              <>
                <div>
                  <Label>Plan Isapre (UF)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={String(formLaboral.plan_isapre_uf)}
                    onChange={(e) => setL("plan_isapre_uf", e.target.value)}
                  />
                </div>
                <div>
                  <Label>Isapre</Label>
                  <Select value={String(formLaboral.codigo_isapre)} onChange={(e) => setL("codigo_isapre", e.target.value)}>
                    <option value="">Elegir…</option>
                    {ISAPRES_CHILE.map((i) => (
                      <option key={i.codigo} value={i.codigo}>
                        {i.nombre}
                      </option>
                    ))}
                  </Select>
                </div>
              </>
            )}
            <div>
              <Label>Cargas familiares</Label>
              <Input
                type="number"
                value={String(formLaboral.cargas_familiares)}
                onChange={(e) => setL("cargas_familiares", e.target.value)}
              />
            </div>
            <label className="flex items-center gap-2 self-end pb-2.5 text-sm text-foreground">
              <input
                type="checkbox"
                checked={Boolean(formLaboral.gratificacion_legal)}
                onChange={(e) => setL("gratificacion_legal", e.target.checked)}
              />
              Paga gratificación (Art. 50)
            </label>
          </div>
          {errorLab && (
            <div className="mt-3">
              <ErrorText>{errorLab}</ErrorText>
            </div>
          )}
          {avisoLab && (
            <div className="mt-3">
              <SuccessText>{avisoLab}</SuccessText>
            </div>
          )}
          <Button type="button" onClick={guardarLaboral} disabled={guardandoLab} className="mt-4">
            {guardandoLab ? "Guardando…" : "Guardar"}
          </Button>
        </Card>
      )}

      {/* ── Documentos ── */}
      {pestanaActiva === "documentos" && ve("flota") && (
        <div className="my-6">
          <DocumentoForm entidadTipo="colaborador" entidadId={persona.id} />
        </div>
      )}

    </DashboardShell>
  );
}
