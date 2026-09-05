"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import type { EstadoEmpresa, Plan, Rubro, Suscripcion, SuscripcionCobro } from "@bitacora/shared";
import { SuperAdminShell } from "@/components/SuperAdminShell";
import { Badge, Button, Card, ErrorText, Input, Label, PageHeader, Select, SuccessText, Textarea } from "@/components/ui";
import { IconChevronLeft, IconShield } from "@/components/icons";
import { obtenerTokenSuperAdmin, superadminFetch } from "@/lib/superadminApi";
import { guardarImpersonacion } from "@/lib/impersonacion";
import { ETIQUETA_MODULO } from "@/lib/etiquetasModulo";

const ESTADOS: EstadoEmpresa[] = ["activa", "suspendida", "dada_de_baja"];
const PLANES: Plan[] = ["trial", "basico", "pro"];
const RUBROS: { value: Rubro; label: string }[] = [
  { value: "transporte", label: "Transporte" },
  { value: "servicio_tecnico", label: "Servicio técnico / mantención" },
  { value: "cosmetologia", label: "Cosmetología / belleza" },
  { value: "otro", label: "Otro" },
];

type Salud = {
  empresa: { id: string; nombre: string; estado: EstadoEmpresa; plan: Plan; rut: string | null; rubro: Rubro; dada_de_baja_en: string | null };
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

function formatearBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
}

export default function SuperAdminSaludEmpresaPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [salud, setSalud] = useState<Salud | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [editandoIdentidad, setEditandoIdentidad] = useState(false);
  const [nombreEdit, setNombreEdit] = useState("");
  const [rutEdit, setRutEdit] = useState("");
  const [rubroEdit, setRubroEdit] = useState<Rubro>("otro");
  const [guardandoIdentidad, setGuardandoIdentidad] = useState(false);
  const [errorIdentidad, setErrorIdentidad] = useState<string | null>(null);

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
  const [suscripcion, setSuscripcion] = useState<{ prueba_termina_en: string | null; suscripcion: Suscripcion | null; cobros: SuscripcionCobro[] } | null>(
    null
  );
  const [nuevaFechaPrueba, setNuevaFechaPrueba] = useState("");
  const [guardandoPrueba, setGuardandoPrueba] = useState(false);
  const [errorPrueba, setErrorPrueba] = useState<string | null>(null);

  const [usuarios, setUsuarios] = useState<
    { id: string; nombre: string; rol: string; activo: boolean; correo: string | null; mfa_activado: boolean; mfa_metodo: string | null }[] | null
  >(null);
  const [errorUsuarios, setErrorUsuarios] = useState<string | null>(null);
  const [restableciendoId, setRestableciendoId] = useState<string | null>(null);
  const [passwordGenerada, setPasswordGenerada] = useState<{ usuarioId: string; nombre: string; password: string } | null>(null);
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

  const [flags, setFlags] = useState<{ flag: string; activado: boolean; activado_en: string }[] | null>(null);
  const [nuevoFlag, setNuevoFlag] = useState("");
  const [guardandoFlag, setGuardandoFlag] = useState(false);
  const [errorFlag, setErrorFlag] = useState<string | null>(null);

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
      setNuevaFechaPrueba(datos.prueba_termina_en ?? "");
    }
  }

  async function cargarUsuarios() {
    const res = await superadminFetch(`/api/superadmin/empresas/${params.id}/usuarios`);
    if (res.ok) setUsuarios(await res.json());
  }

  async function cargarFlags() {
    const res = await superadminFetch(`/api/superadmin/empresas/${params.id}/feature-flags`);
    if (res.ok) setFlags(await res.json());
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
    cargarUsuarios();
    cargarFlags();
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

  async function onActivarFlag(e: React.FormEvent) {
    e.preventDefault();
    setErrorFlag(null);
    setGuardandoFlag(true);
    const res = await superadminFetch(`/api/superadmin/empresas/${params.id}/feature-flags`, {
      method: "POST",
      body: JSON.stringify({ flag: nuevoFlag.trim().toLowerCase() }),
    });
    setGuardandoFlag(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setErrorFlag(body.error ?? "No se pudo activar el flag");
      return;
    }
    setNuevoFlag("");
    cargarFlags();
  }

  async function onDesactivarFlag(flag: string) {
    setErrorFlag(null);
    const res = await superadminFetch(`/api/superadmin/empresas/${params.id}/feature-flags/desactivar`, {
      method: "POST",
      body: JSON.stringify({ flag }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setErrorFlag(body.error ?? "No se pudo desactivar el flag");
      return;
    }
    cargarFlags();
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
    if (!confirm(`¿Restablecer la contraseña de ${nombre}? La contraseña actual dejará de funcionar de inmediato.`)) return;
    setErrorUsuarios(null);
    setPasswordGenerada(null);
    setRestableciendoId(usuarioId);
    const res = await superadminFetch(`/api/superadmin/empresas/${params.id}/usuarios/${usuarioId}/restablecer-password`, {
      method: "POST",
    });
    setRestableciendoId(null);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setErrorUsuarios(body.error ?? "No se pudo restablecer la contraseña");
      return;
    }
    const { password } = await res.json();
    setPasswordGenerada({ usuarioId, nombre, password });
  }

  async function onActivarMfa(usuarioId: string, nombre: string) {
    if (!confirm(`¿Activar 2FA (TOTP) para ${nombre}? Se genera una clave nueva — si ya tenía una configurada en su app, dejará de servir.`)) return;
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
      rol === "admin" || rol === "supervisor"
        ? " Su rol EXIGE 2FA activo — hasta que lo vuelva a activar (o cambie de rol), va a quedar bloqueado del resto de la app."
        : "";
    if (!confirm(`¿Desactivar el 2FA de ${nombre}?${avisoRol}`)) return;
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
    if (!confirm(`¿${activo ? "Reactivar" : "Desactivar"} a ${nombre}?${aviso}`)) return;
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

  async function onExtenderPrueba() {
    setErrorPrueba(null);
    setGuardandoPrueba(true);
    const res = await superadminFetch(`/api/superadmin/empresas/${params.id}/prueba`, {
      method: "PATCH",
      body: JSON.stringify({ prueba_termina_en: nuevaFechaPrueba }),
    });
    setGuardandoPrueba(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setErrorPrueba(body.error ?? "No se pudo extender la prueba");
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

  async function onCambiarEstado(nuevo: EstadoEmpresa) {
    if (!confirm(`¿Cambiar el estado a "${nuevo.replaceAll("_", " ")}"?`)) return;
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
      <Link href="/superadmin" className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-brand hover:underline">
        <IconChevronLeft className="h-4 w-4" />
        Empresas
      </Link>

      {error && <ErrorText>{error}</ErrorText>}

      {salud && (
        <>
          <PageHeader
            title={salud.empresa.nombre}
            subtitle="Salud y uso — sin datos operativos internos"
            action={
              <div className="flex items-center gap-2">
                <Badge value={salud.empresa.estado} />
                {!editandoIdentidad && (
                  <Button type="button" variant="outline" onClick={() => setEditandoIdentidad(true)}>
                    Editar identidad
                  </Button>
                )}
              </div>
            }
          />

          {editandoIdentidad && (
            <Card className="my-6 border-brand/40">
              <h2 className="mb-3 text-sm font-semibold text-foreground">Editar identidad</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label>Nombre de la empresa</Label>
                  <Input type="text" value={nombreEdit} onChange={(e) => setNombreEdit(e.target.value)} />
                </div>
                <div>
                  <Label>RUT</Label>
                  <Input type="text" placeholder="76.123.456-7" value={rutEdit} onChange={(e) => setRutEdit(e.target.value)} />
                </div>
                <div>
                  <Label>Rubro</Label>
                  <Select value={rubroEdit} onChange={(e) => setRubroEdit(e.target.value as Rubro)}>
                    {RUBROS.map((r) => (
                      <option key={r.value} value={r.value}>
                        {r.label}
                      </option>
                    ))}
                  </Select>
                  <p className="mt-1 text-xs text-muted">
                    Cosmetología activa el tema visual "Vino y eucalipto" en la app móvil (pantallas de reserva).
                  </p>
                </div>
              </div>
              {errorIdentidad && (
                <div className="mt-3">
                  <ErrorText>{errorIdentidad}</ErrorText>
                </div>
              )}
              <div className="mt-4 flex gap-2">
                <Button type="button" disabled={guardandoIdentidad || !nombreEdit.trim()} onClick={onGuardarIdentidad}>
                  {guardandoIdentidad ? "Guardando…" : "Guardar"}
                </Button>
                <Button type="button" variant="ghost" onClick={() => setEditandoIdentidad(false)}>
                  Cancelar
                </Button>
              </div>
            </Card>
          )}

          <div className="my-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card>
              <p className="text-xs text-muted">Última actividad</p>
              <p className="mt-1 text-lg font-semibold text-foreground">
                {salud.ultima_actividad ? new Date(salud.ultima_actividad).toLocaleString("es-CL") : "Sin registro"}
              </p>
            </Card>
            <Card>
              <p className="text-xs text-muted">Usuarios activos este mes</p>
              <p className="mt-1 text-lg font-semibold text-foreground">{salud.usuarios_activos_mes}</p>
            </Card>
            <Card>
              <p className="text-xs text-muted">OS creadas este mes</p>
              <p className="mt-1 text-lg font-semibold text-foreground">{salud.os_creadas_mes}</p>
            </Card>
            <Card>
              <p className="text-xs text-muted">Almacenamiento usado</p>
              <p className="mt-1 text-lg font-semibold text-foreground">{formatearBytes(salud.almacenamiento_bytes)}</p>
              {!salud.almacenamiento_incluye_avatares && (
                <p className="mt-1 text-[11px] text-muted">No incluye fotos de perfil (volumen marginal)</p>
              )}
            </Card>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <h2 className="mb-3 text-sm font-semibold text-foreground">Consumo de Claude este mes</h2>
              <div className="flex gap-6">
                <div>
                  <p className="text-xs text-muted">Tokens de entrada</p>
                  <p className="text-lg font-semibold text-foreground">{salud.consumo_ia_mes.tokens_entrada.toLocaleString("es-CL")}</p>
                </div>
                <div>
                  <p className="text-xs text-muted">Tokens de salida</p>
                  <p className="text-lg font-semibold text-foreground">{salud.consumo_ia_mes.tokens_salida.toLocaleString("es-CL")}</p>
                </div>
              </div>
              {Object.keys(salud.consumo_ia_mes.por_feature).length > 0 && (
                <div className="mt-4 flex flex-col gap-1.5 border-t border-border pt-3">
                  {Object.entries(salud.consumo_ia_mes.por_feature).map(([feature, tokens]) => (
                    <div key={feature} className="flex items-center justify-between text-xs">
                      <span className="text-muted">{ETIQUETA_FEATURE[feature] ?? feature}</span>
                      <span className="text-foreground">
                        {(tokens.tokens_entrada + tokens.tokens_salida).toLocaleString("es-CL")} tokens
                      </span>
                    </div>
                  ))}
                </div>
              )}
              <p className="mt-3 text-[11px] text-muted">
                El costo exacto depende del precio vigente por token — revisa console.anthropic.com para calcularlo.
              </p>
            </Card>

            <Card>
              <h2 className="mb-3 text-sm font-semibold text-foreground">Errores recientes</h2>
              {salud.errores_recientes.length === 0 ? (
                <p className="text-sm text-muted">Sin errores recientes.</p>
              ) : (
                <div className="flex flex-col divide-y divide-border">
                  {salud.errores_recientes.map((e, i) => (
                    <div key={i} className="py-2 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-foreground">{e.ruta}</span>
                        <span className="text-muted">{new Date(e.creado_en).toLocaleString("es-CL")}</span>
                      </div>
                      <p className="mt-0.5 text-muted">{e.mensaje}</p>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <Card>
              <h2 className="mb-3 text-sm font-semibold text-foreground">Estado</h2>
              <p className="mb-3 text-sm text-muted">
                Estado actual: <Badge value={salud.empresa.estado} />
              </p>
              {salud.empresa.estado === "dada_de_baja" && salud.empresa.dada_de_baja_en && (
                <p className="mb-3 rounded-lg bg-amber-50 p-2 text-xs text-amber-900">
                  Dada de baja el {new Date(salud.empresa.dada_de_baja_en).toLocaleDateString("es-CL")} (
                  {Math.floor((Date.now() - new Date(salud.empresa.dada_de_baja_en).getTime()) / 86400000)} días).
                  Ley 21.719 — evaluar eliminar sus datos personales pasado el plazo de conservación.
                </p>
              )}
              <div className="flex flex-wrap gap-2">
                {ESTADOS.filter((e) => e !== salud.empresa.estado).map((e) => (
                  <Button key={e} type="button" variant="outline" disabled={guardandoEstado} onClick={() => onCambiarEstado(e)}>
                    {e === "activa" ? "Activar" : e === "suspendida" ? "Suspender" : "Dar de baja"}
                  </Button>
                ))}
              </div>
              {errorEstado && (
                <div className="mt-3">
                  <ErrorText>{errorEstado}</ErrorText>
                </div>
              )}
              <p className="mt-3 text-[11px] text-muted">
                Suspendida o dada de baja bloquea el acceso a la app completa para todos los usuarios de esta empresa de inmediato.
              </p>
            </Card>

            <Card>
              <h2 className="mb-3 text-sm font-semibold text-foreground">Plan</h2>
              <div className="flex items-end gap-2">
                <div className="flex-1">
                  <Label>Plan actual</Label>
                  <Select value={planSeleccionado} onChange={(e) => setPlanSeleccionado(e.target.value as Plan)}>
                    {PLANES.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </Select>
                </div>
                <Button type="button" disabled={guardandoPlan || planSeleccionado === salud.empresa.plan} onClick={onGuardarPlan}>
                  {guardandoPlan ? "Guardando…" : "Guardar"}
                </Button>
              </div>
              {errorPlan && (
                <div className="mt-3">
                  <ErrorText>{errorPlan}</ErrorText>
                </div>
              )}
              <p className="mt-3 text-[11px] text-muted">
                Cambiar el plan acá activa/desactiva automáticamente los módulos opt-in de Pro (mismo camino que usa la empresa
                al autogestionarse desde Configuración &gt; Plan) y queda en el historial visible para la empresa.
              </p>
            </Card>
          </div>

          <Card className="mt-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-foreground">Suscripción</h2>
              {suscripcion?.suscripcion && <Badge value={suscripcion.suscripcion.estado} />}
            </div>
            {!suscripcion ? (
              <p className="text-sm text-muted">Cargando…</p>
            ) : !suscripcion.suscripcion ? (
              <p className="text-sm text-muted">Esta empresa todavía no tiene una suscripción registrada.</p>
            ) : (
              <div className="flex flex-col gap-3">
                <div className="grid gap-3 sm:grid-cols-3">
                  <div>
                    <p className="text-xs text-muted">Estado</p>
                    <p className="text-sm font-medium text-foreground">{ETIQUETA_ESTADO_SUSCRIPCION[suscripcion.suscripcion.estado]}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted">Tarjeta</p>
                    <p className="text-sm font-medium text-foreground">
                      {suscripcion.suscripcion.tarjeta_ultimos4
                        ? `${suscripcion.suscripcion.tarjeta_marca ?? "Tarjeta"} •••• ${suscripcion.suscripcion.tarjeta_ultimos4}`
                        : "Sin registrar"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted">Próximo cobro</p>
                    <p className="text-sm font-medium text-foreground">
                      {suscripcion.suscripcion.proxima_fecha_cobro
                        ? new Date(`${suscripcion.suscripcion.proxima_fecha_cobro}T00:00:00`).toLocaleDateString("es-CL")
                        : "—"}
                    </p>
                  </div>
                </div>

                {suscripcion.cobros.length > 0 && (
                  <div className="overflow-x-auto border-t border-border pt-3">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="text-muted">
                          <th className="py-1.5 pr-4 font-medium">Fecha</th>
                          <th className="py-1.5 pr-4 font-medium">Monto</th>
                          <th className="py-1.5 pr-4 font-medium">Intento</th>
                          <th className="py-1.5 font-medium">Estado</th>
                        </tr>
                      </thead>
                      <tbody>
                        {suscripcion.cobros.map((c) => (
                          <tr key={c.id} className="border-t border-border">
                            <td className="py-1.5 pr-4 text-muted">{new Date(c.creado_en).toLocaleString("es-CL")}</td>
                            <td className="py-1.5 pr-4 text-foreground">${Math.round(c.monto).toLocaleString("es-CL")}</td>
                            <td className="py-1.5 pr-4 text-muted">{c.intento_numero}</td>
                            <td className="py-1.5">
                              <Badge value={c.estado} />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                <div className="border-t border-border pt-3">
                  <Label>Extender período de prueba (cortesía comercial)</Label>
                  <div className="flex items-end gap-2">
                    <Input type="date" value={nuevaFechaPrueba} onChange={(e) => setNuevaFechaPrueba(e.target.value)} className="max-w-xs" />
                    <Button type="button" variant="outline" disabled={guardandoPrueba || !nuevaFechaPrueba} onClick={onExtenderPrueba}>
                      {guardandoPrueba ? "Guardando…" : "Guardar"}
                    </Button>
                  </div>
                  {errorPrueba && (
                    <div className="mt-2">
                      <ErrorText>{errorPrueba}</ErrorText>
                    </div>
                  )}
                  <p className="mt-2 text-[11px] text-muted">
                    El estado de facturación en sí (activa/suspendida por pago/cancelada) lo actualiza automáticamente el webhook de
                    Flow — acá solo se puede extender la fecha de fin de prueba.
                  </p>
                </div>
              </div>
            )}
          </Card>

          <Card className="mt-4">
            <h2 className="mb-2 text-sm font-semibold text-foreground">Módulos contratados</h2>
            <p className="mb-3 text-sm text-muted">
              Desactivar un módulo lo oculta del menú y bloquea sus rutas para todos los usuarios de esta empresa, sin importar su rol.
            </p>
            {!modulos ? (
              <p className="text-sm text-muted">Cargando…</p>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2">
                {modulos.map((m) => (
                  <label key={m.modulo} className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm">
                    <input
                      type="checkbox"
                      checked={m.activado}
                      disabled={guardandoModulo === m.modulo}
                      onChange={(e) => onTogglearModulo(m.modulo, e.target.checked)}
                    />
                    <span className="text-foreground">{ETIQUETA_MODULO[m.modulo] ?? m.modulo}</span>
                  </label>
                ))}
              </div>
            )}
            {errorModulos && (
              <div className="mt-3">
                <ErrorText>{errorModulos}</ErrorText>
              </div>
            )}
          </Card>

          <Card className="mt-4">
            <h2 className="mb-2 text-sm font-semibold text-foreground">Perfiles y permisos (por rol)</h2>
            <p className="mb-3 text-sm text-muted">
              Qué módulos ve cada rol de esta empresa en la app y la web. Es lo mismo que el Admin de la empresa ajusta en
              Configuración → Perfiles, pero desde acá. El rol <span className="font-medium text-foreground">Admin</span> siempre
              tiene acceso total; <span className="font-medium text-foreground">Configuración</span> y{" "}
              <span className="font-medium text-foreground">Grupo y usuario</span> se controlan desde la plantilla global del rol
              (<Link href="/superadmin/roles" className="text-brand hover:underline">Roles</Link>). Un módulo atenuado no está en el
              plan de la empresa.
            </p>
            {!perfiles ? (
              <p className="text-sm text-muted">Cargando…</p>
            ) : (
              <div className="flex flex-col gap-4">
                {perfiles.roles.map((rol) => (
                  <div key={rol.slug} className="rounded-lg border border-border p-3">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-foreground">{rol.nombre}</p>
                        <p className="text-xs text-muted">
                          {rol.es_sistema ? "Perfil de sistema" : "Perfil personalizado"} · {rol.slug}
                        </p>
                      </div>
                      {perfilSucio(rol.slug) && (
                        <Button type="button" onClick={() => guardarPerfil(rol.slug)} disabled={guardandoPerfil === rol.slug}>
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
                              c.contratado ? "border-border text-foreground" : "border-dashed border-border text-muted"
                            }`}
                          >
                            <input
                              type="checkbox"
                              className="accent-brand"
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
                <SuccessText>{okPerfiles}</SuccessText>
              </div>
            )}
            {errorPerfiles && (
              <div className="mt-3">
                <ErrorText>{errorPerfiles}</ErrorText>
              </div>
            )}
          </Card>

          <Card className="mt-4">
            <h2 className="mb-2 text-sm font-semibold text-foreground">Feature flags (beta)</h2>
            <p className="mb-3 text-sm text-muted">
              Prende una funcionalidad en prueba para esta empresa antes de que esté disponible en el plan. Es un eje aparte de los
              módulos contratados. El nombre es texto libre (minúsculas, números, <code>-</code> y <code>_</code>); el frontend lo
              consulta desde <code>GET /api/me</code>.
            </p>

            {flags === null ? (
              <p className="text-sm text-muted">Cargando…</p>
            ) : flags.filter((f) => f.activado).length === 0 ? (
              <p className="text-sm text-muted">Esta empresa no tiene ningún flag activo.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {flags
                  .filter((f) => f.activado)
                  .map((f) => (
                    <div key={f.flag} className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm">
                      <span className="font-mono text-foreground">{f.flag}</span>
                      <Button type="button" variant="ghost" onClick={() => onDesactivarFlag(f.flag)}>
                        Quitar
                      </Button>
                    </div>
                  ))}
              </div>
            )}

            <form onSubmit={onActivarFlag} className="mt-4 flex items-end gap-2">
              <div className="flex-1">
                <Label>Activar un flag nuevo</Label>
                <Input
                  type="text"
                  value={nuevoFlag}
                  onChange={(e) => setNuevoFlag(e.target.value)}
                  placeholder="asistente_panel_fijo"
                />
              </div>
              <Button type="submit" disabled={guardandoFlag || nuevoFlag.trim().length < 2}>
                {guardandoFlag ? "Activando…" : "Activar"}
              </Button>
            </form>
            {errorFlag && (
              <div className="mt-3">
                <ErrorText>{errorFlag}</ErrorText>
              </div>
            )}
          </Card>

          <Card className="mt-4">
            <h2 className="mb-2 text-sm font-semibold text-foreground">Correos y dominios autorizados</h2>
            <p className="mb-3 text-sm text-muted">
              Un correo exacto (<code>persona@empresa.cl</code>) o un dominio entero (<code>empresa.cl</code>) de esta lista puede
              entrar a la empresa sin ser invitado — la primera vez que inicia sesión se le crea el usuario con el rol indicado.
              Un correo que no está acá ni fue invitado no puede entrar.
            </p>

            {accesos === null ? (
              <p className="text-sm text-muted">Cargando…</p>
            ) : accesos.length === 0 ? (
              <p className="text-sm text-muted">Sin correos ni dominios autorizados.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {accesos.map((a) => (
                  <div key={a.id} className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2 text-sm">
                    <span className="flex flex-wrap items-center gap-2">
                      <Badge value={a.tipo} />
                      <span className="font-mono text-foreground">{a.valor}</span>
                      <span className="text-muted">→ {rolesDisponibles.find((r) => r.slug === a.rol)?.nombre ?? a.rol}</span>
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
                  placeholder={accesoTipo === "correo" ? "persona@empresa.cl" : "empresa.cl"}
                />
              </div>
              <div>
                <Label>Rol</Label>
                <Select value={accesoRol} onChange={(e) => setAccesoRol(e.target.value)}>
                  {rolesDisponibles.map((r) => (
                    <option key={r.slug} value={r.slug}>
                      {r.nombre}
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

          <Card className="mt-4">
            <h2 className="mb-2 text-sm font-semibold text-foreground">Equipo</h2>
            <p className="mb-3 text-sm text-muted">
              Restablece la contraseña de un usuario si quedó bloqueado — se genera una clave temporal que reemplaza la actual de
              inmediato. Se muestra una sola vez acá, no se guarda en ningún lado; pásasela por el canal de soporte que uses.
            </p>

            <form onSubmit={onInvitarUsuario} className="mb-4 rounded-lg border border-border p-3">
              <h3 className="mb-2 text-sm font-semibold text-foreground">Invitar un usuario a esta empresa</h3>
              <p className="mb-3 text-[11px] text-muted">
                Se le manda un correo con el enlace para definir su contraseña. No cuenta contra el límite de usuarios del plan.
              </p>
              <div className="grid gap-3 sm:grid-cols-3">
                <div>
                  <Label>Nombre</Label>
                  <Input type="text" value={nuevoNombre} onChange={(e) => setNuevoNombre(e.target.value)} />
                </div>
                <div>
                  <Label>Correo</Label>
                  <Input type="email" value={nuevoCorreo} onChange={(e) => setNuevoCorreo(e.target.value)} />
                </div>
                <div>
                  <Label>Rol</Label>
                  <Select value={nuevoRol} onChange={(e) => setNuevoRol(e.target.value)}>
                    {rolesDisponibles.map((r) => (
                      <option key={r.slug} value={r.slug}>
                        {r.nombre}
                      </option>
                    ))}
                  </Select>
                </div>
              </div>
              {errorInvitar && (
                <div className="mt-3">
                  <ErrorText>{errorInvitar}</ErrorText>
                </div>
              )}
              {avisoInvitar && <p className="mt-3 text-sm text-brand">{avisoInvitar}</p>}
              <Button type="submit" disabled={invitando || !nuevoNombre.trim() || !nuevoCorreo.trim()} className="mt-3">
                {invitando ? "Invitando…" : "Enviar invitación"}
              </Button>
            </form>

            {impersonarUsuario && (
              <div className="mb-4 rounded-lg border border-danger/40 bg-danger-soft p-3">
                <p className="text-sm font-semibold text-foreground">Impersonar a {impersonarUsuario.nombre}</p>
                <p className="mt-1 text-xs text-muted">
                  Vas a entrar a Bitácora viendo lo que ve {impersonarUsuario.nombre}, sin conocer ni cambiar su contraseña. La sesión
                  dura 30 minutos, las acciones destructivas quedan bloqueadas, y todo (inicio y fin) queda registrado con esta
                  justificación en la auditoría.
                </p>
                <div className="mt-3">
                  <Label>Justificación (obligatoria, mín. 20 caracteres)</Label>
                  <Textarea
                    rows={2}
                    value={justificacionImp}
                    onChange={(e) => setJustificacionImp(e.target.value)}
                    placeholder="Ej: el usuario reporta que no puede firmar la OS #142 desde el celular, replicando para ver el error"
                  />
                </div>
                {errorImp && (
                  <div className="mt-2">
                    <ErrorText>{errorImp}</ErrorText>
                  </div>
                )}
                <div className="mt-3 flex gap-2">
                  <Button
                    type="button"
                    variant="danger"
                    disabled={iniciandoImp || justificacionImp.trim().length < 20}
                    onClick={onIniciarImpersonacion}
                  >
                    {iniciandoImp ? "Entrando…" : `Entrar como ${impersonarUsuario.nombre}`}
                  </Button>
                  <Button type="button" variant="ghost" onClick={() => setImpersonarUsuario(null)}>
                    Cancelar
                  </Button>
                </div>
              </div>
            )}

            {passwordGenerada && (
              <div className="mb-3 rounded-lg border border-brand/40 bg-brand-soft p-3 text-sm">
                <p className="font-medium text-foreground">
                  Nueva contraseña de {passwordGenerada.nombre}: <span className="font-mono">{passwordGenerada.password}</span>
                </p>
                <p className="mt-1 text-xs text-muted">Copiala ahora — no se vuelve a mostrar.</p>
              </div>
            )}
            {secretoTotpGenerado && (
              <div className="mb-3 rounded-lg border border-brand/40 bg-brand-soft p-3 text-sm">
                <p className="font-medium text-foreground">
                  Clave TOTP de {secretoTotpGenerado.nombre}: <span className="font-mono">{secretoTotpGenerado.secreto}</span>
                </p>
                <p className="mt-1 text-xs text-muted">
                  Cárgala a mano en Google Authenticator/Authy/1Password — no se vuelve a mostrar.
                </p>
              </div>
            )}
            {!usuarios ? (
              <p className="text-sm text-muted">Cargando…</p>
            ) : usuarios.length === 0 ? (
              <p className="text-sm text-muted">Esta empresa todavía no tiene usuarios.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="text-xs text-muted">
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
                      <tr key={u.id} className="border-t border-border">
                        <td className="py-2 pr-4 text-foreground">{u.nombre}</td>
                        <td className="py-2 pr-4 text-muted">{u.correo ?? "—"}</td>
                        <td className="py-2 pr-4 text-muted">{u.rol}</td>
                        <td className="py-2 pr-4">
                          <Badge value={u.activo ? "activo" : "inactivo"} />
                        </td>
                        <td className="py-2 pr-4 text-muted">{u.mfa_activado ? `Activo (${u.mfa_metodo})` : "Inactivo"}</td>
                        <td className="py-2">
                          <div className="flex flex-wrap justify-end gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              disabled={!u.activo}
                              onClick={() => {
                                setImpersonarUsuario({ id: u.id, nombre: u.nombre });
                                setJustificacionImp("");
                                setErrorImp(null);
                              }}
                            >
                              Impersonar
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              disabled={restableciendoId === u.id}
                              onClick={() => onRestablecerPassword(u.id, u.nombre)}
                            >
                              {restableciendoId === u.id ? "Restableciendo…" : "Restablecer contraseña"}
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              disabled={cambiandoMfaId === u.id}
                              onClick={() => onActivarMfa(u.id, u.nombre)}
                            >
                              {cambiandoMfaId === u.id
                                ? "Generando…"
                                : u.mfa_activado
                                  ? "Regenerar código TOTP"
                                  : "Activar 2FA (TOTP)"}
                            </Button>
                            {u.mfa_activado && (
                              <Button
                                type="button"
                                variant="outline"
                                disabled={cambiandoMfaId === u.id}
                                onClick={() => onDesactivarMfa(u.id, u.nombre, u.rol)}
                              >
                                {cambiandoMfaId === u.id ? "Desactivando…" : "Desactivar 2FA"}
                              </Button>
                            )}
                            <Button
                              type="button"
                              variant="outline"
                              disabled={cambiandoEstadoId === u.id}
                              onClick={() => onCambiarEstadoUsuario(u.id, u.nombre, !u.activo)}
                            >
                              {cambiandoEstadoId === u.id ? "Guardando…" : u.activo ? "Desactivar" : "Reactivar"}
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              className="text-danger"
                              onClick={() => {
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
                <ErrorText>{errorUsuarios}</ErrorText>
              </div>
            )}

            {eliminarUsuario && (
              <div className="mt-4 rounded-lg border border-danger/40 bg-danger/5 p-4">
                <p className="text-sm font-semibold text-foreground">Eliminar o anonimizar a {eliminarUsuario.nombre}</p>
                <p className="mt-1 text-sm text-muted">
                  <span className="font-medium">Eliminar</span> borra la cuenta y libera el correo — solo si no tiene
                  trabajos/OS, rutas, fotos ni informes. <span className="font-medium">Anonimizar</span> (Ley 21.719)
                  reemplaza nombre/RUT/contacto por un placeholder y borra contrato, accesos y consentimientos, dejando
                  los registros operativos sin nombre de persona. Ambas son irreversibles.
                </p>
                <Label className="mt-3">
                  Escribe <span className="font-mono text-foreground">{eliminarUsuario.nombre}</span> para confirmar
                </Label>
                <Input
                  value={confirmacionEliminarUsuario}
                  onChange={(e) => setConfirmacionEliminarUsuario(e.target.value)}
                  className="mt-1 max-w-sm"
                />
                {errorEliminarUsuario && (
                  <div className="mt-2">
                    <ErrorText>{errorEliminarUsuario}</ErrorText>
                  </div>
                )}
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="danger"
                    disabled={eliminandoUsuario || confirmacionEliminarUsuario.trim() !== eliminarUsuario.nombre}
                    onClick={onEliminarUsuario}
                  >
                    {eliminandoUsuario ? "Eliminando…" : "Eliminar definitivamente"}
                  </Button>
                  <Button
                    type="button"
                    variant="danger"
                    disabled={anonimizandoUsuario || confirmacionEliminarUsuario.trim() !== eliminarUsuario.nombre}
                    onClick={onAnonimizarUsuario}
                  >
                    {anonimizandoUsuario ? "Anonimizando…" : "Anonimizar (Ley 21.719)"}
                  </Button>
                  <Button type="button" variant="ghost" onClick={() => setEliminarUsuario(null)}>
                    Cancelar
                  </Button>
                </div>
              </div>
            )}
          </Card>

          <Card className="mt-4">
            <h2 className="mb-2 text-sm font-semibold text-foreground">Anonimizar un cliente (Ley 21.719)</h2>
            <p className="mb-3 text-sm text-muted">
              Reemplaza nombre/RUT/contacto del cliente por un placeholder y borra sus accesos al Portal y consentimientos.
              Los trabajos/cobros quedan sin nombre de persona. Irreversible. El ID sale del export de la empresa o de la base.
            </p>
            <div className="flex flex-wrap items-end gap-2">
              <div>
                <Label>ID del cliente</Label>
                <Input value={clienteAnonId} onChange={(e) => setClienteAnonId(e.target.value)} className="w-72 font-mono text-xs" />
              </div>
              <div>
                <Label>Nombre exacto (confirmación)</Label>
                <Input value={clienteAnonNombre} onChange={(e) => setClienteAnonNombre(e.target.value)} className="w-56" />
              </div>
              <Button type="button" variant="danger" disabled={anonimizandoCliente} onClick={onAnonimizarCliente}>
                {anonimizandoCliente ? "Anonimizando…" : "Anonimizar"}
              </Button>
            </div>
            {msgAnonCliente && (
              <div className="mt-2">
                {msgAnonCliente.tipo === "ok" ? <SuccessText>{msgAnonCliente.texto}</SuccessText> : <ErrorText>{msgAnonCliente.texto}</ErrorText>}
              </div>
            )}
          </Card>

          <Card className="mt-4">
            <h2 className="mb-2 text-sm font-semibold text-foreground">Exportar datos</h2>
            <p className="mb-3 text-sm text-muted">
              Genera un archivo con todos los datos de esta empresa (para portabilidad si se da de baja). No incluye el contenido de
              fotos/PDFs, solo las referencias ya guardadas.
            </p>
            <Button type="button" variant="outline" disabled={exportando} onClick={onExportar}>
              {exportando ? "Generando…" : "Exportar datos"}
            </Button>
            {errorExportar && (
              <div className="mt-3">
                <ErrorText>{errorExportar}</ErrorText>
              </div>
            )}
          </Card>

          <Card className="mt-4 border-danger/40">
            <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold text-danger">
              <IconShield className="h-4 w-4" />
              Zona de peligro
            </h2>
            <p className="mb-4 text-sm text-muted">
              Eliminar la empresa borra <strong>permanentemente</strong> a {salud.empresa.nombre} — clientes, cotizaciones, órdenes de
              servicio, cobranzas y todo lo demás. Esta acción no se puede deshacer.
            </p>
            <Label>Escribe &ldquo;{salud.empresa.nombre}&rdquo; para confirmar</Label>
            <Input type="text" value={confirmacionEliminar} onChange={(e) => setConfirmacionEliminar(e.target.value)} className="max-w-sm" />
            {errorEliminar && (
              <div className="mt-3">
                <ErrorText>{errorEliminar}</ErrorText>
              </div>
            )}
            <Button
              type="button"
              variant="danger"
              onClick={onEliminar}
              disabled={eliminando || confirmacionEliminar !== salud.empresa.nombre}
              className="mt-4"
            >
              {eliminando ? "Eliminando…" : "Eliminar empresa"}
            </Button>
          </Card>
        </>
      )}
    </SuperAdminShell>
  );
}
