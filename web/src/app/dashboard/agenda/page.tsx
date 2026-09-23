"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
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
import { puedeVerModulo, formatearFolio, estadoAgendaDeOS, estadoAgendaDeTarea, ETIQUETA_ESTADO_AGENDA, ETIQUETA_TIPO_AGENDA, TONO_ESTADO_AGENDA, type EstadoAgendaUnificado, type TipoEventoAgenda } from "@bitacora/shared";
import { Calendar, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, ClipboardCheck, Info, Plus, Search, Wrench } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { apiFetch } from "@/lib/api";
import { DashboardShell, type UsuarioShell } from "@/components/DashboardShell";
import { Modal } from "@/components/Modal";
import { ComboboxCliente } from "@/components/ComboboxCliente";
import { ComboboxResponsable } from "@/components/ComboboxResponsable";
import { EstadoCitaRiel } from "@/components/EstadoCitaRiel";
import { Button, Card, DatePicker, Input, Select, StatusBadge, Textarea, type TonoEstado } from "@bitacora/ui/web";

type OrdenListado = Trabajo & {
  cliente_info: { nombre: string } | null;
  responsable: { nombre: string } | null;
  orden: OrdenServicio | null;
};

type TareaListado = Tarea & {
  cliente: { nombre: string } | null;
  responsable: { nombre: string } | null;
};

// Fase 6.3 (23-sep-2026, pedido explícito): estado→tono y tipo→ícono/
// etiqueta viven en @bitacora/shared (agendaColores.ts) — una sola
// fuente para web y mobile. Antes este archivo tenía su propia copia
// suelta (ESTADOS_AGENDA/ESTADO_TAREA_A_AGENDA/estadoAgendaDe) con la
// misma semántica pero duplicada.
type EstadoAgenda = EstadoAgendaUnificado;

type EventoAgenda = {
  id: string;
  tipo: TipoEventoAgenda;
  fecha: string;
  hora: string | null;
  estadoAgenda: EstadoAgenda;
  titulo: string;
  subtitulo: string;
  origen: OrdenListado | TareaListado;
};

const ESTADOS_AGENDA: { valor: EstadoAgenda; etiqueta: string; tono: TonoEstado }[] = (
  Object.keys(ETIQUETA_ESTADO_AGENDA) as EstadoAgendaUnificado[]
).map((valor) => ({ valor, etiqueta: ETIQUETA_ESTADO_AGENDA[valor], tono: TONO_ESTADO_AGENDA[valor] }));

// Mismas clases que StatusBadge arma internamente — necesarias acá
// porque las celdas del mes/semana necesitan el ícono adentro del chip
// (StatusBadge no tiene ese slot), así que no se puede reusar el
// componente tal cual en esos 2 lugares.
// peligro/advertencia no los usa la Agenda (sus 4 estados de siempre
// no caen ahí) — se listan solo para satisfacer el Record exhaustivo
// desde que TonoEstado los tiene (23-sep-2026).
const CLASE_CHIP: Record<TonoEstado, string> = {
  en_progreso: "bg-ds-accent-200 text-ds-accent-800",
  completado: "bg-ds-accent2-200 text-ds-accent2-800",
  cerrado: "bg-ds-neutral-300 text-ds-neutral-900",
  cancelado: "bg-ds-neutral-200 text-ds-neutral-700",
  peligro: "bg-ds-danger-soft text-ds-danger",
  advertencia: "bg-ds-warning-soft text-ds-warning",
};

function estadoInfo(estado: EstadoAgenda) {
  return ESTADOS_AGENDA.find((x) => x.valor === estado)!;
}

const PRIORIDADES: Prioridad[] = ["alta", "media", "baja"];

// Ícono por tipo (6.3: color=estado, ícono+etiqueta=tipo — Levantamiento
// no se muestra hoy en la Agenda web, ver diagnóstico 6.1, así que acá
// solo hacen falta "os"/"cita").
const ICONO_TIPO: Record<TipoEventoAgenda, typeof Calendar> = { cita: Calendar, os: ClipboardCheck, levantamiento: Search };

function eventoDeOrden(o: OrdenListado): EventoAgenda {
  return {
    id: o.id,
    tipo: "os",
    fecha: o.fecha,
    hora: o.hora_programada,
    estadoAgenda: estadoAgendaDeOS(o.estado, o.orden?.estado_os ?? null),
    titulo: o.cliente_info?.nombre ?? o.cliente,
    subtitulo: o.responsable?.nombre ?? "—",
    origen: o,
  };
}

