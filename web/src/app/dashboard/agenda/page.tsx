"use client";

import { Suspense, useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type {
  Cliente,
  EstadoTarea,
  Modulo,
  OrdenServicio,
  PaqueteSesionesConSaldo,
  Prioridad,
  Tarea,
  Trabajo,
  Usuario,
} from "@bitacora/shared";
import { puedeVerModulo } from "@bitacora/shared";
import { supabase } from "@/lib/supabase";
import { apiFetch } from "@/lib/api";
import { DashboardShell, type UsuarioShell } from "@/components/DashboardShell";
import { Modal } from "@/components/Modal";
import { ComboboxCliente } from "@/components/ComboboxCliente";
import { ComboboxResponsable } from "@/components/ComboboxResponsable";
import { EstadoCitaRiel } from "@/components/EstadoCitaRiel";
import { Badge, Button, Card, ErrorText, Input, Label, Select, Textarea } from "@/components/ui";
import { IconCalendar, IconChevronLeft, IconChevronRight, IconClipboardCheck, IconPlus, IconWrench } from "@/components/icons";

type OrdenListado = Trabajo & {
  cliente_info: { nombre: string } | null;
  responsable: { nombre: string } | null;
  orden: OrdenServicio | null;
};

type TareaListado = Tarea & {
  cliente: { nombre: string } | null;
  responsable: { nombre: string } | null;
};

type EstadoAgenda = "agendado" | "en_progreso" | "completado" | "cancelado";

type EventoAgenda = {
  id: string;
  tipo: "os" | "tarea";
  fecha: string;
  hora: string | null;
  estadoAgenda: EstadoAgenda;
  titulo: string;
  subtitulo: string;
  origen: OrdenListado | TareaListado;
};

const ESTADOS_AGENDA: { valor: EstadoAgenda; etiqueta: string; clase: string }[] = [
  { valor: "agendado", etiqueta: "Agendado", clase: "bg-brand-soft text-brand" },
  { valor: "en_progreso", etiqueta: "En progreso", clase: "bg-warning-soft text-warning" },
  { valor: "completado", etiqueta: "Completado", clase: "bg-success-soft text-success" },
  { valor: "cancelado", etiqueta: "Cancelado", clase: "bg-danger-soft text-danger" },
];

const ESTADO_TAREA_A_AGENDA: Record<EstadoTarea, EstadoAgenda> = {
  pendiente: "agendado",
  confirmada: "agendado",
  completada: "completado",
  cancelada: "cancelado",
  no_asistio: "cancelado",
  cancelada_anticipada: "cancelado",
};

const PRIORIDADES: Prioridad[] = ["alta", "media", "baja"];

// Estado "de agenda" derivado — no es una columna propia, se calcula a
// partir de trabajos.estado + ordenes_servicio.estado_os, que ya cubren
// exactamente esta semántica (evita duplicar un enum nuevo en la DB).
function estadoAgendaDe(t: OrdenListado): EstadoAgenda {
  if (t.estado === "cancelado") return "cancelado";
  if (t.orden?.estado_os === "en_proceso") return "en_progreso";
  if (t.estado === "completado" || t.orden?.estado_os === "completada" || t.orden?.estado_os === "firmada") {
    return "completado";
  }
  return "agendado";
}

function eventoDeOrden(o: OrdenListado): EventoAgenda {
  return {
    id: o.id,
    tipo: "os",
    fecha: o.fecha,
    hora: o.hora_programada,
    estadoAgenda: estadoAgendaDe(o),
    titulo: o.cliente_info?.nombre ?? o.cliente,
    subtitulo: o.responsable?.nombre ?? "—",
    origen: o,
  };
}

function eventoDeTarea(t: TareaListado): EventoAgenda {
  return {
    id: t.id,
    tipo: "tarea",
    fecha: t.fecha,
    hora: t.hora,
    estadoAgenda: ESTADO_TAREA_A_AGENDA[t.estado],
    titulo: t.titulo,
    subtitulo: t.cliente?.nombre ?? t.responsable?.nombre ?? "—",
    origen: t,
  };
}

// Evita el desfase de un día que da toISOString() (usa UTC) al convertir
// un Date local a "YYYY-MM-DD" — clave para no dibujar la OS en el día
// equivocado del calendario.
function fmtLocal(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function fechaDesdeString(fecha: string): Date {
  return new Date(`${fecha}T00:00:00`);
}

const NOMBRES_MES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];
const NOMBRES_DIA_CORTOS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

// Borrador de "nueva tarea rápida" que se guarda antes de saltar a crear
// una OS, para reabrir el formulario con los datos al volver (Parte 2).
const CLAVE_BORRADOR = "agenda:borrador-tarea";

function AgendaContenido() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [usuario, setUsuario] = useState<UsuarioShell | null>(null);
  const [modulosDeshabilitados, setModulosDeshabilitados] = useState<Modulo[]>([]);
  const [modulosVisibles, setModulosVisibles] = useState<Modulo[] | null>(null);
  const [vista, setVista] = useState<"mes" | "semana" | "dia">("mes");
  const [fechaActual, setFechaActual] = useState(() => new Date());
  const [ordenes, setOrdenes] = useState<OrdenListado[] | null>(null);
  const [tareas, setTareas] = useState<TareaListado[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filtros, setFiltros] = useState<Set<EstadoAgenda>>(new Set());
  const [diaSeleccionado, setDiaSeleccionado] = useState<string | null>(null);

  const [formTareaAbierto, setFormTareaAbierto] = useState(false);
  const [tareaEditandoId, setTareaEditandoId] = useState<string | null>(null);
  const [tituloTarea, setTituloTarea] = useState("");
  const [descripcionTarea, setDescripcionTarea] = useState("");
  const [fechaTarea, setFechaTarea] = useState("");
  const [horaTarea, setHoraTarea] = useState("");
  const [duracionTarea, setDuracionTarea] = useState("");
  const [clienteIdTarea, setClienteIdTarea] = useState("");
  const [responsableIdTarea, setResponsableIdTarea] = useState("");
  const [prioridadTarea, setPrioridadTarea] = useState<Prioridad>("media");
  const [estadoTarea, setEstadoTarea] = useState<EstadoTarea>("pendiente");
  const [guardandoTarea, setGuardandoTarea] = useState(false);
  const [errorTarea, setErrorTarea] = useState<string | null>(null);
  const [clientesOpciones, setClientesOpciones] = useState<Cliente[]>([]);
  const [usuariosOpciones, setUsuariosOpciones] = useState<Usuario[]>([]);

  const [ventanaCancelacionHoras, setVentanaCancelacionHoras] = useState(24);
  const [paquetesCliente, setPaquetesCliente] = useState<PaqueteSesionesConSaldo[]>([]);
  const [paqueteIdTarea, setPaqueteIdTarea] = useState("");
  const [sesionesConsumidasTarea, setSesionesConsumidasTarea] = useState(1);
  const [formPaqueteAbierto, setFormPaqueteAbierto] = useState(false);
  const [nombrePaquete, setNombrePaquete] = useState("");
  const [cantidadPaquete, setCantidadPaquete] = useState(5);
  const [guardandoPaquete, setGuardandoPaquete] = useState(false);
  const [errorPaquete, setErrorPaquete] = useState<string | null>(null);

  // Form rápido de nueva tarea anclado a un día (Parte 1). Reusa el
  // mismo estado de tarea de arriba; esto solo dice para qué día está
  // abierto (null = cerrado). trabajoVinculado guarda la OS creada
  // desde el flujo de Parte 2 para asociarla al guardar.
  const [tareaRapidaFecha, setTareaRapidaFecha] = useState<string | null>(null);
  const [trabajoVinculado, setTrabajoVinculado] = useState<{ id: string; folio: number | null } | null>(null);

  const cargar = useCallback(async () => {
    setError(null);
    let desde: Date;
    let hasta: Date;
    if (vista === "mes") {
      desde = new Date(fechaActual.getFullYear(), fechaActual.getMonth(), 1);
      hasta = new Date(fechaActual.getFullYear(), fechaActual.getMonth() + 1, 0);
    } else if (vista === "semana") {
      desde = new Date(fechaActual);
      desde.setDate(desde.getDate() - desde.getDay());
      hasta = new Date(desde);
      hasta.setDate(hasta.getDate() + 6);
    } else {
      desde = fechaActual;
      hasta = fechaActual;
    }
    const params = new URLSearchParams({ desde: fmtLocal(desde), hasta: fmtLocal(hasta) });
    const [resOrdenes, resTareas] = await Promise.all([
      apiFetch(`/api/ordenes-servicio?${params.toString()}`),
      apiFetch(`/api/tareas?${params.toString()}`),
    ]);
    if (!resOrdenes.ok) {
      setError("No se pudieron cargar las órdenes de servicio");
      return;
    }
    setOrdenes(await resOrdenes.json());
    if (resTareas.ok) setTareas(await resTareas.json());
  }, [fechaActual, vista]);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        router.replace("/login");
        return;
      }
      const res = await apiFetch("/api/me");
      if (res.ok) {
        const { usuario: u, modulos_deshabilitados: deshabilitados, modulos_visibles: visibles } = await res.json();
        if (Array.isArray(visibles)) setModulosVisibles(visibles);
        if (u) {
          setUsuario({
            nombre: u.nombre,
            rol: u.rol,
            empresaNombre: u.empresa?.nombre ?? "",
            empresaLogoUrl: u.empresa?.logo_url ?? null,
            colorPrimario: u.empresa?.color_primario ?? null,
            colorPrimarioForeground: u.empresa?.color_primario_foreground ?? null,
            moneda: u.empresa?.moneda ?? "CLP",
          });
        }
        setModulosDeshabilitados(deshabilitados ?? []);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  // Parte 2: volvimos de crear una OS (?reabrirTarea=1). Reabre el form
  // rápido con el borrador guardado + la OS recién creada vinculada, y
  // limpia sessionStorage + los query params para que un refresh no
  // reabra nada (D4).
  useEffect(() => {
    if (searchParams.get("reabrirTarea") !== "1") return;
    const trabajoId = searchParams.get("trabajoId");
    const folioRaw = searchParams.get("folio");
    let borrador: Record<string, string> | null = null;
    try {
      borrador = JSON.parse(window.sessionStorage.getItem(CLAVE_BORRADOR) ?? "null");
      window.sessionStorage.removeItem(CLAVE_BORRADOR);
    } catch {
      borrador = null;
    }
    router.replace("/dashboard/agenda");
    if (!borrador) return;

    const fecha = borrador.fecha || fmtLocal(new Date());
    setTareaEditandoId(null);
    setFormTareaAbierto(false);
    setTituloTarea(borrador.titulo ?? "");
    setDescripcionTarea(borrador.descripcion ?? "");
    setFechaTarea(fecha);
    setHoraTarea(borrador.hora ?? "");
    setDuracionTarea("");
    setClienteIdTarea(borrador.cliente_id ?? "");
    setResponsableIdTarea(borrador.responsable_id ?? "");
    setPrioridadTarea((borrador.prioridad as Prioridad) || "media");
    setEstadoTarea("pendiente");
    setPaqueteIdTarea("");
    setSesionesConsumidasTarea(1);
    setPaquetesCliente([]);
    setErrorTarea(null);
    setTrabajoVinculado(trabajoId ? { id: trabajoId, folio: folioRaw ? Number(folioRaw) : null } : null);
    setDiaSeleccionado(fecha);
    setTareaRapidaFecha(fecha);
    cargarOpcionesFormTarea();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const eventos = useMemo(() => {
    return [...(ordenes ?? []).map(eventoDeOrden), ...(tareas ?? []).map(eventoDeTarea)];
  }, [ordenes, tareas]);

  const eventosFiltrados = useMemo(() => {
    if (filtros.size === 0) return eventos;
    return eventos.filter((e) => filtros.has(e.estadoAgenda));
  }, [eventos, filtros]);

  const eventosPorDia = useMemo(() => {
    const mapa = new Map<string, EventoAgenda[]>();
    for (const e of eventosFiltrados) {
      const lista = mapa.get(e.fecha) ?? [];
      lista.push(e);
      mapa.set(e.fecha, lista);
    }
    for (const lista of mapa.values()) {
      lista.sort((a, b) => (a.hora ?? "").localeCompare(b.hora ?? ""));
    }
    return mapa;
  }, [eventosFiltrados]);

  function alternarFiltro(estado: EstadoAgenda) {
    setFiltros((prev) => {
      const next = new Set(prev);
      if (next.has(estado)) next.delete(estado);
      else next.add(estado);
      return next;
    });
  }

  function irMes(delta: number) {
    setFechaActual((prev) => new Date(prev.getFullYear(), prev.getMonth() + delta, 1));
    setDiaSeleccionado(null);
  }
  function irSemana(delta: number) {
    setFechaActual((prev) => {
      const next = new Date(prev);
      next.setDate(next.getDate() + delta * 7);
      return next;
    });
    setDiaSeleccionado(null);
  }
  function irDia(delta: number) {
    setFechaActual((prev) => {
      const next = new Date(prev);
      next.setDate(next.getDate() + delta);
      return next;
    });
  }

  async function cargarOpcionesFormTarea() {
    if (clientesOpciones.length > 0 && usuariosOpciones.length > 0) return;
    const [resClientes, resUsuarios] = await Promise.all([apiFetch("/api/clientes"), apiFetch("/api/usuarios")]);
    if (resClientes.ok) setClientesOpciones(await resClientes.json());
    if (resUsuarios.ok) setUsuariosOpciones(await resUsuarios.json());
    if (puedeAgendaPro) {
      const resConfig = await apiFetch("/api/agenda-pro/config");
      if (resConfig.ok) {
        const { config } = await resConfig.json();
        setVentanaCancelacionHoras(config.ventana_cancelacion_horas);
      }
    }
  }

  async function cargarPaquetesCliente(clienteId: string) {
    if (!clienteId) {
      setPaquetesCliente([]);
      return;
    }
    const res = await apiFetch(`/api/paquetes-sesiones?cliente_id=${clienteId}`);
    if (res.ok) setPaquetesCliente(await res.json());
  }

  function onCambiarClienteTarea(clienteId: string) {
    setClienteIdTarea(clienteId);
    setPaqueteIdTarea("");
    setFormPaqueteAbierto(false);
    if (puedeAgendaPro) cargarPaquetesCliente(clienteId);
    else setPaquetesCliente([]);
  }

  // Deja el estado de tarea en blanco para una creación nueva. `fecha`
  // es la fecha inicial (día clickeado o hoy). No abre ningún form por
  // sí solo — quien llama decide si abre el Modal completo o el rápido.
  function resetearFormTarea(fecha: string) {
    setTareaEditandoId(null);
    setTrabajoVinculado(null);
    setTituloTarea("");
    setDescripcionTarea("");
    setFechaTarea(fecha);
    setHoraTarea("");
    setDuracionTarea("");
    setClienteIdTarea("");
    setResponsableIdTarea("");
    setPrioridadTarea("media");
    setEstadoTarea("pendiente");
    setErrorTarea(null);
    setPaqueteIdTarea("");
    setSesionesConsumidasTarea(1);
    setPaquetesCliente([]);
    setFormPaqueteAbierto(false);
    setErrorPaquete(null);
  }

  function abrirNuevaTarea() {
    setTareaRapidaFecha(null);
    resetearFormTarea(diaSeleccionado ?? fmtLocal(new Date()));
    setFormTareaAbierto(true);
    cargarOpcionesFormTarea();
  }

  // Form rápido anclado a un día (Parte 1). Toggle: clic en el mismo día
  // lo cierra. D4: al abrir uno nuevo se descarta cualquier borrador
  // viejo de sessionStorage — solo se respeta con ?reabrirTarea=1.
  function abrirTareaRapida(fecha: string) {
    if (tareaRapidaFecha === fecha) {
      setTareaRapidaFecha(null);
      return;
    }
    try {
      window.sessionStorage.removeItem(CLAVE_BORRADOR);
    } catch {
      /* noop */
    }
    setFormTareaAbierto(false);
    resetearFormTarea(fecha);
    setTareaRapidaFecha(fecha);
    cargarOpcionesFormTarea();
  }

  function cerrarTareaRapida() {
    setTareaRapidaFecha(null);
    setTrabajoVinculado(null);
    try {
      window.sessionStorage.removeItem(CLAVE_BORRADOR);
    } catch {
      /* noop */
    }
  }

  // Parte 2: guarda lo que se lleva escrito en el form rápido y salta a
  // crear la OS, con ?volverA=agenda para que al guardarla vuelva acá.
  function onCrearOSDesdeTarea() {
    try {
      window.sessionStorage.setItem(
        CLAVE_BORRADOR,
        JSON.stringify({
          titulo: tituloTarea,
          descripcion: descripcionTarea,
          fecha: fechaTarea,
          hora: horaTarea,
          cliente_id: clienteIdTarea,
          responsable_id: responsableIdTarea,
          prioridad: prioridadTarea,
        })
      );
    } catch {
      /* si no se puede guardar el borrador igual dejamos crear la OS */
    }
    const q = new URLSearchParams({ volverA: "agenda" });
    if (clienteIdTarea) q.set("cliente_id", clienteIdTarea);
    router.push(`/dashboard/ordenes/nueva?${q.toString()}`);
  }

  function abrirEdicionTarea(t: TareaListado) {
    setTareaRapidaFecha(null);
    setTrabajoVinculado(null);
    setTareaEditandoId(t.id);
    setTituloTarea(t.titulo);
    setDescripcionTarea(t.descripcion ?? "");
    setFechaTarea(t.fecha);
    setHoraTarea(t.hora ?? "");
    setDuracionTarea(t.duracion_min ? String(t.duracion_min) : "");
    setClienteIdTarea(t.cliente_id ?? "");
    setResponsableIdTarea(t.responsable_id ?? "");
    setPrioridadTarea(t.prioridad);
    setEstadoTarea(t.estado);
    setErrorTarea(null);
    setPaqueteIdTarea(t.paquete_id ?? "");
    setSesionesConsumidasTarea(t.sesiones_consumidas ?? 1);
    setFormPaqueteAbierto(false);
    setErrorPaquete(null);
    setFormTareaAbierto(true);
    cargarOpcionesFormTarea();
    if (t.cliente_id && puedeAgendaPro) cargarPaquetesCliente(t.cliente_id);
    else setPaquetesCliente([]);
  }

  async function onCrearPaquete(e: FormEvent) {
    e.preventDefault();
    setErrorPaquete(null);
    if (!clienteIdTarea) {
      setErrorPaquete("Selecciona un cliente primero");
      return;
    }
    if (!nombrePaquete.trim()) {
      setErrorPaquete("Falta nombre");
      return;
    }
    if (!Number.isInteger(cantidadPaquete) || cantidadPaquete <= 0) {
      setErrorPaquete("La cantidad debe ser un entero mayor a 0");
      return;
    }
    setGuardandoPaquete(true);
    const res = await apiFetch("/api/paquetes-sesiones", {
      method: "POST",
      body: JSON.stringify({ cliente_id: clienteIdTarea, nombre: nombrePaquete, cantidad_total: cantidadPaquete }),
    });
    setGuardandoPaquete(false);
    if (!res.ok) {
      const b = await res.json().catch(() => ({}));
      setErrorPaquete(b.error ?? "No se pudo crear el paquete");
      return;
    }
    const nuevo: PaqueteSesionesConSaldo = await res.json();
    setPaquetesCliente((prev) => [nuevo, ...prev]);
    setPaqueteIdTarea(nuevo.id);
    setFormPaqueteAbierto(false);
    setNombrePaquete("");
    setCantidadPaquete(5);
  }

  function abrirEvento(e: EventoAgenda) {
    if (e.tipo === "os") {
      router.push(`/dashboard/ordenes/${e.id}`);
    } else {
      abrirEdicionTarea(e.origen as TareaListado);
    }
  }

  async function onGuardarTarea(e: FormEvent) {
    e.preventDefault();
    setErrorTarea(null);
    if (!tituloTarea.trim()) {
      setErrorTarea("Falta título");
      return;
    }
    if (!fechaTarea) {
      setErrorTarea("Falta fecha");
      return;
    }
    setGuardandoTarea(true);
    const body = {
      titulo: tituloTarea,
      descripcion: descripcionTarea || null,
      fecha: fechaTarea,
      hora: horaTarea || null,
      duracion_min: duracionTarea ? Number(duracionTarea) : null,
      cliente_id: clienteIdTarea || null,
      responsable_id: responsableIdTarea || null,
      prioridad: prioridadTarea,
      paquete_id: puedeAgendaPro ? paqueteIdTarea || null : null,
      sesiones_consumidas: puedeAgendaPro && paqueteIdTarea ? sesionesConsumidasTarea : 1,
      ...(tareaEditandoId ? { estado: estadoTarea } : {}),
      // Vínculo con la OS creada desde el flujo "nueva tarea → crear OS"
      // (Parte 2). Solo se manda si hay una OS vinculada.
      ...(!tareaEditandoId && trabajoVinculado ? { trabajo_id: trabajoVinculado.id } : {}),
    };
    const res = tareaEditandoId
      ? await apiFetch(`/api/tareas/${tareaEditandoId}`, { method: "PATCH", body: JSON.stringify(body) })
      : await apiFetch("/api/tareas", { method: "POST", body: JSON.stringify(body) });
    setGuardandoTarea(false);
    if (!res.ok) {
      const b = await res.json().catch(() => ({}));
      setErrorTarea(b.error ?? "No se pudo guardar la tarea");
      return;
    }
    setFormTareaAbierto(false);
    cerrarTareaRapida();
    cargar();
  }

  // Cancelación automática de una cita con paquete: si cancelar AHORA
  // cae dentro de la ventana de aviso configurada, avisa antes de
  // confirmar (el backend vuelve a calcular con su propio reloj —
  // esto es solo para mostrar la advertencia antes de que el usuario
  // confirme, no la decisión final).
  async function onCancelarTarea() {
    if (!tareaEditandoId) return;
    // El aviso de descuento solo aplica si la cita tiene pack — antes se
    // mostraba siempre, aunque no hubiera paquete de por medio.
    if (paqueteIdTarea) {
      const horaSesion = horaTarea || "23:59";
      const momentoSesion = new Date(`${fechaTarea}T${horaSesion}:00`);
      const diffHoras = (momentoSesion.getTime() - Date.now()) / (1000 * 60 * 60);
      if (diffHoras < ventanaCancelacionHoras) {
        const confirmado = confirm(
          `Esta cancelación es con menos de ${ventanaCancelacionHoras} horas de anticipación y se descontará del paquete de todas formas. ¿Confirmas?`
        );
        if (!confirmado) return;
      }
    }
    setGuardandoTarea(true);
    const res = await apiFetch(`/api/tareas/${tareaEditandoId}/cancelar`, { method: "POST" });
    setGuardandoTarea(false);
    if (!res.ok) {
      const b = await res.json().catch(() => ({}));
      setErrorTarea(b.error ?? "No se pudo cancelar la cita");
      return;
    }
    setFormTareaAbierto(false);
    cargar();
  }

  // Confirmar y No asistió (Punto 2 — estados en 3+2) son acciones
  // instantáneas, igual criterio que Cancelar: no esperan al "Guardar
  // cambios" del form. No asistió es una aserción manual del humano —
  // a diferencia de Cancelar, no pasa por la ventana de aviso.
  async function onCambiarEstadoInstantaneo(nuevo: "confirmada" | "completada" | "no_asistio") {
    if (!tareaEditandoId) return;
    setGuardandoTarea(true);
    const res = await apiFetch(`/api/tareas/${tareaEditandoId}`, { method: "PATCH", body: JSON.stringify({ estado: nuevo }) });
    setGuardandoTarea(false);
    if (!res.ok) {
      const b = await res.json().catch(() => ({}));
      setErrorTarea(b.error ?? "No se pudo actualizar el estado");
      return;
    }
    setFormTareaAbierto(false);
    cargar();
  }

  async function onEliminarTarea() {
    if (!tareaEditandoId) return;
    if (!confirm("¿Eliminar esta tarea?")) return;
    const res = await apiFetch(`/api/tareas/${tareaEditandoId}`, { method: "DELETE" });
    if (res.ok) {
      setFormTareaAbierto(false);
      cargar();
    }
  }

  if (!usuario) return null;

  const moduloVisible = (m: Modulo) =>
    modulosVisibles !== null
      ? modulosVisibles.includes(m)
      : puedeVerModulo(usuario.rol, m) && !modulosDeshabilitados.includes(m);
  const puedeGestionarAgenda = moduloVisible("agenda");
  const puedeAgendaPro = moduloVisible("agenda_pro");
  const hoy = fmtLocal(new Date());

  const primerDiaMes = new Date(fechaActual.getFullYear(), fechaActual.getMonth(), 1);
  const offsetInicio = primerDiaMes.getDay();
  const diasEnMes = new Date(fechaActual.getFullYear(), fechaActual.getMonth() + 1, 0).getDate();
  const celdas: (Date | null)[] = [
    ...Array(offsetInicio).fill(null),
    ...Array.from({ length: diasEnMes }, (_, i) => new Date(fechaActual.getFullYear(), fechaActual.getMonth(), i + 1)),
  ];
  while (celdas.length % 7 !== 0) celdas.push(null);

  const tituloMes = `${NOMBRES_MES[fechaActual.getMonth()]} ${fechaActual.getFullYear()}`;
  const tituloDia = `${fechaActual.getDate()} de ${NOMBRES_MES[fechaActual.getMonth()]}, ${fechaActual.getFullYear()}`;

  const inicioSemana = new Date(fechaActual);
  inicioSemana.setDate(inicioSemana.getDate() - inicioSemana.getDay());
  const diasSemana = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(inicioSemana);
    d.setDate(d.getDate() + i);
    return d;
  });
  const finSemana = diasSemana[6];
  const tituloSemana =
    inicioSemana.getMonth() === finSemana.getMonth()
      ? `${inicioSemana.getDate()} – ${finSemana.getDate()} de ${NOMBRES_MES[inicioSemana.getMonth()]}, ${inicioSemana.getFullYear()}`
      : `${inicioSemana.getDate()} de ${NOMBRES_MES[inicioSemana.getMonth()]} – ${finSemana.getDate()} de ${NOMBRES_MES[finSemana.getMonth()]}, ${finSemana.getFullYear()}`;

  const eventosDiaSeleccionado = diaSeleccionado ? eventosPorDia.get(diaSeleccionado) ?? [] : [];
  const eventosDelDiaVista = vista === "dia" ? eventosPorDia.get(fmtLocal(fechaActual)) ?? [] : [];

  // Form rápido de nueva tarea (Parte 1) — se renderiza donde tenga
  // sentido según la vista. Reusa el mismo estado de tarea + guardado.
  function renderTareaRapida() {
    if (!tareaRapidaFecha || !puedeGestionarAgenda) return null;
    return (
      <Card className="border-brand/40">
        <form onSubmit={onGuardarTarea} className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-foreground">
              Nueva tarea — {fechaDesdeString(tareaRapidaFecha).toLocaleDateString("es-CL", { weekday: "long", day: "numeric", month: "long" })}
            </h3>
            <button type="button" onClick={cerrarTareaRapida} className="text-xs font-medium text-muted hover:text-foreground">
              Cerrar
            </button>
          </div>

          {trabajoVinculado && (
            <p className="rounded-lg bg-brand-soft px-3 py-2 text-xs font-medium text-brand">
              ✓ {trabajoVinculado.folio != null ? `OS N° ${trabajoVinculado.folio}` : "Orden de servicio"} creada — se vincula a esta tarea al guardar.
            </p>
          )}

          <div>
            <Label>Título</Label>
            <Input type="text" value={tituloTarea} onChange={(e) => setTituloTarea(e.target.value)} placeholder="Ej: Visita técnica, recordatorio…" />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label>Fecha</Label>
              <Input
                type="date"
                value={fechaTarea}
                onChange={(e) => {
                  setFechaTarea(e.target.value);
                  setTareaRapidaFecha(e.target.value || tareaRapidaFecha);
                }}
              />
            </div>
            <div>
              <Label>Hora (opcional)</Label>
              <Input type="time" value={horaTarea} onChange={(e) => setHoraTarea(e.target.value)} />
            </div>
            <div>
              <Label>Duración en minutos (opcional)</Label>
              <Input
                type="number"
                min={1}
                placeholder="Ej: 60"
                value={duracionTarea}
                onChange={(e) => setDuracionTarea(e.target.value.replace(/\D/g, ""))}
              />
            </div>
          </div>
          <div>
            <Label>Cliente (opcional)</Label>
            <ComboboxCliente
              value={clienteIdTarea}
              onChange={onCambiarClienteTarea}
              clientes={clientesOpciones}
              onClienteCreado={(c) => setClientesOpciones((prev) => [...prev, c])}
              opcionVacia="Sin cliente"
              placeholder="Sin cliente"
            />
          </div>
          <div>
            <Label>Responsable (opcional)</Label>
            <ComboboxResponsable
              value={responsableIdTarea}
              onChange={setResponsableIdTarea}
              equipo={usuariosOpciones}
              opcionVacia="Sin asignar"
              placeholder="Sin asignar"
            />
          </div>

          {errorTarea && <ErrorText>{errorTarea}</ErrorText>}

          <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
            <Button type="submit" disabled={guardandoTarea}>
              {guardandoTarea ? "Guardando…" : "Guardar tarea"}
            </Button>
            {!trabajoVinculado && (
              <Button type="button" variant="outline" onClick={onCrearOSDesdeTarea} disabled={guardandoTarea}>
                <IconWrench className="h-4 w-4" />
                Crear Orden de Servicio
              </Button>
            )}
          </div>
        </form>
      </Card>
    );
  }

  return (
    <DashboardShell usuario={usuario}>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight text-foreground">
          <IconCalendar className="h-6 w-6 text-brand" />
          Agenda
        </h1>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border border-border p-0.5">
            <button
              type="button"
              onClick={() => setVista("mes")}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                vista === "mes" ? "bg-brand-soft text-brand" : "text-muted"
              }`}
            >
              Mes
            </button>
            <button
              type="button"
              onClick={() => setVista("semana")}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                vista === "semana" ? "bg-brand-soft text-brand" : "text-muted"
              }`}
            >
              Semana
            </button>
            <button
              type="button"
              onClick={() => setVista("dia")}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                vista === "dia" ? "bg-brand-soft text-brand" : "text-muted"
              }`}
            >
              Día
            </button>
          </div>
          {puedeGestionarAgenda && (
            <Button type="button" variant="outline" onClick={abrirNuevaTarea}>
              <IconClipboardCheck className="h-4 w-4" />
              Nueva Tarea
            </Button>
          )}
        </div>
      </div>

      <Modal open={formTareaAbierto} onClose={() => setFormTareaAbierto(false)} title={tareaEditandoId ? "Editar tarea" : "Nueva tarea"} wide>
        <form onSubmit={onGuardarTarea} className="flex flex-col gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Label>Título</Label>
                <Input type="text" required value={tituloTarea} onChange={(e) => setTituloTarea(e.target.value)} />
              </div>
              <div>
                <Label>Fecha</Label>
                <Input type="date" required value={fechaTarea} onChange={(e) => setFechaTarea(e.target.value)} />
              </div>
              <div>
                <Label>Hora (opcional)</Label>
                <Input type="time" value={horaTarea} onChange={(e) => setHoraTarea(e.target.value)} />
              </div>
              <div>
                <Label>Duración en minutos (opcional)</Label>
                <Input
                  type="number"
                  min={1}
                  placeholder="Ej: 60"
                  value={duracionTarea}
                  onChange={(e) => setDuracionTarea(e.target.value.replace(/\D/g, ""))}
                />
              </div>
              <div>
                <Label>Cliente (opcional)</Label>
                <ComboboxCliente
                  value={clienteIdTarea}
                  onChange={onCambiarClienteTarea}
                  clientes={clientesOpciones}
                  onClienteCreado={(c) => setClientesOpciones((prev) => [...prev, c])}
                  opcionVacia="Sin cliente"
                  placeholder="Sin cliente"
                />
              </div>
              {puedeAgendaPro && clienteIdTarea && (
                <div className="sm:col-span-2 rounded-lg border border-border p-3">
                  <p className="mb-2 text-xs font-semibold text-foreground">Paquete de sesiones (Agenda Pro)</p>
                  <div className="grid gap-3 sm:grid-cols-[1fr_8rem]">
                    <div>
                      <Label>Paquete (opcional)</Label>
                      <Select value={paqueteIdTarea} onChange={(e) => setPaqueteIdTarea(e.target.value)}>
                        <option value="">Sin paquete (cita suelta)</option>
                        {paquetesCliente.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.nombre} — {p.saldo}/{p.cantidad_total} restantes
                          </option>
                        ))}
                      </Select>
                    </div>
                    {paqueteIdTarea && (
                      <div>
                        <Label>Sesiones a consumir</Label>
                        <Input
                          type="number"
                          min={1}
                          value={sesionesConsumidasTarea}
                          onChange={(e) => setSesionesConsumidasTarea(Number(e.target.value) || 1)}
                        />
                      </div>
                    )}
                  </div>
                  {!formPaqueteAbierto ? (
                    <button
                      type="button"
                      onClick={() => setFormPaqueteAbierto(true)}
                      className="mt-2 text-xs font-medium text-brand hover:underline"
                    >
                      + Crear paquete nuevo para este cliente
                    </button>
                  ) : (
                    <div className="mt-3 flex flex-col gap-2 border-t border-border pt-3 sm:flex-row sm:items-end">
                      <div className="flex-1">
                        <Label>Nombre del paquete</Label>
                        <Input
                          type="text"
                          placeholder="Ej: Pack 10 sesiones"
                          value={nombrePaquete}
                          onChange={(e) => setNombrePaquete(e.target.value)}
                        />
                      </div>
                      <div className="w-24">
                        <Label>Cantidad</Label>
                        <Input type="number" min={1} value={cantidadPaquete} onChange={(e) => setCantidadPaquete(Number(e.target.value) || 1)} />
                      </div>
                      <Button type="button" variant="outline" disabled={guardandoPaquete} onClick={onCrearPaquete}>
                        {guardandoPaquete ? "Creando…" : "Crear"}
                      </Button>
                    </div>
                  )}
                  {errorPaquete && (
                    <div className="mt-2">
                      <ErrorText>{errorPaquete}</ErrorText>
                    </div>
                  )}
                </div>
              )}
              <div>
                <Label>Responsable (opcional)</Label>
                <ComboboxResponsable
                  value={responsableIdTarea}
                  onChange={setResponsableIdTarea}
                  equipo={usuariosOpciones}
                  opcionVacia="Sin asignar"
                  placeholder="Sin asignar"
                />
              </div>
              <div>
                <Label>Prioridad</Label>
                <Select value={prioridadTarea} onChange={(e) => setPrioridadTarea(e.target.value as Prioridad)}>
                  {PRIORIDADES.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </Select>
              </div>
              {tareaEditandoId && (
                <div className="sm:col-span-2 rounded-lg border border-border p-3">
                  {(estadoTarea === "pendiente" || estadoTarea === "confirmada") && (
                    <Button
                      type="button"
                      variant="outline"
                      disabled={guardandoTarea}
                      onClick={() => onCambiarEstadoInstantaneo("completada")}
                      className="mb-3"
                    >
                      Marcar Asistió
                    </Button>
                  )}
                  <EstadoCitaRiel
                    estado={estadoTarea}
                    puedeConfirmar={puedeAgendaPro}
                    guardando={guardandoTarea}
                    onConfirmar={() => onCambiarEstadoInstantaneo("confirmada")}
                    onNoAsistio={() => onCambiarEstadoInstantaneo("no_asistio")}
                    onCancelar={onCancelarTarea}
                  />
                </div>
              )}
              <div className="sm:col-span-2">
                <Label>Descripción (opcional)</Label>
                <Textarea rows={3} value={descripcionTarea} onChange={(e) => setDescripcionTarea(e.target.value)} />
              </div>
            </div>
            {errorTarea && <ErrorText>{errorTarea}</ErrorText>}
            <div className="flex items-center gap-2">
              <Button type="submit" disabled={guardandoTarea} className="self-start">
                {guardandoTarea ? "Guardando…" : tareaEditandoId ? "Guardar cambios" : "Crear tarea"}
              </Button>
              <Button type="button" variant="ghost" onClick={() => setFormTareaAbierto(false)}>
                Cancelar
              </Button>
              {tareaEditandoId && (
                <Button type="button" variant="danger" className="ml-auto" onClick={onEliminarTarea}>
                  Eliminar
                </Button>
              )}
            </div>
        </form>
      </Modal>

      <Card className="mb-6">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          {ESTADOS_AGENDA.map((e) => (
            <button
              key={e.valor}
              type="button"
              onClick={() => alternarFiltro(e.valor)}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                filtros.has(e.valor) ? `${e.clase} border-transparent` : "border-border text-muted hover:bg-brand-soft"
              }`}
            >
              {e.etiqueta}
            </button>
          ))}
          {filtros.size > 0 && (
            <button type="button" onClick={() => setFiltros(new Set())} className="text-xs font-medium text-muted hover:text-brand">
              Limpiar
            </button>
          )}
        </div>

        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => (vista === "mes" ? irMes(-1) : vista === "semana" ? irSemana(-1) : irDia(-1))}
            className="rounded-lg p-2 text-muted transition-colors hover:bg-brand-soft hover:text-brand"
          >
            <IconChevronLeft className="h-4 w-4" />
          </button>
          <h2 className="text-sm font-semibold capitalize text-foreground">
            {vista === "mes" ? tituloMes : vista === "semana" ? tituloSemana : tituloDia}
          </h2>
          <button
            type="button"
            onClick={() => (vista === "mes" ? irMes(1) : vista === "semana" ? irSemana(1) : irDia(1))}
            className="rounded-lg p-2 text-muted transition-colors hover:bg-brand-soft hover:text-brand"
          >
            <IconChevronRight className="h-4 w-4" />
          </button>
        </div>
      </Card>

      {error && (
        <div className="mb-6">
          <ErrorText>{error}</ErrorText>
        </div>
      )}

      {vista === "mes" ? (
        <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
          <Card className="overflow-hidden p-0">
            <div className="grid grid-cols-7 border-b border-border text-center text-xs font-medium text-muted">
              {NOMBRES_DIA_CORTOS.map((d) => (
                <div key={d} className="py-2">
                  {d}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7">
              {celdas.map((dia, i) => {
                if (!dia) return <div key={i} className="min-h-[6.5rem] border-b border-r border-border last:border-r-0" />;
                const clave = fmtLocal(dia);
                const esHoy = clave === hoy;
                const eventosDia = eventosPorDia.get(clave) ?? [];
                const seleccionado = diaSeleccionado === clave;
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => {
                      setDiaSeleccionado(seleccionado ? null : clave);
                      if (puedeGestionarAgenda) {
                        if (seleccionado) cerrarTareaRapida();
                        else abrirTareaRapida(clave);
                      }
                    }}
                    className={`flex min-h-[6.5rem] flex-col items-stretch gap-1 border-b border-r border-border p-1.5 text-left transition-colors last:border-r-0 hover:bg-surface-sunken ${
                      seleccionado ? "bg-brand-soft/60" : ""
                    }`}
                  >
                    <span
                      className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium ${
                        esHoy ? "bg-brand text-brand-foreground" : "text-foreground"
                      }`}
                    >
                      {dia.getDate()}
                    </span>
                    <div className="flex flex-col gap-1">
                      {eventosDia.slice(0, 2).map((e) => {
                        const est = ESTADOS_AGENDA.find((x) => x.valor === e.estadoAgenda)!;
                        return (
                          <span
                            key={`${e.tipo}-${e.id}`}
                            className={`flex items-center gap-1 truncate rounded px-1.5 py-0.5 text-[11px] font-medium ${est.clase}`}
                          >
                            {e.tipo === "tarea" ? (
                              <IconClipboardCheck className="h-3 w-3 shrink-0" />
                            ) : (
                              <IconWrench className="h-3 w-3 shrink-0" />
                            )}
                            <span className="truncate">
                              {e.hora ? `${e.hora} ` : ""}
                              {e.titulo}
                            </span>
                          </span>
                        );
                      })}
                      {eventosDia.length > 2 && (
                        <span className="text-[11px] font-medium text-muted">+{eventosDia.length - 2} más</span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </Card>

          <div className="flex flex-col gap-6">
          {tareaRapidaFecha === diaSeleccionado && renderTareaRapida()}
          <Card>
            {diaSeleccionado ? (
              <>
                <h3 className="mb-3 text-sm font-semibold capitalize text-foreground">
                  {fechaDesdeString(diaSeleccionado).toLocaleDateString("es-CL", {
                    weekday: "long",
                    day: "numeric",
                    month: "long",
                  })}
                </h3>
                {eventosDiaSeleccionado.length === 0 ? (
                  <p className="text-sm text-muted">Sin eventos agendados este día.</p>
                ) : (
                  <div className="flex flex-col divide-y divide-border">
                    {eventosDiaSeleccionado.map((e) => (
                      <button
                        key={`${e.tipo}-${e.id}`}
                        type="button"
                        onClick={() => abrirEvento(e)}
                        className="flex items-center justify-between gap-2 py-2.5 text-left hover:text-brand"
                      >
                        <div className="min-w-0">
                          <p className="flex items-center gap-1.5 truncate text-sm font-medium text-foreground">
                            {e.tipo === "tarea" ? (
                              <IconClipboardCheck className="h-3.5 w-3.5 shrink-0 text-muted" />
                            ) : (
                              <IconWrench className="h-3.5 w-3.5 shrink-0 text-muted" />
                            )}
                            {e.titulo}
                          </p>
                          <p className="text-xs text-muted">
                            {e.hora ?? "Sin hora"} · {e.subtitulo}
                          </p>
                        </div>
                        <Badge value={e.estadoAgenda} />
                      </button>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <p className="text-sm text-muted">Haz clic en un día para crear una tarea rápida o ver su detalle.</p>
            )}
          </Card>
          </div>
        </div>
      ) : vista === "semana" ? (
        <div className="flex flex-col gap-6">
        {renderTareaRapida()}
        <Card className="overflow-hidden p-0">
          <div className="grid grid-cols-1 divide-y divide-border sm:grid-cols-7 sm:divide-x sm:divide-y-0">
            {diasSemana.map((dia) => {
              const clave = fmtLocal(dia);
              const esHoy = clave === hoy;
              const eventosDia = eventosPorDia.get(clave) ?? [];
              return (
                <div key={clave} className="flex flex-col">
                  <button
                    type="button"
                    onClick={() => (puedeGestionarAgenda ? abrirTareaRapida(clave) : undefined)}
                    disabled={!puedeGestionarAgenda}
                    title={puedeGestionarAgenda ? "Nueva tarea este día" : undefined}
                    className={`flex items-center justify-center gap-2 border-b px-3 py-2 text-xs font-medium transition-colors sm:flex-col sm:gap-1 ${
                      tareaRapidaFecha === clave ? "border-brand bg-brand-soft/60" : "border-border"
                    } ${esHoy ? "text-brand" : "text-muted"} ${puedeGestionarAgenda ? "hover:bg-surface-sunken" : ""}`}
                  >
                    <span className="capitalize">{NOMBRES_DIA_CORTOS[dia.getDay()]}</span>
                    <span
                      className={`flex h-6 w-6 items-center justify-center rounded-full text-sm ${
                        esHoy ? "bg-brand text-brand-foreground" : "text-foreground"
                      }`}
                    >
                      {dia.getDate()}
                    </span>
                  </button>
                  <div className="flex min-h-[4rem] flex-1 flex-col gap-1.5 p-2">
                    {eventosDia.length === 0 ? (
                      <p className="py-1 text-center text-xs text-muted sm:hidden">Sin eventos</p>
                    ) : (
                      eventosDia.map((e) => {
                        const est = ESTADOS_AGENDA.find((x) => x.valor === e.estadoAgenda)!;
                        return (
                          <button
                            key={`${e.tipo}-${e.id}`}
                            type="button"
                            onClick={() => abrirEvento(e)}
                            className={`flex w-full flex-col items-start gap-0.5 overflow-hidden rounded-lg px-2 py-1.5 text-left text-xs transition-opacity hover:opacity-80 ${est.clase}`}
                          >
                            <span className="flex items-center gap-1 font-medium">
                              {e.tipo === "tarea" ? (
                                <IconClipboardCheck className="h-3 w-3 shrink-0" />
                              ) : (
                                <IconWrench className="h-3 w-3 shrink-0" />
                              )}
                              {e.hora ?? "Sin hora"}
                            </span>
                            <span className="w-full truncate">{e.titulo}</span>
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
        </div>
      ) : (
        <div className="flex flex-col gap-6">
        {renderTareaRapida()}
        <Card>
          {puedeGestionarAgenda && tareaRapidaFecha !== fmtLocal(fechaActual) && (
            <div className="mb-4">
              <Button type="button" variant="outline" onClick={() => abrirTareaRapida(fmtLocal(fechaActual))}>
                <IconPlus className="h-4 w-4" />
                Nueva tarea este día
              </Button>
            </div>
          )}
          {eventosDelDiaVista.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-16 text-center">
              <IconCalendar className="h-8 w-8 text-muted" />
              <p className="text-sm text-muted">Sin eventos agendados este día.</p>
            </div>
          ) : (
            <div className="flex flex-col divide-y divide-border">
              {eventosDelDiaVista.map((e) => (
                <button
                  key={`${e.tipo}-${e.id}`}
                  type="button"
                  onClick={() => abrirEvento(e)}
                  className="flex items-center justify-between gap-3 py-3 text-left hover:text-brand"
                >
                  <div className="min-w-0">
                    <p className="flex items-center gap-1.5 truncate font-medium text-foreground">
                      {e.tipo === "tarea" ? (
                              <IconClipboardCheck className="h-3.5 w-3.5 shrink-0 text-muted" />
                            ) : (
                              <IconWrench className="h-3.5 w-3.5 shrink-0 text-muted" />
                            )}
                      {e.titulo}
                    </p>
                    <p className="text-xs text-muted">
                      {e.hora ?? "Sin hora"} · {e.subtitulo}
                    </p>
                  </div>
                  <Badge value={e.estadoAgenda} />
                </button>
              ))}
            </div>
          )}
        </Card>
        </div>
      )}
    </DashboardShell>
  );
}

export default function AgendaPage() {
  return (
    <Suspense fallback={null}>
      <AgendaContenido />
    </Suspense>
  );
}
