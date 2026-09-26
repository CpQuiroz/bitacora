"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import type { Empresa, EstadoEmpresa, Plan, Rubro, Suscripcion, SuscripcionCobro } from "@bitacora/shared";
import { DIAS_PRUEBA, ETIQUETA_PLAN, GRUPOS_MODULOS, LIMITES_POR_PLAN, MAX_DIAS_EXTENSION_PRUEBA, cuentaParaTope, planPermiteIACompleta, type Modulo } from "@bitacora/shared";
import { SuperAdminShell } from "@/components/SuperAdminShell";
import { PageHeader } from "@/components/PageHeader";
import { IconChevronDown, IconChevronLeft, IconShield } from "@/components/icons";
import { obtenerTokenSuperAdmin, superadminFetch } from "@/lib/superadminApi";
import { guardarImpersonacion } from "@/lib/impersonacion";
import { ETIQUETA_MODULO } from "@/lib/etiquetasModulo";
import { EstadoSuperAdmin } from "../../tonoEstado";
import { Aviso, Button, Card, Input, Select, Textarea, useConfirmar } from "@bitacora/ui/web";

// Historial de la prueba (super_admin_auditoria, tarea 144).
type HistorialPrueba = {
  id: string;
  accion: string;
  detalle: string | null;
  creado_en: string;
  super_admin: { nombre: string; correo: string } | null;
};

// Hoy en Chile (YYYY-MM-DD), mismo criterio que el backend (fechaChile.ts).
function hoyChileWeb(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Santiago" }).format(new Date());
}

const ESTADOS: EstadoEmpresa[] = ["activa", "suspendida", "dada_de_baja"];
const PLANES: Plan[] = ["trial", "basico", "operacion", "pro", "empresa"];
const RUBROS: { value: Rubro; label: string }[] = [
  { value: "transporte", label: "Transporte" },
  { value: "servicio_tecnico", label: "Servicio técnico / mantención" },
  { value: "cosmetologia", label: "Cosmetología / belleza" },
  { value: "otro", label: "Otro" },
];
// Mismas 3 opciones que Configuración > Empresa > "Tema visual".
const TEMAS: { value: Empresa["tema"]; label: string }[] = [
  { value: "faena", label: "Faena (por defecto)" },
  { value: "taller", label: "Taller" },
  { value: "confianza", label: "Confianza" },
];

type Salud = {
  empresa: { id: string; nombre: string; estado: EstadoEmpresa; plan: Plan; rut: string | null; rubro: Rubro; tema: Empresa["tema"]; dada_de_baja_en: string | null };
  ultima_actividad: string | null;
  usuarios_activos_mes: number;
  os_creadas_mes: number;
  almacenamiento_bytes: number;
  almacenamiento_incluye_avatares: boolean;
  consumo_ia_mes: {
    tokens_entrada: number;
    tokens_salida: number;
    por_feature: Record<string, { tokens_entrada: number; tokens_salida: number }>;
  };
  errores_recientes: { ruta: string; mensaje: string; creado_en: string }[];
};

const ETIQUETA_ESTADO_SUSCRIPCION: Record<string, string> = {
  trial: "En prueba",
  activa: "Activa",
  pago_pendiente: "Pago pendiente",
  suspendida_por_pago: "Suspendida por falta de pago",
  cancelada: "Cancelada",
};

const ETIQUETA_FEATURE: Record<string, string> = {
  analisis_foto: "Análisis de fotos",
  informe_os: "Informe de OS",
  extraer_guia: "Guía de despacho (WhatsApp)",
  informe_libre: "Informe con IA (libre)",
  informe_estructurado: "Informe con IA (estructurado)",
  informe_personalizado: "Informe con IA (personalizado)",
  asistente: "Asistente",
};

const Estado = EstadoSuperAdmin;

function formatearBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
}

// Cabecera clicable de una tarjeta retráctil (21-sep-2026, pedido: que
// "Perfiles y permisos" arranque colapsada y se despliegue al tocarla
// — antes mostraba todo su contenido siempre, aunque el Super-Admin
// casi nunca la toca; luego se extendió al resto de las tarjetas de la
// página). Solo pinta el título + chevron; quien la usa decide qué
// envolver debajo con
// `abierto`.
function CabeceraColapsable({
  titulo,
  abierto,
  onToggle,
  extra,
}: {
  titulo: string;
  abierto: boolean;
  onToggle: () => void;
  /** Contenido extra junto al título (ej. un Badge de estado) — visible aunque esté cerrada. */
  extra?: ReactNode;
}) {
  return (
    <button type="button" onClick={onToggle} className="flex w-full items-center justify-between gap-2 text-left">
      <span className="flex items-center gap-2">
        <h2 className="text-sm font-semibold text-ds-text">{titulo}</h2>
        {extra}
      </span>
      <IconChevronDown className={`h-4 w-4 shrink-0 text-ds-text-secondary transition-transform ${abierto ? "rotate-180" : ""}`} />
    </button>
  );
}

export default function SuperAdminSaludEmpresaPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [salud, setSalud] = useState<Salud | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Date.now() es impuro durante el render (regla nueva react-hooks/purity
  // de eslint-config-next 16) — y useMemo no alcanza porque su callback
  // también corre en fase de render. Se fija recién en un efecto (fase de
  // commit), null hasta entonces; alcanza para mostrar "hace N días" sin
  // necesidad de que se actualice al segundo.
  const [ahora, setAhora] = useState<number | null>(null);
  useEffect(() => {
    setAhora(Date.now());
  }, []);

  const [editandoIdentidad, setEditandoIdentidad] = useState(false);
  const [nombreEdit, setNombreEdit] = useState("");
  const [rutEdit, setRutEdit] = useState("");
  const [rubroEdit, setRubroEdit] = useState<Rubro>("otro");
  const [guardandoIdentidad, setGuardandoIdentidad] = useState(false);
  const [errorIdentidad, setErrorIdentidad] = useState<string | null>(null);

  const [guardandoTema, setGuardandoTema] = useState(false);
  const [errorTema, setErrorTema] = useState<string | null>(null);

  const [planSeleccionado, setPlanSeleccionado] = useState<Plan>("trial");
  const [guardandoEstado, setGuardandoEstado] = useState(false);
  const [errorEstado, setErrorEstado] = useState<string | null>(null);
  const [guardandoPlan, setGuardandoPlan] = useState(false);
  const [errorPlan, setErrorPlan] = useState<string | null>(null);
  const [exportando, setExportando] = useState(false);
  const [errorExportar, setErrorExportar] = useState<string | null>(null);
  const [confirmacionEliminar, setConfirmacionEliminar] = useState("");
  const [eliminando, setEliminando] = useState(false);
  const [errorEliminar, setErrorEliminar] = useState<string | null>(null);
  const [modulos, setModulos] = useState<{ modulo: string; activado: boolean }[] | null>(null);
  const [guardandoModulo, setGuardandoModulo] = useState<string | null>(null);
  const [errorModulos, setErrorModulos] = useState<string | null>(null);
  const [perfiles, setPerfiles] = useState<{
    roles: { slug: string; nombre: string; es_sistema: boolean; modulos: string[] }[];
    catalogo: { modulo: string; contratado: boolean }[];
  } | null>(null);
  const [edicionPerfiles, setEdicionPerfiles] = useState<Record<string, Set<string>>>({});
  const [guardandoPerfil, setGuardandoPerfil] = useState<string | null>(null);
  const [errorPerfiles, setErrorPerfiles] = useState<string | null>(null);
  const [okPerfiles, setOkPerfiles] = useState<string | null>(null);
  // Retráctiles (21-sep-2026) — arrancan cerradas, se abren al tocar el título.
  const [perfilesAbierto, setPerfilesAbierto] = useState(false);
  // Resto de las tarjetas (21-sep-2026, mismo pedido extendido a "las
  // otras secciones que se puedan") — todas arrancan cerradas, igual
  // que Perfiles. Quedan afuera "Editar identidad" (ya es condicional,
  // solo aparece en modo edición) y las 4 tarjetitas de KPI de arriba
  // (Última actividad/Usuarios/OS/Almacenamiento — son una sola línea,
  // no tienen un cuerpo separado del título que valga la pena ocultar).
  const [consumoAbierto, setConsumoAbierto] = useState(false);
  const [erroresAbierto, setErroresAbierto] = useState(false);
  const [estadoAbierto, setEstadoAbierto] = useState(false);
  const [planAbierto, setPlanAbierto] = useState(false);
  const [suscripcionAbierta, setSuscripcionAbierta] = useState(false);
  const [modulosAbierto, setModulosAbierto] = useState(false);
  const [correosAbierto, setCorreosAbierto] = useState(false);
  // Equipo arranca ABIERTA (a diferencia del resto) — pedido explícito
  // 21-sep-2026: es la tarjeta que más se usa (reset de contraseña, 2FA).
  const [equipoAbierto, setEquipoAbierto] = useState(true);
  const [anonClienteAbierto, setAnonClienteAbierto] = useState(false);
  const [exportarAbierto, setExportarAbierto] = useState(false);
  const [zonaPeligroAbierta, setZonaPeligroAbierta] = useState(false);
  const [suscripcion, setSuscripcion] = useState<{ prueba_termina_en: string | null; suscripcion: Suscripcion | null; cobros: SuscripcionCobro[] } | null>(
    null
  );
  const [diasExtension, setDiasExtension] = useState("7");
  const [historialPrueba, setHistorialPrueba] = useState<HistorialPrueba[]>([]);
  // Montos por defecto del viático (tarea 144): valor interno de la empresa.
  const [viaticoLocal, setViaticoLocal] = useState("");
  const [viaticoInterregional, setViaticoInterregional] = useState("");
  const [guardandoViaticos, setGuardandoViaticos] = useState(false);
  const [msgViaticos, setMsgViaticos] = useState<{ tipo: "ok" | "error"; texto: string } | null>(null);
  const [guardandoPrueba, setGuardandoPrueba] = useState(false);
  const [errorPrueba, setErrorPrueba] = useState<string | null>(null);

  const [usuarios, setUsuarios] = useState<
    { id: string; nombre: string; rol: string; activo: boolean; correo: string | null; mfa_activado: boolean; mfa_metodo: string | null }[] | null
  >(null);
  const [errorUsuarios, setErrorUsuarios] = useState<string | null>(null);
  const confirmar = useConfirmar();
  const [restableciendoId, setRestableciendoId] = useState<string | null>(null);
  const [passwordGenerada, setPasswordGenerada] = useState<{ usuarioId: string; nombre: string; password: string } | null>(null);
  // Panel de restablecer contraseña (21-sep-2026, pedido: poder dejar
  // una clave personalizada en vez de solo la temporal al azar) — mismo
  // patrón de panel inline que impersonarUsuario/eliminarUsuario, en vez
  // de una confirmación de una sola pregunta.
  const [restablecerUsuario, setRestablecerUsuario] = useState<{ id: string; nombre: string } | null>(null);
  const [passwordPersonalizada, setPasswordPersonalizada] = useState("");
  const [cambiandoMfaId, setCambiandoMfaId] = useState<string | null>(null);
  const [secretoTotpGenerado, setSecretoTotpGenerado] = useState<{ usuarioId: string; nombre: string; secreto: string } | null>(null);
  const [cambiandoEstadoId, setCambiandoEstadoId] = useState<string | null>(null);
  const [eliminarUsuario, setEliminarUsuario] = useState<{ id: string; nombre: string } | null>(null);
  const [confirmacionEliminarUsuario, setConfirmacionEliminarUsuario] = useState("");
  const [anonimizandoUsuario, setAnonimizandoUsuario] = useState(false);
  const [clienteAnonId, setClienteAnonId] = useState("");
  const [clienteAnonNombre, setClienteAnonNombre] = useState("");
  const [anonimizandoCliente, setAnonimizandoCliente] = useState(false);
  const [msgAnonCliente, setMsgAnonCliente] = useState<{ tipo: "ok" | "error"; texto: string } | null>(null);
  const [eliminandoUsuario, setEliminandoUsuario] = useState(false);
  const [errorEliminarUsuario, setErrorEliminarUsuario] = useState<string | null>(null);

  const [nuevoNombre, setNuevoNombre] = useState("");
  const [nuevoCorreo, setNuevoCorreo] = useState("");
  const [nuevoRol, setNuevoRol] = useState("colaborador");
  const [rolesDisponibles, setRolesDisponibles] = useState<{ slug: string; nombre: string }[]>([]);
  const [invitando, setInvitando] = useState(false);
  const [errorInvitar, setErrorInvitar] = useState<string | null>(null);
  const [avisoInvitar, setAvisoInvitar] = useState<string | null>(null);

  const [impersonarUsuario, setImpersonarUsuario] = useState<{ id: string; nombre: string } | null>(null);
  const [justificacionImp, setJustificacionImp] = useState("");
  const [iniciandoImp, setIniciandoImp] = useState(false);
  const [errorImp, setErrorImp] = useState<string | null>(null);

  const [accesos, setAccesos] = useState<
    { id: string; tipo: "correo" | "dominio"; valor: string; rol: string; creado_en: string }[] | null
  >(null);
  const [accesoTipo, setAccesoTipo] = useState<"correo" | "dominio">("correo");
  const [accesoValor, setAccesoValor] = useState("");
  const [accesoRol, setAccesoRol] = useState("colaborador");
  const [guardandoAcceso, setGuardandoAcceso] = useState(false);
  const [errorAcceso, setErrorAcceso] = useState<string | null>(null);

  async function cargar() {
    const res = await superadminFetch(`/api/superadmin/empresas/${params.id}/salud`);
    if (!res.ok) {
      if (res.status === 401) {
        router.replace("/superadmin/login");
        return;
      }
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "No se pudo cargar la salud de la empresa");
      return;
    }
    const datos: Salud = await res.json();
    setSalud(datos);
    setPlanSeleccionado(datos.empresa.plan);
    setNombreEdit(datos.empresa.nombre);
    setRutEdit(datos.empresa.rut ?? "");
    setRubroEdit(datos.empresa.rubro);
  }

  async function cargarModulos() {
    const res = await superadminFetch(`/api/superadmin/empresas/${params.id}/modulos`);
    if (res.ok) setModulos(await res.json());
  }

  async function cargarPerfiles() {
    setErrorPerfiles(null);
    const res = await superadminFetch(`/api/superadmin/empresas/${params.id}/roles-modulos`);
    if (!res.ok) {
      const b = await res.json().catch(() => ({}));
      setErrorPerfiles(b.error ?? "No se pudieron cargar los perfiles");
      return;
    }
    const body = await res.json();
    setPerfiles(body);
    setEdicionPerfiles(
      Object.fromEntries((body.roles as { slug: string; modulos: string[] }[]).map((r) => [r.slug, new Set(r.modulos)]))
    );
  }

  function togglePerfil(slug: string, modulo: string) {
    setOkPerfiles(null);
    setEdicionPerfiles((prev) => {
      const next = new Set(prev[slug] ?? []);
      if (next.has(modulo)) next.delete(modulo);
      else next.add(modulo);
      return { ...prev, [slug]: next };
    });
  }

  function perfilSucio(slug: string): boolean {
    const orig = new Set(perfiles?.roles.find((r) => r.slug === slug)?.modulos ?? []);
    const edit = edicionPerfiles[slug] ?? new Set<string>();
    if (orig.size !== edit.size) return true;
    for (const m of orig) if (!edit.has(m)) return true;
    return false;
  }

  async function guardarPerfil(slug: string) {
    setGuardandoPerfil(slug);
    setErrorPerfiles(null);
    setOkPerfiles(null);
    const res = await superadminFetch(`/api/superadmin/empresas/${params.id}/roles-modulos/${slug}`, {
      method: "PUT",
      body: JSON.stringify({ modulos: Array.from(edicionPerfiles[slug] ?? []) }),
    });
    setGuardandoPerfil(null);
    if (!res.ok) {
      const b = await res.json().catch(() => ({}));
      setErrorPerfiles(b.error ?? "No se pudo guardar");
      return;
    }
    setOkPerfiles("Guardado. Las personas con ese perfil lo verán al recargar la app.");
    cargarPerfiles();
  }

  async function cargarSuscripcion() {
    const res = await superadminFetch(`/api/superadmin/empresas/${params.id}/suscripcion`);
    if (res.ok) {
      const datos = await res.json();
      setSuscripcion(datos);
    }
    const resHist = await superadminFetch(`/api/superadmin/empresas/${params.id}/prueba/historial`);
    if (resHist.ok) setHistorialPrueba(await resHist.json());
  }

  async function cargarViaticos() {
    const res = await superadminFetch(`/api/superadmin/empresas/${params.id}/viaticos`);
    if (!res.ok) return;
    const datos = await res.json();
    setViaticoLocal(datos.viatico_local_monto != null ? String(Math.round(Number(datos.viatico_local_monto))) : "");
    setViaticoInterregional(datos.viatico_interregional_monto != null ? String(Math.round(Number(datos.viatico_interregional_monto))) : "");
  }

  async function onGuardarViaticos() {
    setMsgViaticos(null);
    setGuardandoViaticos(true);
    const res = await superadminFetch(`/api/superadmin/empresas/${params.id}/viaticos`, {
      method: "PATCH",
      body: JSON.stringify({ viatico_local_monto: viaticoLocal.trim() || null, viatico_interregional_monto: viaticoInterregional.trim() || null }),
    });
    setGuardandoViaticos(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setMsgViaticos({ tipo: "error", texto: body.error ?? "No se pudo guardar" });
      return;
    }
    setMsgViaticos({ tipo: "ok", texto: "Guardado. Aplica a los viajes nuevos." });
  }

  async function cargarUsuarios() {
    const res = await superadminFetch(`/api/superadmin/empresas/${params.id}/usuarios`);
    if (res.ok) setUsuarios(await res.json());
  }

  async function cargarAccesos() {
    const res = await superadminFetch(`/api/superadmin/empresas/${params.id}/accesos`);
    if (res.ok) setAccesos((await res.json()).accesos ?? []);
  }

  async function cargarRoles() {
    const res = await superadminFetch(`/api/superadmin/roles`);
    if (!res.ok) return;
    const { roles } = (await res.json()) as { roles: { slug: string; nombre: string; empresas: string[] }[] };
    // Solo los roles globales o los restringidos a esta empresa.
    setRolesDisponibles(
      roles.filter((r) => r.empresas.length === 0 || r.empresas.includes(params.id)).map((r) => ({ slug: r.slug, nombre: r.nombre }))
    );
  }

  useEffect(() => {
    if (!obtenerTokenSuperAdmin()) {
      router.replace("/superadmin/login");
      return;
    }
    cargar();
    cargarModulos();
    cargarPerfiles();
    cargarSuscripcion();
    cargarViaticos();
    cargarUsuarios();
    cargarRoles();
    cargarAccesos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id]);

  async function onInvitarUsuario(e: React.FormEvent) {
    e.preventDefault();
    setErrorInvitar(null);
    setAvisoInvitar(null);
    setInvitando(true);
    const res = await superadminFetch(`/api/superadmin/empresas/${params.id}/usuarios`, {
      method: "POST",
      body: JSON.stringify({ nombre: nuevoNombre.trim(), correo: nuevoCorreo.trim(), rol: nuevoRol }),
    });
    setInvitando(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setErrorInvitar(body.error ?? "No se pudo invitar al usuario");
      return;
    }
    setAvisoInvitar(`Invitación enviada a ${nuevoCorreo.trim()}. El usuario define su contraseña desde el enlace del correo.`);
    setNuevoNombre("");
    setNuevoCorreo("");
    setNuevoRol("colaborador");
    cargarUsuarios();
  }

  async function onAgregarAcceso(e: React.FormEvent) {
    e.preventDefault();
    setErrorAcceso(null);
    setGuardandoAcceso(true);
    const res = await superadminFetch(`/api/superadmin/empresas/${params.id}/accesos`, {
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
    const res = await superadminFetch(`/api/superadmin/empresas/${params.id}/accesos/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setErrorAcceso(body.error ?? "No se pudo quitar");
      return;
    }
    cargarAccesos();
  }

  async function onIniciarImpersonacion() {
    if (!impersonarUsuario) return;
    setErrorImp(null);
    setIniciandoImp(true);
    const res = await superadminFetch(`/api/superadmin/empresas/${params.id}/usuarios/${impersonarUsuario.id}/impersonar`, {
      method: "POST",
      body: JSON.stringify({ justificacion: justificacionImp }),
    });
    setIniciandoImp(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setErrorImp(body.error ?? "No se pudo iniciar la impersonación");
      return;
    }
    const { token, expira_en, usuario_nombre } = await res.json();
    guardarImpersonacion({ token, expira: Date.parse(expira_en), usuario_nombre });
    window.location.href = "/dashboard";
  }

  async function onRestablecerPassword(usuarioId: string, nombre: string) {
    const personalizada = passwordPersonalizada.trim();
    if (personalizada && personalizada.length < 8) {
      setErrorUsuarios("La contraseña personalizada debe tener al menos 8 caracteres");
      return;
    }
    setErrorUsuarios(null);
    setPasswordGenerada(null);
    setRestableciendoId(usuarioId);
    const res = await superadminFetch(`/api/superadmin/empresas/${params.id}/usuarios/${usuarioId}/restablecer-password`, {
      method: "POST",
      body: JSON.stringify(personalizada ? { password: personalizada } : {}),
    });
    setRestableciendoId(null);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setErrorUsuarios(body.error ?? "No se pudo restablecer la contraseña");
      return;
    }
    const { password } = await res.json();
    setPasswordGenerada({ usuarioId, nombre, password });
    setRestablecerUsuario(null);
    setPasswordPersonalizada("");
  }

  async function onActivarMfa(usuarioId: string, nombre: string) {
    if (
      !(await confirmar({
        titulo: `¿Activar 2FA (TOTP) para ${nombre}?`,
        mensaje: "Se genera una clave nueva — si ya tenía una configurada en su app, dejará de servir.",
        accion: "Activar 2FA",
      }))
    )
      return;
    setErrorUsuarios(null);
    setSecretoTotpGenerado(null);
    setCambiandoMfaId(usuarioId);
    const res = await superadminFetch(`/api/superadmin/empresas/${params.id}/usuarios/${usuarioId}/mfa/activar-totp`, { method: "POST" });
    setCambiandoMfaId(null);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setErrorUsuarios(body.error ?? "No se pudo activar el 2FA");
      return;
    }
    const { secreto } = await res.json();
    setSecretoTotpGenerado({ usuarioId, nombre, secreto });
    cargarUsuarios();
  }

  async function onDesactivarMfa(usuarioId: string, nombre: string, rol: string) {
    const avisoRol =
      // Supervisor dejó de exigir 2FA (tarea 138); un rol custom puede
      // exigirlo desde Roles, pero acá solo se avisa el caso seguro.
      rol === "admin"
        ? " Su rol EXIGE 2FA activo — hasta que lo vuelva a activar (o cambie de rol), va a quedar bloqueado del resto de la app."
        : "";
    if (!(await confirmar({ titulo: `¿Desactivar el 2FA de ${nombre}?`, mensaje: avisoRol.trim() || undefined, accion: "Desactivar 2FA", destructivo: true }))) return;
    setErrorUsuarios(null);
    setCambiandoMfaId(usuarioId);
    const res = await superadminFetch(`/api/superadmin/empresas/${params.id}/usuarios/${usuarioId}/mfa/desactivar`, { method: "POST" });
    setCambiandoMfaId(null);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setErrorUsuarios(body.error ?? "No se pudo desactivar el 2FA");
      return;
    }
    cargarUsuarios();
  }

  async function onCambiarEstadoUsuario(usuarioId: string, nombre: string, activo: boolean) {
    const accion = activo ? "reactivar" : "desactivar";
    const aviso = activo
      ? ""
      : " No podrá entrar a la app hasta que lo reactives. Su historial queda intacto.";
    if (
      !(await confirmar({
        titulo: `¿${activo ? "Reactivar" : "Desactivar"} a ${nombre}?`,
        mensaje: aviso.trim() || undefined,
        accion: activo ? "Reactivar" : "Desactivar",
        destructivo: !activo,
      }))
    )
      return;
    setErrorUsuarios(null);
    setCambiandoEstadoId(usuarioId);
    const res = await superadminFetch(`/api/superadmin/empresas/${params.id}/usuarios/${usuarioId}/${accion}`, { method: "POST" });
    setCambiandoEstadoId(null);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setErrorUsuarios(body.error ?? `No se pudo ${accion} el usuario`);
      return;
    }
    cargarUsuarios();
  }

  async function onEliminarUsuario() {
    if (!eliminarUsuario) return;
    setErrorEliminarUsuario(null);
    setEliminandoUsuario(true);
    const res = await superadminFetch(`/api/superadmin/empresas/${params.id}/usuarios/${eliminarUsuario.id}`, {
      method: "DELETE",
      body: JSON.stringify({ confirmar: confirmacionEliminarUsuario }),
    });
    setEliminandoUsuario(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setErrorEliminarUsuario(body.error ?? "No se pudo eliminar el usuario");
      return;
    }
    setEliminarUsuario(null);
    setConfirmacionEliminarUsuario("");
    cargarUsuarios();
  }

  async function onAnonimizarUsuario() {
    if (!eliminarUsuario) return;
    setErrorEliminarUsuario(null);
    setAnonimizandoUsuario(true);
    const res = await superadminFetch(`/api/superadmin/empresas/${params.id}/usuarios/${eliminarUsuario.id}/anonimizar`, {
      method: "POST",
      body: JSON.stringify({ confirmar: confirmacionEliminarUsuario }),
    });
    setAnonimizandoUsuario(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setErrorEliminarUsuario(body.error ?? "No se pudo anonimizar");
      return;
    }
    setEliminarUsuario(null);
    setConfirmacionEliminarUsuario("");
    cargarUsuarios();
  }

  async function onAnonimizarCliente() {
    setMsgAnonCliente(null);
    if (!clienteAnonId.trim() || !clienteAnonNombre.trim()) {
      setMsgAnonCliente({ tipo: "error", texto: "Completa el ID y el nombre exacto del cliente." });
      return;
    }
    setAnonimizandoCliente(true);
    const res = await superadminFetch(
      `/api/superadmin/empresas/${params.id}/clientes/${clienteAnonId.trim()}/anonimizar`,
      { method: "POST", body: JSON.stringify({ confirmar: clienteAnonNombre.trim() }) }
    );
    setAnonimizandoCliente(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setMsgAnonCliente({ tipo: "error", texto: body.error ?? "No se pudo anonimizar" });
      return;
    }
    setMsgAnonCliente({ tipo: "ok", texto: "Cliente anonimizado." });
    setClienteAnonId("");
    setClienteAnonNombre("");
  }

  // Tarea 144: extender N días o reactivar (DIAS_PRUEBA desde hoy). El
  // backend valida y deja el registro en super_admin_auditoria.
  async function onCambiarPrueba(accion: "extender" | "reactivar") {
    setErrorPrueba(null);
    const dias = Number(diasExtension);
    if (accion === "extender" && (!Number.isInteger(dias) || dias < 1 || dias > MAX_DIAS_EXTENSION_PRUEBA)) {
      setErrorPrueba(`Indica entre 1 y ${MAX_DIAS_EXTENSION_PRUEBA} días`);
      return;
    }
    setGuardandoPrueba(true);
    const res = await superadminFetch(`/api/superadmin/empresas/${params.id}/prueba/${accion}`, {
      method: "POST",
      body: JSON.stringify(accion === "extender" ? { dias } : {}),
    });
    setGuardandoPrueba(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setErrorPrueba(body.error ?? "No se pudo cambiar la prueba");
      return;
    }
    cargarSuscripcion();
  }

  async function onTogglearModulo(modulo: string, activado: boolean) {
    setErrorModulos(null);
    setGuardandoModulo(modulo);
    const res = await superadminFetch(`/api/superadmin/empresas/${params.id}/modulos`, {
      method: "PATCH",
      body: JSON.stringify({ modulo, activado }),
    });
    setGuardandoModulo(null);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setErrorModulos(body.error ?? "No se pudo cambiar el módulo");
      return;
    }
    cargarModulos();
  }

  async function onGuardarIdentidad() {
    setErrorIdentidad(null);
    setGuardandoIdentidad(true);
    const res = await superadminFetch(`/api/superadmin/empresas/${params.id}`, {
      method: "PATCH",
      body: JSON.stringify({ nombre: nombreEdit, rut: rutEdit.trim() || null, rubro: rubroEdit }),
    });
    setGuardandoIdentidad(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setErrorIdentidad(body.error ?? "No se pudo guardar");
      return;
    }
    setEditandoIdentidad(false);
    cargar();
  }

  async function onCambiarTema(nuevo: Empresa["tema"]) {
    if (!salud || nuevo === salud.empresa.tema) return;
    setErrorTema(null);
    setGuardandoTema(true);
    // try/catch: un fetch que lanza (red/CORS) antes se perdía en
    // silencio y el selector quedaba bloqueado en el valor viejo.
    try {
      const res = await superadminFetch(`/api/superadmin/empresas/${params.id}/tema`, {
        method: "PATCH",
        body: JSON.stringify({ tema: nuevo }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `Error ${res.status}`);
      }
      setSalud((s) => (s ? { ...s, empresa: { ...s.empresa, tema: nuevo } } : s));
    } catch (e) {
      setErrorTema(`No se pudo cambiar el tema: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setGuardandoTema(false);
    }
  }

  async function onCambiarEstado(nuevo: EstadoEmpresa) {
    if (!(await confirmar({ titulo: `¿Cambiar el estado a "${nuevo.replaceAll("_", " ")}"?`, accion: "Cambiar estado" }))) return;
    setErrorEstado(null);
    setGuardandoEstado(true);
    const res = await superadminFetch(`/api/superadmin/empresas/${params.id}/estado`, {
      method: "PATCH",
      body: JSON.stringify({ estado: nuevo }),
    });
    setGuardandoEstado(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setErrorEstado(body.error ?? "No se pudo cambiar el estado");
      return;
    }
    cargar();
  }

  async function onGuardarPlan() {
    setErrorPlan(null);
    setGuardandoPlan(true);
    const res = await superadminFetch(`/api/superadmin/empresas/${params.id}/plan`, {
      method: "PATCH",
      body: JSON.stringify({ plan: planSeleccionado }),
    });
    setGuardandoPlan(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setErrorPlan(body.error ?? "No se pudo cambiar el plan");
      return;
    }
    cargar();
  }

  async function onExportar() {
    setErrorExportar(null);
    setExportando(true);
    const res = await superadminFetch(`/api/superadmin/empresas/${params.id}/exportar`);
    setExportando(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setErrorExportar(body.error ?? "No se pudo generar la exportación");
      return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${salud?.empresa.nombre ?? "empresa"}-export-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function onEliminar() {
    if (!salud || confirmacionEliminar !== salud.empresa.nombre) return;
    setErrorEliminar(null);
    setEliminando(true);
    const res = await superadminFetch(`/api/superadmin/empresas/${params.id}`, {
      method: "DELETE",
      body: JSON.stringify({ confirmar: confirmacionEliminar }),
    });
    setEliminando(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setErrorEliminar(body.error ?? "No se pudo eliminar la empresa");
      return;
    }
    router.replace("/superadmin");
  }

  return (
    <SuperAdminShell>
      <Link href="/superadmin" className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-ds-brand hover:underline">
        <IconChevronLeft className="h-4 w-4" />
        Empresas
      </Link>

      {error && <Aviso tono="error">{error}</Aviso>}

      {salud && (
        <>
          <PageHeader
            title={salud.empresa.nombre}
            subtitle="Salud y uso — sin datos operativos internos"
            action={
              <div className="flex items-center gap-2">
                <Estado estado={salud.empresa.estado} />
                {!editandoIdentidad && (
                  <Button variante="secundario" onPress={() => setEditandoIdentidad(true)}>
                    Editar identidad
                  </Button>
                )}
              </div>
            }
          />

          {editandoIdentidad && (
            <div className="my-6">
              <Card>
                <h2 className="mb-3 text-sm font-semibold text-ds-text">Editar identidad</h2>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Input etiqueta="Nombre de la empresa" valor={nombreEdit} onCambio={setNombreEdit} />
                  <Input etiqueta="RUT" placeholder="76.123.456-7" valor={rutEdit} onCambio={setRutEdit} />
                  <div>
                    <Select
                      etiqueta="Rubro"
                      valor={rubroEdit}
                      onCambio={(v) => setRubroEdit(v as Rubro)}
                      opciones={RUBROS.map((r) => ({ valor: r.value, etiqueta: r.label }))}
                    />
                    <p className="mt-1 text-xs text-ds-text-secondary">
                      Cosmetología activa el tema visual &ldquo;Vino y eucalipto&rdquo; en la app móvil (pantallas de reserva).
                    </p>
                  </div>
                </div>
                {errorIdentidad && (
                  <div className="mt-3">
                    <Aviso tono="error">{errorIdentidad}</Aviso>
                  </div>
                )}
                <div className="mt-4 flex gap-2">
                  <Button deshabilitado={guardandoIdentidad || !nombreEdit.trim()} onPress={onGuardarIdentidad}>
                    {guardandoIdentidad ? "Guardando…" : "Guardar"}
                  </Button>
                  <Button variante="ghost" onPress={() => setEditandoIdentidad(false)}>
                    Cancelar
                  </Button>
                </div>
              </Card>
            </div>
          )}

          <div className="my-6">
            <Card>
              <h2 className="mb-1 text-sm font-semibold text-ds-text">Tema visual</h2>
              <p className="mb-3 text-xs text-ds-text-secondary">
                Estilo con que todos los usuarios de la empresa ven la app, en web y mobile. Es el mismo valor que su admin puede cambiar en
                Configuración &gt; Empresa.
              </p>
              <div className="max-w-xs">
                <Select
                  etiquetaAccesible="Tema visual"
                  valor={salud.empresa.tema}
                  deshabilitado={guardandoTema}
                  onCambio={(v) => onCambiarTema(v as Empresa["tema"])}
                  opciones={TEMAS.map((t) => ({ valor: t.value, etiqueta: t.label }))}
                />
              </div>
              {errorTema && (
                <div className="mt-3">
                  <Aviso tono="error">{errorTema}</Aviso>
                </div>
              )}
            </Card>
          </div>

          <div className="my-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card>
              <p className="text-xs text-ds-text-secondary">Última actividad</p>
              <p className="mt-1 text-lg font-semibold text-ds-text">
                {salud.ultima_actividad ? new Date(salud.ultima_actividad).toLocaleString("es-CL") : "Sin registro"}
              </p>
            </Card>
            <Card>
              <p className="text-xs text-ds-text-secondary">Usuarios activos este mes</p>
              <p className="mt-1 text-lg font-semibold text-ds-text">{salud.usuarios_activos_mes}</p>
            </Card>
            <Card>
              <p className="text-xs text-ds-text-secondary">OS creadas este mes</p>
              <p className="mt-1 text-lg font-semibold text-ds-text">{salud.os_creadas_mes}</p>
            </Card>
            <Card>
              <p className="text-xs text-ds-text-secondary">Almacenamiento usado</p>
              <p className="mt-1 text-lg font-semibold text-ds-text">{formatearBytes(salud.almacenamiento_bytes)}</p>
              {!salud.almacenamiento_incluye_avatares && (
                <p className="mt-1 text-ds-micro text-ds-text-secondary">No incluye fotos de perfil (volumen marginal)</p>
              )}
            </Card>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CabeceraColapsable titulo="Consumo de Claude este mes" abierto={consumoAbierto} onToggle={() => setConsumoAbierto((v) => !v)} />
              {consumoAbierto && (
                <>
              <div className="mt-3 flex gap-6">
                <div>
                  <p className="text-xs text-ds-text-secondary">Tokens de entrada</p>
                  <p className="text-lg font-semibold text-ds-text">{salud.consumo_ia_mes.tokens_entrada.toLocaleString("es-CL")}</p>
                </div>
                <div>
                  <p className="text-xs text-ds-text-secondary">Tokens de salida</p>
                  <p className="text-lg font-semibold text-ds-text">{salud.consumo_ia_mes.tokens_salida.toLocaleString("es-CL")}</p>
                </div>
              </div>
              {Object.keys(salud.consumo_ia_mes.por_feature).length > 0 && (
                <div className="mt-4 flex flex-col gap-1.5 border-t border-ds-divider pt-3">
                  {Object.entries(salud.consumo_ia_mes.por_feature).map(([feature, tokens]) => (
                    <div key={feature} className="flex items-center justify-between text-xs">
                      <span className="text-ds-text-secondary">{ETIQUETA_FEATURE[feature] ?? feature}</span>
                      <span className="text-ds-text">
                        {(tokens.tokens_entrada + tokens.tokens_salida).toLocaleString("es-CL")} tokens
                      </span>
                    </div>
                  ))}
                </div>
              )}
              <p className="mt-3 text-ds-micro text-ds-text-secondary">
                El costo exacto depende del precio vigente por token — revisa console.anthropic.com para calcularlo.
              </p>
                </>
              )}
            </Card>

            <Card>
              <CabeceraColapsable titulo="Errores recientes" abierto={erroresAbierto} onToggle={() => setErroresAbierto((v) => !v)} />
              {erroresAbierto && (
              salud.errores_recientes.length === 0 ? (
                <p className="mt-3 text-sm text-ds-text-secondary">Sin errores recientes.</p>
              ) : (
                <div className="mt-3 flex flex-col divide-y divide-ds-divider">
                  {salud.errores_recientes.map((e, i) => (
                    <div key={i} className="py-2 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-ds-text">{e.ruta}</span>
                        <span className="text-ds-text-secondary">{new Date(e.creado_en).toLocaleString("es-CL")}</span>
                      </div>
                      <p className="mt-0.5 text-ds-text-secondary">{e.mensaje}</p>
                    </div>
                  ))}
                </div>
              )
              )}
            </Card>
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <Card>
              <CabeceraColapsable
                titulo="Estado"
                abierto={estadoAbierto}
                onToggle={() => setEstadoAbierto((v) => !v)}
                extra={<Estado estado={salud.empresa.estado} />}
              />
              {estadoAbierto && (
                <>
              {salud.empresa.estado === "dada_de_baja" && salud.empresa.dada_de_baja_en && ahora != null && (
                <p className="mb-3 mt-3 rounded-lg bg-ds-warning-soft p-2 text-xs text-ds-warning">
                  Dada de baja el {new Date(salud.empresa.dada_de_baja_en).toLocaleDateString("es-CL")} (
                  {Math.floor((ahora - new Date(salud.empresa.dada_de_baja_en).getTime()) / 86400000)} días).
                  Ley 21.719 — evaluar eliminar sus datos personales pasado el plazo de conservación.
                </p>
              )}
              <div className="mt-3 flex flex-wrap gap-2">
                {ESTADOS.filter((e) => e !== salud.empresa.estado).map((e) => (
                  <Button key={e} variante="secundario" deshabilitado={guardandoEstado} onPress={() => onCambiarEstado(e)}>
                    {e === "activa" ? "Activar" : e === "suspendida" ? "Suspender" : "Dar de baja"}
                  </Button>
                ))}
              </div>
              {errorEstado && (
                <div className="mt-3">
                  <Aviso tono="error">{errorEstado}</Aviso>
                </div>
              )}
              <p className="mt-3 text-ds-micro text-ds-text-secondary">
                Suspendida o dada de baja bloquea el acceso a la app completa para todos los usuarios de esta empresa de inmediato.
              </p>
                </>
              )}
            </Card>

            <Card>
              <CabeceraColapsable
                titulo="Plan"
                abierto={planAbierto}
                onToggle={() => setPlanAbierto((v) => !v)}
                extra={
                  <span className="text-xs text-ds-text-secondary">{ETIQUETA_PLAN[salud.empresa.plan] ?? salud.empresa.plan}</span>
                }
              />
              {planAbierto && (
                <>
              <div className="mt-3 flex items-end gap-2">
                <div className="flex-1">
                  <Select
                    etiqueta="Plan actual"
                    valor={planSeleccionado}
                    onCambio={(v) => setPlanSeleccionado(v as Plan)}
                    opciones={PLANES.map((p) => ({ valor: p, etiqueta: ETIQUETA_PLAN[p] }))}
                  />
                </div>
                <Button deshabilitado={guardandoPlan || planSeleccionado === salud.empresa.plan} onPress={onGuardarPlan}>
                  {guardandoPlan ? "Guardando…" : "Guardar"}
                </Button>
              </div>
              {errorPlan && (
                <div className="mt-3">
                  <Aviso tono="error">{errorPlan}</Aviso>
                </div>
              )}
              <p className="mt-3 text-ds-micro text-ds-text-secondary">
                El plan no prende ni apaga módulos: fija los topes (usuarios, módulos activos, informes con IA). Esencial permite
                hasta {LIMITES_POR_PLAN.basico.modulosMax} módulos y Operación hasta {LIMITES_POR_PLAN.operacion.modulosMax}; si la empresa
                tiene más activos, primero apágalos en Módulos. Empresa está oculto para los clientes, pero se puede asignar desde acá.
              </p>
                </>
              )}
            </Card>
          </div>

          <div className="mt-4">
            <Card>
              {/* Tarea 144: con la prueba vencida la empresa queda bloqueada
                  (solo Plan/pago, Mi cuenta y cerrar sesión). */}
              <h2 className="text-sm font-semibold text-ds-text">Período de prueba</h2>
              {salud.empresa.plan !== "trial" ? (
                <p className="mt-2 text-sm text-ds-text-secondary">La empresa tiene un plan pago: la prueba no aplica.</p>
              ) : (
                <div className="mt-3 flex flex-col gap-3">
                  <p className="text-sm text-ds-text">
                    {suscripcion?.prueba_termina_en
                      ? `Último día de prueba: ${new Date(`${suscripcion.prueba_termina_en}T00:00:00`).toLocaleDateString("es-CL")}`
                      : "Sin fecha de fin de prueba"}
                    {suscripcion?.prueba_termina_en && suscripcion.prueba_termina_en < hoyChileWeb() ? (
                      <span className="ml-2 font-semibold text-ds-danger">Vencida — la empresa está bloqueada</span>
                    ) : null}
                  </p>
                  <div className="flex flex-wrap items-end gap-2">
                    <div className="w-28">
                      <Input etiqueta="Días a extender" tipo="numero" minimo={1} valor={diasExtension} onCambio={setDiasExtension} />
                    </div>
                    <Button variante="secundario" deshabilitado={guardandoPrueba} onPress={() => onCambiarPrueba("extender")}>
                      {guardandoPrueba ? "Guardando…" : "Extender"}
                    </Button>
                    <Button variante="secundario" deshabilitado={guardandoPrueba} onPress={() => onCambiarPrueba("reactivar")}>
                      Reactivar ({DIAS_PRUEBA} días desde hoy)
                    </Button>
                  </div>
                  {errorPrueba && <Aviso tono="error">{errorPrueba}</Aviso>}
                  <p className="text-ds-micro text-ds-text-secondary">
                    Extender suma días desde el último día de prueba (o desde hoy si ya venció). Al confirmarse el pago de un plan, la empresa
                    sale de la prueba sola. Nunca se borran datos.
                  </p>
                </div>
              )}
              {historialPrueba.length > 0 && (
                <div className="mt-3 overflow-x-auto border-t border-ds-divider pt-3">
                  <p className="mb-1 text-xs font-medium text-ds-text-secondary">Historial</p>
                  <table className="w-full text-left text-xs">
                    <tbody>
                      {historialPrueba.map((h) => (
                        <tr key={h.id} className="border-t border-ds-divider first:border-t-0">
                          <td className="py-1.5 pr-4 text-ds-text-secondary">{new Date(h.creado_en).toLocaleString("es-CL")}</td>
                          <td className="py-1.5 pr-4 text-ds-text">{h.accion === "reactivar_prueba_empresa" ? "Reactivó" : "Extendió"}</td>
                          <td className="py-1.5 pr-4 text-ds-text">{h.super_admin?.nombre ?? h.super_admin?.correo ?? "—"}</td>
                          <td className="py-1.5 text-ds-text-secondary">{h.detalle ?? ""}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          </div>

          <div className="mt-4">
            <Card>
              <h2 className="text-sm font-semibold text-ds-text">Viático del chofer — montos por defecto</h2>
              <p className="mt-1 text-ds-micro text-ds-text-secondary">
                Valor interno: se precarga al asignar el viático en un viaje (el Admin puede ajustarlo por viaje) y se registra como gasto
                “Viáticos”. No aparece en el cobro ni cambia viajes ya creados.
              </p>
              <div className="mt-3 flex flex-wrap items-end gap-2">
                <div className="w-40">
                  <Input etiqueta="Local (dentro de la RM)" tipo="numero" minimo={0} valor={viaticoLocal} onCambio={setViaticoLocal} />
                </div>
                <div className="w-40">
                  <Input etiqueta="Interregional" tipo="numero" minimo={0} valor={viaticoInterregional} onCambio={setViaticoInterregional} />
                </div>
                <Button variante="secundario" deshabilitado={guardandoViaticos} onPress={onGuardarViaticos}>
                  {guardandoViaticos ? "Guardando…" : "Guardar"}
                </Button>
              </div>
              {msgViaticos && (
                <div className="mt-2">
                  <Aviso tono={msgViaticos.tipo === "ok" ? "exito" : "error"}>{msgViaticos.texto}</Aviso>
                </div>
              )}
            </Card>
          </div>

          <div className="mt-4">
            <Card>
              <CabeceraColapsable
                titulo="Suscripción"
                abierto={suscripcionAbierta}
                onToggle={() => setSuscripcionAbierta((v) => !v)}
                extra={suscripcion?.suscripcion && <Estado estado={suscripcion.suscripcion.estado} />}
              />
              {suscripcionAbierta && (
                <div className="mt-3">
              {!suscripcion ? (
                <p className="text-sm text-ds-text-secondary">Cargando…</p>
              ) : !suscripcion.suscripcion ? (
                <p className="text-sm text-ds-text-secondary">Esta empresa todavía no tiene una suscripción registrada.</p>
              ) : (
                <div className="flex flex-col gap-3">
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div>
                      <p className="text-xs text-ds-text-secondary">Estado</p>
                      <p className="text-sm font-medium text-ds-text">{ETIQUETA_ESTADO_SUSCRIPCION[suscripcion.suscripcion.estado]}</p>
                    </div>
                    <div>
                      <p className="text-xs text-ds-text-secondary">Tarjeta</p>
                      <p className="text-sm font-medium text-ds-text">
                        {suscripcion.suscripcion.tarjeta_ultimos4
                          ? `${suscripcion.suscripcion.tarjeta_marca ?? "Tarjeta"} •••• ${suscripcion.suscripcion.tarjeta_ultimos4}`
                          : "Sin registrar"}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-ds-text-secondary">Próximo cobro</p>
                      <p className="text-sm font-medium text-ds-text">
                        {suscripcion.suscripcion.proxima_fecha_cobro
                          ? new Date(`${suscripcion.suscripcion.proxima_fecha_cobro}T00:00:00`).toLocaleDateString("es-CL")
                          : "—"}
                      </p>
                    </div>
                  </div>

                  {suscripcion.cobros.length > 0 && (
                    <div className="overflow-x-auto border-t border-ds-divider pt-3">
                      <table className="w-full text-left text-xs">
                        <thead>
                          <tr className="text-ds-text-secondary">
                            <th className="py-1.5 pr-4 font-medium">Fecha</th>
                            <th className="py-1.5 pr-4 font-medium">Monto</th>
                            <th className="py-1.5 pr-4 font-medium">Intento</th>
                            <th className="py-1.5 font-medium">Estado</th>
                          </tr>
                        </thead>
                        <tbody>
                          {suscripcion.cobros.map((c) => (
                            <tr key={c.id} className="border-t border-ds-divider">
                              <td className="py-1.5 pr-4 text-ds-text-secondary">{new Date(c.creado_en).toLocaleString("es-CL")}</td>
                              <td className="py-1.5 pr-4 text-ds-text">${Math.round(c.monto).toLocaleString("es-CL")}</td>
                              <td className="py-1.5 pr-4 text-ds-text-secondary">{c.intento_numero}</td>
                              <td className="py-1.5">
                                <Estado estado={c.estado} />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
                </div>
              )}
            </Card>
          </div>

          <div className="mt-4">
            <Card>
              {/* Tarea 124, etapa 2: el plan fija cuántos módulos puede tener
                  activos la empresa; acá se eligen cuáles. Mismo orden que el
                  menú (GRUPOS_MODULOS). El backend valida el tope igual
                  (403 LIMITE_PLAN); esto solo evita ofrecer lo que no cabe. */}
              {(() => {
                const tope = LIMITES_POR_PLAN[salud.empresa.plan]?.modulosMax ?? null;
                const activos = (modulos ?? []).filter((m) => m.activado && cuentaParaTope(m.modulo as Modulo)).length;
                const lleno = tope != null && activos >= tope;
                const estado = new Map((modulos ?? []).map((m) => [m.modulo, m.activado]));
                return (
                  <>
                    <CabeceraColapsable
                      titulo="Módulos"
                      abierto={modulosAbierto}
                      onToggle={() => setModulosAbierto((v) => !v)}
                      extra={
                        modulos ? (
                          <span className={`text-xs tabular-nums ${lleno ? "font-semibold text-ds-text" : "text-ds-text-secondary"}`}>
                            {tope != null ? `${activos} de ${tope} módulos` : `${activos} módulos · sin tope`}
                          </span>
                        ) : null
                      }
                    />
                    {modulosAbierto && (
                      <>
                        <p className="mb-3 mt-2 text-sm text-ds-text-secondary">
                          Desactivar un módulo lo oculta del menú y bloquea sus rutas para todos los usuarios de esta empresa, sin importar su
                          rol. El plan {ETIQUETA_PLAN[salud.empresa.plan]}{" "}
                          {tope != null ? `permite hasta ${tope} módulos activos.` : "no tiene tope de módulos."}
                        </p>
                        {lleno ? (
                          <p className="mb-3 text-sm text-ds-text">
                            Llegó al tope: para activar otro, apaga uno o cambia el plan a uno superior.
                          </p>
                        ) : null}
                        {!modulos ? (
                          <p className="text-sm text-ds-text-secondary">Cargando…</p>
                        ) : (
                          <div className="flex flex-col gap-4">
                            {GRUPOS_MODULOS.map((g) => (
                              <div key={g.titulo}>
                                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ds-text-secondary">{g.titulo}</p>
                                <div className="grid gap-2 sm:grid-cols-2">
                                  {g.modulos.map((modulo) => {
                                    const activado = estado.get(modulo) ?? false;
                                    const bloqueadoPorTope = !activado && g.cuenta && lleno;
                                    const sinIAEnPlan = modulo === "asistente" && !planPermiteIACompleta(salud.empresa.plan);
                                    return (
                                      <label
                                        key={modulo}
                                        className={`flex items-center gap-2 rounded-lg border border-ds-divider px-3 py-2 text-sm ${bloqueadoPorTope ? "opacity-60" : ""}`}
                                        title={bloqueadoPorTope ? "La empresa llegó al tope de módulos de su plan" : undefined}
                                      >
                                        <input
                                          type="checkbox"
                                          checked={activado}
                                          disabled={guardandoModulo === modulo || bloqueadoPorTope}
                                          onChange={(e) => onTogglearModulo(modulo, e.target.checked)}
                                        />
                                        <span className="text-ds-text">{ETIQUETA_MODULO[modulo] ?? modulo}</span>
                                        {sinIAEnPlan ? <span className="text-xs text-ds-text-secondary">(no incluido en este plan)</span> : null}
                                      </label>
                                    );
                                  })}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                        {errorModulos && (
                          <div className="mt-3">
                            <Aviso tono="error">{errorModulos}</Aviso>
                          </div>
                        )}
                      </>
                    )}
                  </>
                );
              })()}
            </Card>
          </div>

          <div className="mt-4">
            <Card>
              <CabeceraColapsable titulo="Perfiles y permisos (por rol)" abierto={perfilesAbierto} onToggle={() => setPerfilesAbierto((v) => !v)} />
              {perfilesAbierto && (
                <>
              <p className="mb-3 mt-2 text-sm text-ds-text-secondary">
                Qué módulos ve cada rol de esta empresa en la app y la web. Es lo mismo que el Admin de la empresa ajusta en
                Configuración → Perfiles, pero desde acá. El rol <span className="font-medium text-ds-text">Admin</span> siempre
                tiene acceso total; <span className="font-medium text-ds-text">Configuración</span> y{" "}
                <span className="font-medium text-ds-text">Grupo y usuario</span> se controlan desde la plantilla global del rol
                (<Link href="/superadmin/roles" className="text-ds-brand hover:underline">Roles</Link>). Un módulo atenuado no está en el
                plan de la empresa.
              </p>
              {!perfiles ? (
                <p className="text-sm text-ds-text-secondary">Cargando…</p>
              ) : (
                <div className="flex flex-col gap-4">
                  {perfiles.roles.map((rol) => (
                    <div key={rol.slug} className="rounded-lg border border-ds-divider p-3">
                      <div className="mb-3 flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-ds-text">{rol.nombre}</p>
                          <p className="text-xs text-ds-text-secondary">
                            {rol.es_sistema ? "Perfil de sistema" : "Perfil personalizado"} · {rol.slug}
                          </p>
                        </div>
                        {perfilSucio(rol.slug) && (
                          <Button onPress={() => guardarPerfil(rol.slug)} deshabilitado={guardandoPerfil === rol.slug}>
                            {guardandoPerfil === rol.slug ? "Guardando…" : "Guardar"}
                          </Button>
                        )}
                      </div>
                      <div className="grid gap-2 sm:grid-cols-2">
                        {perfiles.catalogo.map((c) => {
                          const marcado = (edicionPerfiles[rol.slug] ?? new Set()).has(c.modulo);
                          return (
                            <label
                              key={c.modulo}
                              className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm ${
                                c.contratado ? "border-ds-divider text-ds-text" : "border-dashed border-ds-divider text-ds-text-secondary"
                              }`}
                            >
                              <input
                                type="checkbox"
                                className="accent-ds-brand"
                                checked={marcado}
                                disabled={!c.contratado}
                                onChange={() => togglePerfil(rol.slug, c.modulo)}
                              />
                              <span>
                                {ETIQUETA_MODULO[c.modulo] ?? c.modulo}
                                {!c.contratado && <span className="ml-1 text-xs">(no está en el plan)</span>}
                              </span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {okPerfiles && (
                <div className="mt-3">
                  <Aviso tono="exito">{okPerfiles}</Aviso>
                </div>
              )}
              {errorPerfiles && (
                <div className="mt-3">
                  <Aviso tono="error">{errorPerfiles}</Aviso>
                </div>
              )}
                </>
              )}
            </Card>
          </div>

          <div className="mt-4">
            <Card>
              <CabeceraColapsable titulo="Correos y dominios autorizados" abierto={correosAbierto} onToggle={() => setCorreosAbierto((v) => !v)} />
              {correosAbierto && (
                <>
              <p className="mb-3 mt-2 text-sm text-ds-text-secondary">
                Un correo exacto (<code>persona@empresa.cl</code>) o un dominio entero (<code>empresa.cl</code>) de esta lista puede
                entrar a la empresa sin ser invitado — la primera vez que inicia sesión se le crea el usuario con el rol indicado.
                Un correo que no está acá ni fue invitado no puede entrar.
              </p>

              {accesos === null ? (
                <p className="text-sm text-ds-text-secondary">Cargando…</p>
              ) : accesos.length === 0 ? (
                <p className="text-sm text-ds-text-secondary">Sin correos ni dominios autorizados.</p>
              ) : (
                <div className="flex flex-col gap-2">
                  {accesos.map((a) => (
                    <div key={a.id} className="flex items-center justify-between gap-3 rounded-lg border border-ds-divider px-3 py-2 text-sm">
                      <span className="flex flex-wrap items-center gap-2">
                        <Estado estado={a.tipo} />
                        <span className="font-mono text-ds-text">{a.valor}</span>
                        <span className="text-ds-text-secondary">→ {rolesDisponibles.find((r) => r.slug === a.rol)?.nombre ?? a.rol}</span>
                      </span>
                      <Button variante="ghost" onPress={() => onQuitarAcceso(a.id)}>
                        Quitar
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              <form onSubmit={onAgregarAcceso} className="mt-4 grid gap-2 sm:grid-cols-[auto_1fr_auto_auto] sm:items-end">
                <Select
                  etiqueta="Tipo"
                  valor={accesoTipo}
                  onCambio={(v) => setAccesoTipo(v as "correo" | "dominio")}
                  opciones={[
                    { valor: "correo", etiqueta: "Correo" },
                    { valor: "dominio", etiqueta: "Dominio" },
                  ]}
                />
                <Input
                  etiqueta={accesoTipo === "correo" ? "Correo" : "Dominio"}
                  valor={accesoValor}
                  onCambio={setAccesoValor}
                  autoCapitalizar={false}
                  placeholder={accesoTipo === "correo" ? "persona@empresa.cl" : "empresa.cl"}
                />
                <Select etiqueta="Rol" valor={accesoRol} onCambio={setAccesoRol} opciones={rolesDisponibles.map((r) => ({ valor: r.slug, etiqueta: r.nombre }))} />
                <Button tipo="submit" deshabilitado={guardandoAcceso || accesoValor.trim().length < 3}>
                  {guardandoAcceso ? "Agregando…" : "Agregar"}
                </Button>
              </form>
              {errorAcceso && (
                <div className="mt-3">
                  <Aviso tono="error">{errorAcceso}</Aviso>
                </div>
              )}
                </>
              )}
            </Card>
          </div>

          <div className="mt-4">
            <Card>
              <CabeceraColapsable titulo="Equipo" abierto={equipoAbierto} onToggle={() => setEquipoAbierto((v) => !v)} />
              {equipoAbierto && (
                <>
              <p className="mb-3 mt-2 text-sm text-ds-text-secondary">
                Restablece la contraseña de un usuario si quedó bloqueado — se genera una clave temporal que reemplaza la actual de
                inmediato. Se muestra una sola vez acá, no se guarda en ningún lado; pásasela por el canal de soporte que uses.
              </p>

              <form onSubmit={onInvitarUsuario} className="mb-4 rounded-lg border border-ds-divider p-3">
                <h3 className="mb-2 text-sm font-semibold text-ds-text">Invitar un usuario a esta empresa</h3>
                <p className="mb-3 text-ds-micro text-ds-text-secondary">
                  Se le manda un correo con el enlace para definir su contraseña. No cuenta contra el límite de usuarios del plan.
                </p>
                <div className="grid gap-3 sm:grid-cols-3">
                  <Input etiqueta="Nombre" valor={nuevoNombre} onCambio={setNuevoNombre} />
                  <Input etiqueta="Correo" tipo="email" autoCapitalizar={false} valor={nuevoCorreo} onCambio={setNuevoCorreo} />
                  <Select etiqueta="Rol" valor={nuevoRol} onCambio={setNuevoRol} opciones={rolesDisponibles.map((r) => ({ valor: r.slug, etiqueta: r.nombre }))} />
                </div>
                {errorInvitar && (
                  <div className="mt-3">
                    <Aviso tono="error">{errorInvitar}</Aviso>
                  </div>
                )}
                {avisoInvitar && (
                  <div className="mt-3">
                    <Aviso tono="exito">{avisoInvitar}</Aviso>
                  </div>
                )}
                <div className="mt-3">
                  <Button tipo="submit" deshabilitado={invitando || !nuevoNombre.trim() || !nuevoCorreo.trim()}>
                    {invitando ? "Invitando…" : "Enviar invitación"}
                  </Button>
                </div>
              </form>

              {impersonarUsuario && (
                <div className="mb-4 rounded-lg border border-ds-danger/40 bg-ds-danger-soft p-3">
                  <p className="text-sm font-semibold text-ds-text">Impersonar a {impersonarUsuario.nombre}</p>
                  <p className="mt-1 text-xs text-ds-text-secondary">
                    Vas a entrar a Bitácora viendo lo que ve {impersonarUsuario.nombre}, sin conocer ni cambiar su contraseña. La sesión
                    dura 30 minutos, las acciones destructivas quedan bloqueadas, y todo (inicio y fin) queda registrado con esta
                    justificación en la auditoría.
                  </p>
                  <div className="mt-3">
                    <Textarea
                      etiqueta="Justificación (obligatoria, mín. 20 caracteres)"
                      filas={2}
                      valor={justificacionImp}
                      onCambio={setJustificacionImp}
                      placeholder="Ej: el usuario reporta que no puede firmar la OS #142 desde el celular, replicando para ver el error"
                    />
                  </div>
                  {errorImp && (
                    <div className="mt-2">
                      <Aviso tono="error">{errorImp}</Aviso>
                    </div>
                  )}
                  <div className="mt-3 flex gap-2">
                    <Button
                      variante="peligro"
                      deshabilitado={iniciandoImp || justificacionImp.trim().length < 20}
                      onPress={onIniciarImpersonacion}
                    >
                      {iniciandoImp ? "Entrando…" : `Entrar como ${impersonarUsuario.nombre}`}
                    </Button>
                    <Button variante="ghost" onPress={() => setImpersonarUsuario(null)}>
                      Cancelar
                    </Button>
                  </div>
                </div>
              )}

              {restablecerUsuario && (
                <div className="mb-4 flex flex-wrap items-end gap-2">
                  <div className="min-w-[220px] max-w-xs flex-1">
                    <Input
                      etiqueta={`Contraseña para ${restablecerUsuario.nombre} — vacío genera una automática`}
                      valor={passwordPersonalizada}
                      onCambio={setPasswordPersonalizada}
                      placeholder="Mínimo 8 caracteres"
                    />
                  </div>
                  <Button
                    deshabilitado={restableciendoId === restablecerUsuario.id}
                    onPress={() => onRestablecerPassword(restablecerUsuario.id, restablecerUsuario.nombre)}
                  >
                    {restableciendoId === restablecerUsuario.id ? "Restableciendo…" : "Restablecer"}
                  </Button>
                  <Button
                    variante="ghost"
                    onPress={() => {
                      setRestablecerUsuario(null);
                      setErrorUsuarios(null);
                    }}
                  >
                    Cancelar
                  </Button>
                  {errorUsuarios && <Aviso tono="error">{errorUsuarios}</Aviso>}
                </div>
              )}

              {passwordGenerada && (
                <div className="mb-3 rounded-lg border border-ds-brand/40 bg-ds-brand/[0.08] p-3 text-sm">
                  <p className="font-medium text-ds-text">
                    Nueva contraseña de {passwordGenerada.nombre}: <span className="font-mono">{passwordGenerada.password}</span>
                  </p>
                  <p className="mt-1 text-xs text-ds-text-secondary">Copiala ahora — no se vuelve a mostrar.</p>
                </div>
              )}
              {secretoTotpGenerado && (
                <div className="mb-3 rounded-lg border border-ds-brand/40 bg-ds-brand/[0.08] p-3 text-sm">
                  <p className="font-medium text-ds-text">
                    Clave TOTP de {secretoTotpGenerado.nombre}: <span className="font-mono">{secretoTotpGenerado.secreto}</span>
                  </p>
                  <p className="mt-1 text-xs text-ds-text-secondary">
                    Cárgala a mano en Google Authenticator/Authy/1Password — no se vuelve a mostrar.
                  </p>
                </div>
              )}
              {!usuarios ? (
                <p className="text-sm text-ds-text-secondary">Cargando…</p>
              ) : usuarios.length === 0 ? (
                <p className="text-sm text-ds-text-secondary">Esta empresa todavía no tiene usuarios.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="text-xs text-ds-text-secondary">
                        <th className="py-1.5 pr-4 font-medium">Nombre</th>
                        <th className="py-1.5 pr-4 font-medium">Correo</th>
                        <th className="py-1.5 pr-4 font-medium">Rol</th>
                        <th className="py-1.5 pr-4 font-medium">Estado</th>
                        <th className="py-1.5 pr-4 font-medium">2FA</th>
                        <th className="py-1.5 font-medium"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {usuarios.map((u) => (
                        <tr key={u.id} className="border-t border-ds-divider">
                          <td className="py-2 pr-4 text-ds-text">{u.nombre}</td>
                          <td className="py-2 pr-4 text-ds-text-secondary">{u.correo ?? "—"}</td>
                          <td className="py-2 pr-4 text-ds-text-secondary">{u.rol}</td>
                          <td className="py-2 pr-4">
                            <Estado estado={u.activo ? "activo" : "inactivo"} />
                          </td>
                          <td className="py-2 pr-4 text-ds-text-secondary">{u.mfa_activado ? `Activo (${u.mfa_metodo})` : "Inactivo"}</td>
                          <td className="py-2">
                            <div className="flex flex-wrap justify-end gap-2">
                              <Button
                                variante="secundario"
                                deshabilitado={!u.activo}
                                onPress={() => {
                                  setImpersonarUsuario({ id: u.id, nombre: u.nombre });
                                  setJustificacionImp("");
                                  setErrorImp(null);
                                }}
                              >
                                Impersonar
                              </Button>
                              <Button
                                variante="secundario"
                                onPress={() => {
                                  setRestablecerUsuario({ id: u.id, nombre: u.nombre });
                                  setPasswordPersonalizada("");
                                  setPasswordGenerada(null);
                                  setErrorUsuarios(null);
                                }}
                              >
                                Restablecer contraseña
                              </Button>
                              <Button
                                variante="secundario"
                                deshabilitado={cambiandoMfaId === u.id}
                                onPress={() => onActivarMfa(u.id, u.nombre)}
                              >
                                {cambiandoMfaId === u.id
                                  ? "Generando…"
                                  : u.mfa_activado
                                    ? "Regenerar código TOTP"
                                    : "Activar 2FA (TOTP)"}
                              </Button>
                              {u.mfa_activado && (
                                <Button
                                  variante="secundario"
                                  deshabilitado={cambiandoMfaId === u.id}
                                  onPress={() => onDesactivarMfa(u.id, u.nombre, u.rol)}
                                >
                                  {cambiandoMfaId === u.id ? "Desactivando…" : "Desactivar 2FA"}
                                </Button>
                              )}
                              <Button
                                variante="secundario"
                                deshabilitado={cambiandoEstadoId === u.id}
                                onPress={() => onCambiarEstadoUsuario(u.id, u.nombre, !u.activo)}
                              >
                                {cambiandoEstadoId === u.id ? "Guardando…" : u.activo ? "Desactivar" : "Reactivar"}
                              </Button>
                              <Button
                                variante="peligro"
                                onPress={() => {
                                  setEliminarUsuario({ id: u.id, nombre: u.nombre });
                                  setConfirmacionEliminarUsuario("");
                                  setErrorEliminarUsuario(null);
                                }}
                              >
                                Eliminar
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {errorUsuarios && (
                <div className="mt-3">
                  <Aviso tono="error">{errorUsuarios}</Aviso>
                </div>
              )}

              {eliminarUsuario && (
                <div className="mt-4 rounded-lg border border-ds-danger/40 bg-ds-danger/5 p-4">
                  <p className="text-sm font-semibold text-ds-text">Eliminar o anonimizar a {eliminarUsuario.nombre}</p>
                  <p className="mt-1 text-sm text-ds-text-secondary">
                    <span className="font-medium">Eliminar</span> borra la cuenta y libera el correo — solo si no tiene
                    trabajos/OS, rutas, fotos ni informes. <span className="font-medium">Anonimizar</span> (Ley 21.719)
                    reemplaza nombre/RUT/contacto por un placeholder y borra contrato, accesos y consentimientos, dejando
                    los registros operativos sin nombre de persona. Ambas son irreversibles.
                  </p>
                  <label htmlFor="confirmar-eliminar-usuario" className="mt-ds-3 block text-ds-caption font-ds-body font-medium text-ds-text/70">
                    Escribe <span className="font-mono text-ds-text">{eliminarUsuario.nombre}</span> para confirmar
                  </label>
                  <div className="mt-ds-1 max-w-sm">
                    <Input id="confirmar-eliminar-usuario" valor={confirmacionEliminarUsuario} onCambio={setConfirmacionEliminarUsuario} />
                  </div>
                  {errorEliminarUsuario && (
                    <div className="mt-2">
                      <Aviso tono="error">{errorEliminarUsuario}</Aviso>
                    </div>
                  )}
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button
                      variante="peligro"
                      deshabilitado={eliminandoUsuario || confirmacionEliminarUsuario.trim() !== eliminarUsuario.nombre}
                      onPress={onEliminarUsuario}
                    >
                      {eliminandoUsuario ? "Eliminando…" : "Eliminar definitivamente"}
                    </Button>
                    <Button
                      variante="peligro"
                      deshabilitado={anonimizandoUsuario || confirmacionEliminarUsuario.trim() !== eliminarUsuario.nombre}
                      onPress={onAnonimizarUsuario}
                    >
                      {anonimizandoUsuario ? "Anonimizando…" : "Anonimizar (Ley 21.719)"}
                    </Button>
                    <Button variante="ghost" onPress={() => setEliminarUsuario(null)}>
                      Cancelar
                    </Button>
                  </div>
                </div>
              )}
                </>
              )}
            </Card>
          </div>

          <div className="mt-4">
            <Card>
              <CabeceraColapsable titulo="Anonimizar un cliente (Ley 21.719)" abierto={anonClienteAbierto} onToggle={() => setAnonClienteAbierto((v) => !v)} />
              {anonClienteAbierto && (
                <>
              <p className="mb-3 mt-2 text-sm text-ds-text-secondary">
                Reemplaza nombre/RUT/contacto del cliente por un placeholder y borra sus accesos al Portal y consentimientos.
                Los trabajos/cobros quedan sin nombre de persona. Irreversible. El ID sale del export de la empresa o de la base.
              </p>
              <div className="flex flex-wrap items-end gap-2">
                <div className="w-72">
                  <Input etiqueta="ID del cliente" autoCapitalizar={false} valor={clienteAnonId} onCambio={setClienteAnonId} />
                </div>
                <div className="w-56">
                  <Input etiqueta="Nombre exacto (confirmación)" valor={clienteAnonNombre} onCambio={setClienteAnonNombre} />
                </div>
                <Button variante="peligro" deshabilitado={anonimizandoCliente} onPress={onAnonimizarCliente}>
                  {anonimizandoCliente ? "Anonimizando…" : "Anonimizar"}
                </Button>
              </div>
              {msgAnonCliente && (
                <div className="mt-2">
                  <Aviso tono={msgAnonCliente.tipo === "ok" ? "exito" : "error"}>{msgAnonCliente.texto}</Aviso>
                </div>
              )}
                </>
              )}
            </Card>
          </div>

          <div className="mt-4">
            <Card>
              <CabeceraColapsable titulo="Exportar datos" abierto={exportarAbierto} onToggle={() => setExportarAbierto((v) => !v)} />
              {exportarAbierto && (
                <>
              <p className="mb-3 mt-2 text-sm text-ds-text-secondary">
                Genera un archivo con todos los datos de esta empresa (para portabilidad si se da de baja). No incluye el contenido de
                fotos/PDFs, solo las referencias ya guardadas.
              </p>
              <Button variante="secundario" deshabilitado={exportando} onPress={onExportar}>
                {exportando ? "Generando…" : "Exportar datos"}
              </Button>
              {errorExportar && (
                <div className="mt-3">
                  <Aviso tono="error">{errorExportar}</Aviso>
                </div>
              )}
                </>
              )}
            </Card>
          </div>

          <div className="mt-4">
            <Card>
              <button
                type="button"
                onClick={() => setZonaPeligroAbierta((v) => !v)}
                className="flex w-full items-center justify-between gap-2 text-left"
              >
                <h2 className="flex items-center gap-2 text-sm font-semibold text-ds-danger">
                  <IconShield className="h-4 w-4" />
                  Zona de peligro
                </h2>
                <IconChevronDown className={`h-4 w-4 shrink-0 text-ds-text-secondary transition-transform ${zonaPeligroAbierta ? "rotate-180" : ""}`} />
              </button>
              {zonaPeligroAbierta && (
                <>
              <p className="mb-4 mt-3 text-sm text-ds-text-secondary">
                Eliminar la empresa borra <strong>permanentemente</strong> a {salud.empresa.nombre} — clientes, cotizaciones, órdenes de
                servicio, cobranzas y todo lo demás. Esta acción no se puede deshacer.
              </p>
              <div className="max-w-sm">
                <Input etiqueta={`Escribe “${salud.empresa.nombre}” para confirmar`} valor={confirmacionEliminar} onCambio={setConfirmacionEliminar} />
              </div>
              {errorEliminar && (
                <div className="mt-3">
                  <Aviso tono="error">{errorEliminar}</Aviso>
                </div>
              )}
              <div className="mt-4">
                <Button variante="peligro" onPress={onEliminar} deshabilitado={eliminando || confirmacionEliminar !== salud.empresa.nombre}>
                  {eliminando ? "Eliminando…" : "Eliminar empresa"}
                </Button>
              </div>
                </>
              )}
            </Card>
          </div>
        </>
      )}
    </SuperAdminShell>
  );
}