function eventoDeTarea(t: TareaListado): EventoAgenda {
  const subtituloBase = t.cliente?.nombre ?? t.responsable?.nombre ?? "—";
  const folio = formatearFolio("CIT", t.folio);
  return {
    id: t.id,
    tipo: "cita",
    fecha: t.fecha,
    hora: t.hora,
    estadoAgenda: estadoAgendaDeTarea(t.estado),
    titulo: t.titulo,
    subtitulo: folio ? `${folio} · ${subtituloBase}` : subtituloBase,
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
const CLAVE_FILTRO_TIPO = "agenda:filtro-tipo";

function AgendaContenido() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [usuario, setUsuario] = useState<UsuarioShell | null>(null);
  // Duración por defecto de una cita nueva (Configuración > Empresa >
  // Agenda) — ya no se pide en el formulario (ver resetearFormTarea).
  const [duracionCitaDefault, setDuracionCitaDefault] = useState(60);
  const [modulosDeshabilitados, setModulosDeshabilitados] = useState<Modulo[]>([]);
  const [modulosVisibles, setModulosVisibles] = useState<Modulo[] | null>(null);
  const [vista, setVista] = useState<"mes" | "semana" | "dia">("mes");
  // Menú "+ Nuevo" (Cita / OS / Levantamiento) del encabezado.
  const [nuevoMenuAbierto, setNuevoMenuAbierto] = useState(false);
  const nuevoMenuRef = useRef<HTMLDivElement>(null);
  const [fechaActual, setFechaActual] = useState(() => new Date());
  const [ordenes, setOrdenes] = useState<OrdenListado[] | null>(null);
  const [tareas, setTareas] = useState<TareaListado[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filtros, setFiltros] = useState<Set<EstadoAgenda>>(new Set());
  // Fase 6.2 — filtro por tipo, combinable con el de estado (AND).
  // Vacío = todos (mismo criterio que `filtros`). Se recuerda entre
  // sesiones (localStorage, mismo patrón que CLAVE_COLAPSADO del
  // sidebar) — Levantamiento no está acá porque la Agenda web no lo
  // muestra hoy (ver diagnóstico 6.1).
  const [tipoFiltros, setTipoFiltros] = useState<Set<TipoEventoAgenda>>(new Set());
  const [leyendaAbierta, setLeyendaAbierta] = useState(false);
  const [diaSeleccionado, setDiaSeleccionado] = useState<string | null>(null);

  useEffect(() => {
    const guardado = window.localStorage.getItem(CLAVE_FILTRO_TIPO);
    if (guardado) {
      try {
        setTipoFiltros(new Set(JSON.parse(guardado)));
      } catch {
        /* localStorage corrupto — se ignora, queda "todos" */
      }
    }
  }, []);

  const [formTareaAbierto, setFormTareaAbierto] = useState(false);
  const [tareaEditandoId, setTareaEditandoId] = useState<string | null>(null);
  const [tareaEditandoFolio, setTareaEditandoFolio] = useState<number | null>(null);
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
            tema: u.empresa?.tema ?? "faena",
            colorPrimarioForeground: u.empresa?.color_primario_foreground ?? null,
            moneda: u.empresa?.moneda ?? "CLP",
          });
          setDuracionCitaDefault(u.empresa?.duracion_cita_default_min ?? 60);
        }
        setModulosDeshabilitados(deshabilitados ?? []);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  useEffect(() => {
    function onClickFuera(e: MouseEvent) {
      if (nuevoMenuRef.current && !nuevoMenuRef.current.contains(e.target as Node)) setNuevoMenuAbierto(false);
    }
    document.addEventListener("mousedown", onClickFuera);
    return () => document.removeEventListener("mousedown", onClickFuera);
  }, []);

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
    setTareaEditandoFolio(null);
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
    // react-hooks/immutability: cargarOpcionesFormTarea se declara más
    // abajo (line ~331) — es seguro por hoisting de function declaration
    // y porque para cuando este efecto realmente se ejecuta (post-mount,
    // async) el render ya corrió completo. Convertirla en useCallback y
    // moverla antes del guard `if (!usuario) return null` (línea ~614,
    // de donde depende puedeAgendaPro) arrastra ese guard a un refactor
    // más grande y arriesgado para un solo hallazgo de lint — no vale la
    // pena tocar código que ya funciona sin una prueba dedicada.
    // eslint-disable-next-line react-hooks/immutability
    cargarOpcionesFormTarea();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const eventos = useMemo(() => {
    return [...(ordenes ?? []).map(eventoDeOrden), ...(tareas ?? []).map(eventoDeTarea)];
  }, [ordenes, tareas]);

  const eventosFiltrados = useMemo(() => {
    return eventos.filter((e) => (filtros.size === 0 || filtros.has(e.estadoAgenda)) && (tipoFiltros.size === 0 || tipoFiltros.has(e.tipo)));
  }, [eventos, filtros, tipoFiltros]);

  // Cuántos hay de cada tipo en el rango cargado (antes de aplicar el
  // propio filtro de tipo, así el chip no "se cierra sobre sí mismo") —
  // se muestra junto a la etiqueta, mismo pedido que los de estado.
  const conteoPorTipo = useMemo(() => {
    const m = new Map<TipoEventoAgenda, number>();
    for (const e of eventos) {
      if (filtros.size > 0 && !filtros.has(e.estadoAgenda)) continue;
      m.set(e.tipo, (m.get(e.tipo) ?? 0) + 1);
    }
    return m;
  }, [eventos, filtros]);

  function alternarTipoFiltro(tipo: TipoEventoAgenda) {
    setTipoFiltros((prev) => {
      const next = new Set(prev);
      if (next.has(tipo)) next.delete(tipo);
      else next.add(tipo);
      window.localStorage.setItem(CLAVE_FILTRO_TIPO, JSON.stringify([...next]));
      return next;
    });
  }

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
    setTareaEditandoFolio(null);
    setTrabajoVinculado(null);
    setTituloTarea("");
    setDescripcionTarea("");
    setFechaTarea(fecha);
    setHoraTarea("");
    // Ya no se pide al usuario — usa el default configurable de la
    // empresa (Configuración > Empresa > Agenda, antes fijo en "60").
    setDuracionTarea(String(duracionCitaDefault));
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

  // Análogo a onCrearOSDesdeTarea, pero para Levantamiento — no guarda
  // borrador de tarea ni vuelve a Agenda al terminar (Levantamiento no
  // se "vincula" a una cita como sí lo hace una OS a trabajo_id; no hay
  // columna equivalente en tareas). En cambio, lo que ya escribiste acá
  // se lleva directo al form de Levantamientos, precargado.
  function onCrearLevantamientoDesdeTarea() {
    const q = new URLSearchParams({ crear: "1" });
    if (clienteIdTarea) q.set("cliente_id", clienteIdTarea);
    if (descripcionTarea.trim()) q.set("descripcion", descripcionTarea.trim());
    if (fechaTarea) q.set("fecha_visita", fechaTarea);
    if (horaTarea) q.set("hora_visita", horaTarea);
    router.push(`/dashboard/levantamientos?${q.toString()}`);
  }

  // Menú "+ Nuevo" del encabezado — a diferencia de onCrearOSDesdeTarea
  // (que salva un borrador de tarea en curso), estas van directo: no hay
  // nada que preservar, así que no llevan ?volverA=agenda.
  function abrirNuevaOSDesdeMenu() {
    setNuevoMenuAbierto(false);
    router.push("/dashboard/ordenes/nueva");
  }

  function abrirNuevoLevantamientoDesdeMenu() {
    setNuevoMenuAbierto(false);
    router.push("/dashboard/levantamientos?crear=1");
  }

  function abrirEdicionTarea(t: TareaListado) {
    setTareaRapidaFecha(null);
    setTrabajoVinculado(null);
    setTareaEditandoId(t.id);
    setTareaEditandoFolio(t.folio);
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

  // No es un <form onSubmit> real — el botón que la dispara es
  // type="button" dentro del Modal (que ya tiene su propio form para
  // "Guardar cambios" de la tarea); no hace falta preventDefault.
  async function onCrearPaquete() {
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
  const puedeCrearOS = moduloVisible("ordenes_servicio");
  const puedeCrearLevantamiento = moduloVisible("levantamientos");
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
      <Card>
        <form onSubmit={onGuardarTarea} className="flex flex-col gap-ds-3">
          <div className="flex items-center justify-between">
            <p className="font-ds-body text-ds-small font-semibold text-ds-text">
              Nueva tarea — {fechaDesdeString(tareaRapidaFecha).toLocaleDateString("es-CL", { weekday: "long", day: "numeric", month: "long" })}
            </p>
            <button type="button" onClick={cerrarTareaRapida} className="font-ds-body text-ds-caption font-medium text-ds-text/60 hover:text-ds-text">
              Cerrar
            </button>
          </div>

          {trabajoVinculado && (
            <p className="rounded-ds-md bg-ds-accent2-100 px-ds-3 py-ds-2 font-ds-body text-ds-caption font-medium text-ds-accent2-800">
              ✓ {formatearFolio("OS", trabajoVinculado.folio) ?? "Orden de servicio"} creada — se vincula a esta tarea al guardar.
            </p>
          )}

          <Input etiqueta="Título" valor={tituloTarea} onCambio={setTituloTarea} placeholder="Ej: Visita técnica, recordatorio…" />
          <div className="grid gap-ds-3 sm:grid-cols-2">
            <DatePicker
              etiqueta="Fecha"
              valor={fechaTarea ? fechaDesdeString(fechaTarea) : null}
              onCambio={(f) => {
                const texto = f ? fmtLocal(f) : "";
                setFechaTarea(texto);
                setTareaRapidaFecha(texto || tareaRapidaFecha);
              }}
            />
            <Input etiqueta="Hora (opcional)" tipo="hora" valor={horaTarea} onCambio={setHoraTarea} />
          </div>
          <div className="flex flex-col gap-ds-1">
            <label className="font-ds-body text-ds-caption font-medium text-ds-text/70">Cliente (opcional)</label>
            <ComboboxCliente
              value={clienteIdTarea}
              onChange={onCambiarClienteTarea}
              clientes={clientesOpciones}
              onClienteCreado={(c) => setClientesOpciones((prev) => [...prev, c])}
              opcionVacia="Sin cliente"
              placeholder="Sin cliente"
            />
          </div>
          <div className="flex flex-col gap-ds-1">
            <label className="font-ds-body text-ds-caption font-medium text-ds-text/70">Responsable (opcional)</label>
            <ComboboxResponsable
              value={responsableIdTarea}
              onChange={setResponsableIdTarea}
              equipo={usuariosOpciones}
              opcionVacia="Sin asignar"
              placeholder="Sin asignar"
            />
          </div>

          {errorTarea ? <p className="font-ds-body text-ds-small text-ds-accent-700">{errorTarea}</p> : null}

          <div className="flex flex-wrap items-center gap-ds-2 border-t border-ds-divider pt-ds-3">
            <Button tipo="submit" cargando={guardandoTarea}>
              Guardar tarea
            </Button>
            {!trabajoVinculado && (
              <Button variante="secundario" onPress={onCrearOSDesdeTarea} deshabilitado={guardandoTarea} iconoIzq={<Wrench size={16} strokeWidth={2.75} />}>
                Crear Orden de Servicio
              </Button>
            )}
            {!trabajoVinculado && (
              <Button variante="secundario" onPress={onCrearLevantamientoDesdeTarea} deshabilitado={guardandoTarea} iconoIzq={<Search size={16} strokeWidth={2.75} />}>
                Crear Levantamiento
              </Button>
            )}
          </div>
        </form>
      </Card>
    );
  }

  return (
    <DashboardShell usuario={usuario}>
      <div className="mb-ds-6 flex flex-wrap items-center justify-between gap-ds-3">
        <p className="ds-heading flex items-center gap-ds-2 text-ds-h2 text-ds-text">
          <Calendar size={24} strokeWidth={2.5} className="text-ds-brand" />
          Agenda
        </p>
        <div className="flex items-center gap-ds-2">
          <div className="flex gap-1 rounded-ds-pill border border-ds-divider p-ds-1">
            {(["mes", "semana", "dia"] as const).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setVista(v)}
                className={`rounded-ds-pill px-ds-3 py-1.5 font-ds-body text-ds-small font-medium transition-colors ${
                  vista === v ? "bg-ds-brand/[0.08] text-ds-brand" : "text-ds-text/60 hover:text-ds-text"
                }`}
              >
                {v === "mes" ? "Mes" : v === "semana" ? "Semana" : "Día"}
              </button>
            ))}
          </div>
          {puedeGestionarAgenda && (
            <div className="relative" ref={nuevoMenuRef}>
              <Button
                variante="secundario"
                onPress={() => setNuevoMenuAbierto((v) => !v)}
                iconoIzq={<Plus size={16} strokeWidth={2.75} />}
                iconoDer={<ChevronDown size={14} strokeWidth={2.75} />}
              >
                Nuevo
              </Button>
              {nuevoMenuAbierto && (
                <div className="absolute right-0 top-full z-10 mt-2 w-56 overflow-hidden rounded-lg border border-ds-divider bg-ds-surface py-1 shadow-ds-md">
                  <button
                    type="button"
                    onClick={() => {
                      setNuevoMenuAbierto(false);
                      abrirNuevaTarea();
                    }}
                    className="flex w-full items-center gap-2 px-4 py-2 font-ds-body text-sm text-ds-text hover:bg-ds-brand/[0.08] hover:text-ds-brand"
                  >
                    <ICONO_TIPO.cita size={16} strokeWidth={2.75} />
                    Cita
                  </button>
                  {puedeCrearOS && (
                    <button
                      type="button"
                      onClick={abrirNuevaOSDesdeMenu}
                      className="flex w-full items-center gap-2 px-4 py-2 font-ds-body text-sm text-ds-text hover:bg-ds-brand/[0.08] hover:text-ds-brand"
                    >
                      <ICONO_TIPO.os size={16} strokeWidth={2.75} />
                      Orden de servicio
                    </button>
                  )}
                  {puedeCrearLevantamiento && (
                    <button
                      type="button"
                      onClick={abrirNuevoLevantamientoDesdeMenu}
                      className="flex w-full items-center gap-2 px-4 py-2 font-ds-body text-sm text-ds-text hover:bg-ds-brand/[0.08] hover:text-ds-brand"
                    >
                      <Search size={16} strokeWidth={2.75} />
                      Levantamiento
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <Modal
        open={formTareaAbierto}
        onClose={() => setFormTareaAbierto(false)}
        title={tareaEditandoId ? (formatearFolio("CIT", tareaEditandoFolio) ? `Editar tarea — ${formatearFolio("CIT", tareaEditandoFolio)}` : "Editar tarea") : "Nueva tarea"}
        wide
      >
        <form onSubmit={onGuardarTarea} className="flex flex-col gap-ds-4">
            <div className="grid gap-ds-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Input etiqueta="Título" requerido valor={tituloTarea} onCambio={setTituloTarea} />
              </div>
              <DatePicker etiqueta="Fecha" valor={fechaTarea ? fechaDesdeString(fechaTarea) : null} onCambio={(f) => setFechaTarea(f ? fmtLocal(f) : "")} />
              <Input etiqueta="Hora (opcional)" tipo="hora" valor={horaTarea} onCambio={setHoraTarea} />
              <div className="flex flex-col gap-ds-1">
                <label className="font-ds-body text-ds-caption font-medium text-ds-text/70">Cliente (opcional)</label>
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
                <div className="rounded-ds-md border border-ds-divider p-ds-3 sm:col-span-2">
                  <p className="mb-ds-2 font-ds-body text-ds-caption font-semibold text-ds-text">Paquete de sesiones (Agenda Pro)</p>
                  <div className="grid gap-ds-3 sm:grid-cols-[1fr_8rem]">
                    <Select
                      etiqueta="Paquete (opcional)"
                      valor={paqueteIdTarea}
                      onCambio={setPaqueteIdTarea}
                      opciones={[
                        { valor: "", etiqueta: "Sin paquete (cita suelta)" },
                        ...paquetesCliente.map((p) => ({ valor: p.id, etiqueta: `${p.nombre} — ${p.saldo}/${p.cantidad_total} restantes` })),
                      ]}
                    />
                    {paqueteIdTarea && (
                      <Input
                        etiqueta="Sesiones a consumir"
                        tipo="numero"
                        valor={String(sesionesConsumidasTarea)}
                        onCambio={(v) => setSesionesConsumidasTarea(Number(v) || 1)}
                      />
                    )}
                  </div>
                  {!formPaqueteAbierto ? (
                    <button
                      type="button"
                      onClick={() => setFormPaqueteAbierto(true)}
                      className="mt-ds-2 font-ds-body text-ds-caption font-medium text-ds-brand hover:underline"
                    >
                      + Crear paquete nuevo para este cliente
                    </button>
                  ) : (
                    <div className="mt-ds-3 flex flex-col gap-ds-2 border-t border-ds-divider pt-ds-3 sm:flex-row sm:items-end">
                      <div className="flex-1">
                        <Input etiqueta="Nombre del paquete" placeholder="Ej: Pack 10 sesiones" valor={nombrePaquete} onCambio={setNombrePaquete} />
                      </div>
                      <div className="w-24">
                        <Input etiqueta="Cantidad" tipo="numero" valor={String(cantidadPaquete)} onCambio={(v) => setCantidadPaquete(Number(v) || 1)} />
                      </div>
                      <Button variante="secundario" cargando={guardandoPaquete} onPress={onCrearPaquete}>
                        Crear
                      </Button>
                    </div>
                  )}
                  {errorPaquete ? <p className="mt-ds-2 font-ds-body text-ds-small text-ds-accent-700">{errorPaquete}</p> : null}
                </div>
              )}
              <div className="flex flex-col gap-ds-1">
                <label className="font-ds-body text-ds-caption font-medium text-ds-text/70">Responsable (opcional)</label>
                <ComboboxResponsable
                  value={responsableIdTarea}
                  onChange={setResponsableIdTarea}
                  equipo={usuariosOpciones}
                  opcionVacia="Sin asignar"
                  placeholder="Sin asignar"
                />
              </div>
              <Select
                etiqueta="Prioridad"
                valor={prioridadTarea}
                onCambio={(v) => setPrioridadTarea(v as Prioridad)}
                opciones={PRIORIDADES.map((p) => ({ valor: p, etiqueta: p.charAt(0).toUpperCase() + p.slice(1) }))}
              />
              {tareaEditandoId && (
                <div className="rounded-ds-md border border-ds-divider p-ds-3 sm:col-span-2">
                  {(estadoTarea === "pendiente" || estadoTarea === "confirmada") && (
                    <div className="mb-ds-3">
                      <Button variante="secundario" deshabilitado={guardandoTarea} onPress={() => onCambiarEstadoInstantaneo("completada")}>
                        Marcar Asistió
                      </Button>
                    </div>
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
                <Textarea etiqueta="Descripción (opcional)" filas={3} valor={descripcionTarea} onCambio={setDescripcionTarea} />
              </div>
            </div>
            {errorTarea ? <p className="font-ds-body text-ds-small text-ds-accent-700">{errorTarea}</p> : null}
            <div className="flex items-center gap-ds-2">
              <Button tipo="submit" cargando={guardandoTarea}>
                {tareaEditandoId ? "Guardar cambios" : "Crear tarea"}
              </Button>
              <Button variante="ghost" onPress={() => setFormTareaAbierto(false)}>
                Cancelar
              </Button>
              {tareaEditandoId && (
                <div className="ml-auto">
                  <Button variante="peligro" onPress={onEliminarTarea}>
                    Eliminar
                  </Button>
                </div>
              )}
            </div>
        </form>
      </Modal>

      <div className="mb-ds-6">
        <Card>
          <div className="mb-ds-4 flex flex-wrap items-center gap-ds-2">
            {ESTADOS_AGENDA.map((e) => (
              <button
                key={e.valor}
                type="button"
                onClick={() => alternarFiltro(e.valor)}
                className={`rounded-ds-pill border px-ds-3 py-1 font-ds-body text-ds-caption font-medium transition-colors ${
                  filtros.has(e.valor) ? `${CLASE_CHIP[e.tono]} border-transparent` : "border-ds-divider text-ds-text/70 hover:border-ds-text/30"
                }`}
              >
                {e.etiqueta}
              </button>
            ))}
            {filtros.size > 0 && (
              <button type="button" onClick={() => setFiltros(new Set())} className="font-ds-body text-ds-caption font-medium text-ds-text/60 hover:text-ds-brand">
                Limpiar
              </button>
            )}
          </div>

          {/* Fase 6.2 — segunda fila de chips, eje independiente (tipo,
              no estado) — mismo look que la fila de arriba. Solo los
              tipos con módulo activo (OS necesita "ordenes_servicio";
              Cita no tiene gate propio, si se llegó a esta página el
              módulo Agenda ya está activo). */}
          <div className="mb-ds-4 flex flex-wrap items-center gap-ds-2 border-t border-ds-divider pt-ds-3">
            {(["cita", "os"] as TipoEventoAgenda[])
              .filter((t) => t !== "os" || puedeCrearOS)
              .map((t) => {
                const Icono = ICONO_TIPO[t];
                const activo = tipoFiltros.has(t);
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => alternarTipoFiltro(t)}
                    className={`flex items-center gap-1.5 rounded-ds-pill border px-ds-3 py-1 font-ds-body text-ds-caption font-medium transition-colors ${
                      activo ? "border-ds-brand bg-ds-brand/10 text-ds-brand" : "border-ds-divider text-ds-text/70 hover:border-ds-text/30"
                    }`}
                  >
                    <Icono size={13} strokeWidth={2.5} />
                    {ETIQUETA_TIPO_AGENDA[t]}
                    <span className="tabular-nums text-ds-text/50">{conteoPorTipo.get(t) ?? 0}</span>
                  </button>
                );
              })}
            {tipoFiltros.size > 0 && (
              <button
                type="button"
                onClick={() => {
                  setTipoFiltros(new Set());
                  window.localStorage.removeItem(CLAVE_FILTRO_TIPO);
                }}
                className="font-ds-body text-ds-caption font-medium text-ds-text/60 hover:text-ds-brand"
              >
                Limpiar
              </button>
            )}
            <button
              type="button"
              onClick={() => setLeyendaAbierta((v) => !v)}
              className="ml-auto flex items-center gap-1 font-ds-body text-ds-caption font-medium text-ds-text/60 hover:text-ds-brand"
            >
              <Info size={13} strokeWidth={2.5} />
              Leyenda
              {leyendaAbierta ? <ChevronUp size={13} strokeWidth={2.5} /> : <ChevronDown size={13} strokeWidth={2.5} />}
            </button>
          </div>

          {leyendaAbierta && (
            <div className="mb-ds-4 flex flex-wrap items-center gap-ds-4 rounded-ds-md bg-ds-neutral-100 px-ds-3 py-ds-2">
              <div className="flex flex-wrap items-center gap-ds-2">
                {ESTADOS_AGENDA.map((e) => (
                  <span key={e.valor} className={`rounded-ds-pill px-ds-2 py-0.5 font-ds-body text-ds-micro font-medium ${CLASE_CHIP[e.tono]}`}>
                    {e.etiqueta}
                  </span>
                ))}
              </div>
              <div className="h-4 w-px bg-ds-divider" />
              <div className="flex flex-wrap items-center gap-ds-3">
                {(["cita", "os"] as TipoEventoAgenda[]).map((t) => {
                  const Icono = ICONO_TIPO[t];
                  return (
                    <span key={t} className="flex items-center gap-1 font-ds-body text-ds-micro text-ds-text/70">
                      <Icono size={13} strokeWidth={2.5} />
                      {ETIQUETA_TIPO_AGENDA[t]}
                    </span>
                  );
                })}
              </div>
            </div>
          )}

          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => (vista === "mes" ? irMes(-1) : vista === "semana" ? irSemana(-1) : irDia(-1))}
              className="rounded-ds-pill p-ds-2 text-ds-text/60 transition-colors hover:bg-ds-text/[0.07] hover:text-ds-brand"
            >
              <ChevronLeft size={16} strokeWidth={2.75} />
            </button>
            <p className="font-ds-body text-ds-small font-semibold capitalize text-ds-text">
              {vista === "mes" ? tituloMes : vista === "semana" ? tituloSemana : tituloDia}
            </p>
            <button
              type="button"
              onClick={() => (vista === "mes" ? irMes(1) : vista === "semana" ? irSemana(1) : irDia(1))}
              className="rounded-ds-pill p-ds-2 text-ds-text/60 transition-colors hover:bg-ds-text/[0.07] hover:text-ds-brand"
            >
              <ChevronRight size={16} strokeWidth={2.75} />
            </button>
          </div>
        </Card>
      </div>

      {error ? (
        <div className="mb-ds-6">
          <p className="font-ds-body text-ds-small text-ds-accent-700">{error}</p>
        </div>
      ) : null}

      {vista === "mes" ? (
        <div className="grid gap-ds-6 lg:grid-cols-[1fr_20rem]">
          <Card sinRelleno>
            <div className="grid grid-cols-7 border-b border-ds-divider text-center font-ds-body text-ds-caption font-medium text-ds-text/60">
              {NOMBRES_DIA_CORTOS.map((d) => (
                <div key={d} className="py-ds-2">
                  {d}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7">
              {celdas.map((dia, i) => {
                if (!dia) return <div key={i} className="min-h-[6.5rem] border-b border-r border-ds-divider last:border-r-0" />;
                const clave = fmtLocal(dia);
                const esHoy = clave === hoy;
                const eventosDia = eventosPorDia.get(clave) ?? [];
                const seleccionado = diaSeleccionado === clave;
                return (
                  <button
                    key={i}
                    type="button"
                    // 1 clic: ver las citas del día. Doble clic: agendar
                    // una cita nueva ese día (solo quien gestiona agenda).
                    onClick={() => setDiaSeleccionado(clave)}
                    onDoubleClick={() => {
                      if (puedeGestionarAgenda) abrirTareaRapida(clave);
                    }}
                    title={puedeGestionarAgenda ? "Clic: ver citas · Doble clic: agendar" : "Clic: ver citas del día"}
                    className={`flex min-h-[6.5rem] flex-col items-stretch gap-1 border-b border-r border-ds-divider p-ds-1 text-left transition-colors last:border-r-0 hover:bg-ds-neutral-100 ${
                      seleccionado ? "bg-ds-brand/[0.08]" : ""
                    }`}
                  >
                    <span
                      className={`inline-flex h-6 w-6 items-center justify-center rounded-ds-pill font-ds-body text-ds-caption font-medium ${
                        esHoy ? "bg-ds-brand text-ds-brand-foreground" : "text-ds-text"
                      }`}
                    >
                      {dia.getDate()}
                    </span>
                    <div className="flex flex-col gap-1">
                      {eventosDia.slice(0, 2).map((e) => {
                        const est = estadoInfo(e.estadoAgenda);
                        return (
                          <span
                            key={`${e.tipo}-${e.id}`}
                            className={`flex items-center gap-1 truncate rounded-ds-sm px-1.5 py-0.5 font-ds-body text-[11px] font-medium ${CLASE_CHIP[est.tono]}`}
                          >
                            {(() => {
                              const Icono = ICONO_TIPO[e.tipo];
                              return <Icono size={12} strokeWidth={2.75} className="shrink-0" />;
                            })()}
                            <span className="truncate">
                              {e.hora ? `${e.hora} ` : ""}
                              {e.titulo}
                            </span>
                          </span>
                        );
                      })}
                      {eventosDia.length > 2 && (
                        <span className="font-ds-body text-[11px] font-medium text-ds-text/60">+{eventosDia.length - 2} más</span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </Card>

          <div className="flex flex-col gap-ds-6">
          {tareaRapidaFecha === diaSeleccionado && renderTareaRapida()}
          <Card>
            {diaSeleccionado ? (
              <>
                <div className="mb-ds-3 flex items-center justify-between gap-ds-2">
                  <p className="font-ds-body text-ds-small font-semibold capitalize text-ds-text">
                    {fechaDesdeString(diaSeleccionado).toLocaleDateString("es-CL", {
                      weekday: "long",
                      day: "numeric",
                      month: "long",
                    })}
                  </p>
                  <div className="flex items-center gap-ds-3">
                    {puedeGestionarAgenda && (
                      <button
                        type="button"
                        onClick={() => abrirTareaRapida(diaSeleccionado)}
                        className="font-ds-body text-ds-caption font-medium text-ds-brand hover:underline"
                      >
                        Agendar cita
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        setDiaSeleccionado(null);
                        cerrarTareaRapida();
                      }}
                      className="font-ds-body text-ds-caption font-medium text-ds-text/60 hover:text-ds-text"
                    >
                      Cerrar
                    </button>
                  </div>
                </div>
                {eventosDiaSeleccionado.length === 0 ? (
                  <p className="font-ds-body text-ds-small text-ds-text/60">Sin eventos agendados este día.</p>
                ) : (
                  <div className="flex flex-col divide-y divide-ds-divider">
                    {eventosDiaSeleccionado.map((e) => (
                      <button
                        key={`${e.tipo}-${e.id}`}
                        type="button"
                        onClick={() => abrirEvento(e)}
                        className="flex items-center justify-between gap-ds-2 py-ds-2 text-left hover:text-ds-brand"
                      >
                        <div className="min-w-0">
                          <p className="flex items-center gap-1.5 truncate font-ds-body text-ds-small font-medium text-ds-text">
                            {/* Ícono = tipo, no estado (6.3) — antes esto usaba
                                ClipboardCheck/Wrench al revés de ICONO_TIPO. */}
                            {(() => {
                              const Icono = ICONO_TIPO[e.tipo];
                              return <Icono size={14} strokeWidth={2.75} className="shrink-0 text-ds-text/60" />;
                            })()}
                            {e.titulo}
                          </p>
                          <p className="font-ds-body text-ds-caption text-ds-text/60">
                            {e.hora ?? "Sin hora"} · {e.subtitulo}
                          </p>
                        </div>
                        <StatusBadge estado={e.estadoAgenda} etiqueta={estadoInfo(e.estadoAgenda).etiqueta} tonoForzado={estadoInfo(e.estadoAgenda).tono} />
                      </button>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <p className="font-ds-body text-ds-small text-ds-text/60">
                Haz clic en un día para ver sus citas. Doble clic para agendar una cita nueva.
              </p>
            )}
          </Card>
          </div>
        </div>
      ) : vista === "semana" ? (
        <div className="flex flex-col gap-ds-6">
        {renderTareaRapida()}
        <Card sinRelleno>
          <div className="grid grid-cols-1 divide-y divide-ds-divider sm:grid-cols-7 sm:divide-x sm:divide-y-0">
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
                    className={`flex items-center justify-center gap-2 border-b px-ds-3 py-ds-2 font-ds-body text-ds-caption font-medium transition-colors sm:flex-col sm:gap-1 ${
                      tareaRapidaFecha === clave ? "border-ds-brand bg-ds-brand/[0.08]" : "border-ds-divider"
                    } ${esHoy ? "text-ds-brand" : "text-ds-text/60"} ${puedeGestionarAgenda ? "hover:bg-ds-neutral-100" : ""}`}
                  >
                    <span className="capitalize">{NOMBRES_DIA_CORTOS[dia.getDay()]}</span>
                    <span
                      className={`flex h-6 w-6 items-center justify-center rounded-ds-pill text-ds-small ${
                        esHoy ? "bg-ds-brand text-ds-brand-foreground" : "text-ds-text"
                      }`}
                    >
                      {dia.getDate()}
                    </span>
                  </button>
                  <div className="flex min-h-[4rem] flex-1 flex-col gap-1.5 p-ds-2">
                    {eventosDia.length === 0 ? (
                      <p className="py-ds-1 text-center font-ds-body text-ds-caption text-ds-text/60 sm:hidden">Sin eventos</p>
                    ) : (
                      eventosDia.map((e) => {
                        const est = estadoInfo(e.estadoAgenda);
                        return (
                          <button
                            key={`${e.tipo}-${e.id}`}
                            type="button"
                            onClick={() => abrirEvento(e)}
                            className={`flex w-full flex-col items-start gap-0.5 overflow-hidden rounded-ds-md px-ds-2 py-1.5 text-left font-ds-body text-ds-caption transition-opacity hover:opacity-80 ${CLASE_CHIP[est.tono]}`}
                          >
                            <span className="flex items-center gap-1 font-medium">
                              {(() => {
                                const Icono = ICONO_TIPO[e.tipo];
                                return <Icono size={12} strokeWidth={2.75} className="shrink-0" />;
                              })()}
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
        <div className="flex flex-col gap-ds-6">
        {renderTareaRapida()}
        <Card>
          {puedeGestionarAgenda && tareaRapidaFecha !== fmtLocal(fechaActual) && (
            <div className="mb-ds-4">
              <Button variante="secundario" onPress={() => abrirTareaRapida(fmtLocal(fechaActual))} iconoIzq={<Plus size={16} strokeWidth={2.75} />}>
                Nueva tarea este día
              </Button>
            </div>
          )}
          {eventosDelDiaVista.length === 0 ? (
            <div className="flex flex-col items-center gap-ds-3 py-16 text-center">
              <Calendar size={32} strokeWidth={2.75} className="text-ds-text/60" />
              <p className="font-ds-body text-ds-small text-ds-text/60">Sin eventos agendados este día.</p>
            </div>
          ) : (
            <div className="flex flex-col divide-y divide-ds-divider">
              {eventosDelDiaVista.map((e) => (
                <button
                  key={`${e.tipo}-${e.id}`}
                  type="button"
                  onClick={() => abrirEvento(e)}
                  className="flex items-center justify-between gap-ds-3 py-ds-3 text-left hover:text-ds-brand"
                >
                  <div className="min-w-0">
                    <p className="flex items-center gap-1.5 truncate font-ds-body text-ds-body font-medium text-ds-text">
                      {(() => {
                        const Icono = ICONO_TIPO[e.tipo];
                        return <Icono size={14} strokeWidth={2.75} className="shrink-0 text-ds-text/60" />;
                      })()}
                      {e.titulo}
                    </p>
                    <p className="font-ds-body text-ds-caption text-ds-text/60">
                      {e.hora ?? "Sin hora"} · {e.subtitulo}
                    </p>
                  </div>
                  <StatusBadge estado={e.estadoAgenda} etiqueta={estadoInfo(e.estadoAgenda).etiqueta} tonoForzado={estadoInfo(e.estadoAgenda).tono} />
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
