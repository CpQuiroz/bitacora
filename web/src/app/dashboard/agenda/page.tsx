"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
import { Badge, Button, Card, ErrorText, Input, Label, Select, Textarea, buttonClass } from "@/components/ui";
import { IconCalendar, IconChevronLeft, IconChevronRight, IconClipboardCheck, IconPlus } from "@/components/icons";

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

export default function AgendaPage() {
  const router = useRouter();
  const [usuario, setUsuario] = useState<UsuarioShell | null>(null);
  const [modulosDeshabilitados, setModulosDeshabilitados] = useState<Modulo[]>([]);
  const [vista, setVista] = useState<"mes" | "dia">("mes");
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
  const [clienteIdTarea, setClienteIdTarea] = useState("");
  const [responsableIdTarea, setResponsableIdTarea] = useState("");
  const [prioridadTarea, setPrioridadTarea] = useState<Prioridad>("media");
  const [estadoTarea, setEstadoTarea] = useState<EstadoTarea>("pendiente");
  const [guardandoTarea, setGuardandoTarea] = useState(false);
  const [errorTarea, setErrorTarea] = useState<string | null>(null);
  const [clientesOpciones, setClientesOpciones] = useState<Cliente[]>([]);
  const [usuariosOpciones, setUsuariosOpciones] = useState<Usuario[]>([]);

  const [paquetesCliente, setPaquetesCliente] = useState<PaqueteSesionesConSaldo[]>([]);
  const [paqueteIdTarea, setPaqueteIdTarea] = useState("");
  const [sesionesConsumidasTarea, setSesionesConsumidasTarea] = useState(1);
  const [formPaqueteAbierto, setFormPaqueteAbierto] = useState(false);
  const [nombrePaquete, setNombrePaquete] = useState("");
  const [cantidadPaquete, setCantidadPaquete] = useState(5);
  const [guardandoPaquete, setGuardandoPaquete] = useState(false);
  const [errorPaquete, setErrorPaquete] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setError(null);
    const primerDia = new Date(fechaActual.getFullYear(), fechaActual.getMonth(), 1);
    const ultimoDia = new Date(fechaActual.getFullYear(), fechaActual.getMonth() + 1, 0);
    const params = new URLSearchParams({ desde: fmtLocal(primerDia), hasta: fmtLocal(ultimoDia) });
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
  }, [fechaActual]);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        router.replace("/login");
        return;
      }
      const res = await apiFetch("/api/me");
      if (res.ok) {
        const { usuario: u, modulos_deshabilitados: deshabilitados } = await res.json();
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

  function abrirNuevaTarea() {
    setTareaEditandoId(null);
    setTituloTarea("");
    setDescripcionTarea("");
    setFechaTarea(diaSeleccionado ?? fmtLocal(new Date()));
    setHoraTarea("");
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
    setFormTareaAbierto(true);
    cargarOpcionesFormTarea();
  }

  function abrirEdicionTarea(t: TareaListado) {
    setTareaEditandoId(t.id);
    setTituloTarea(t.titulo);
    setDescripcionTarea(t.descripcion ?? "");
    setFechaTarea(t.fecha);
    setHoraTarea(t.hora ?? "");
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
      cliente_id: clienteIdTarea || null,
      responsable_id: responsableIdTarea || null,
      prioridad: prioridadTarea,
      paquete_id: puedeAgendaPro ? paqueteIdTarea || null : null,
      sesiones_consumidas: puedeAgendaPro && paqueteIdTarea ? sesionesConsumidasTarea : 1,
      ...(tareaEditandoId ? { estado: estadoTarea } : {}),
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

  const puedeGestionarAgenda = puedeVerModulo(usuario.rol, "agenda");
  const puedeAgendaPro = puedeVerModulo(usuario.rol, "agenda_pro") && !modulosDeshabilitados.includes("agenda_pro");
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

  const eventosDiaSeleccionado = diaSeleccionado ? eventosPorDia.get(diaSeleccionado) ?? [] : [];
  const eventosDelDiaVista = vista === "dia" ? eventosPorDia.get(fmtLocal(fechaActual)) ?? [] : [];

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
          <Link href="/dashboard/ordenes/nueva" className={buttonClass("primary")}>
            <IconPlus className="h-4 w-4" />
            Nueva OS
          </Link>
        </div>
      </div>

      {formTareaAbierto && (
        <Card className="mb-6">
          <h2 className="mb-4 text-sm font-semibold text-foreground">{tareaEditandoId ? "Editar tarea" : "Nueva tarea"}</h2>
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
                <Label>Cliente (opcional)</Label>
                <Select value={clienteIdTarea} onChange={(e) => onCambiarClienteTarea(e.target.value)}>
                  <option value="">Sin cliente</option>
                  {clientesOpciones.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nombre}
                    </option>
                  ))}
                </Select>
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
                <Select value={responsableIdTarea} onChange={(e) => setResponsableIdTarea(e.target.value)}>
                  <option value="">Sin asignar</option>
                  {usuariosOpciones.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.nombre}
                    </option>
                  ))}
                </Select>
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
                <div>
                  <Label>Estado</Label>
                  <Select value={estadoTarea} onChange={(e) => setEstadoTarea(e.target.value as EstadoTarea)}>
                    <option value="pendiente">Pendiente</option>
                    {puedeAgendaPro && <option value="confirmada">Confirmada por el cliente</option>}
                    <option value="completada">Completada</option>
                    <option value="cancelada">Cancelada</option>
                  </Select>
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
        </Card>
      )}

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
            onClick={() => (vista === "mes" ? irMes(-1) : irDia(-1))}
            className="rounded-lg p-2 text-muted transition-colors hover:bg-brand-soft hover:text-brand"
          >
            <IconChevronLeft className="h-4 w-4" />
          </button>
          <h2 className="text-sm font-semibold capitalize text-foreground">{vista === "mes" ? tituloMes : tituloDia}</h2>
          <button
            type="button"
            onClick={() => (vista === "mes" ? irMes(1) : irDia(1))}
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
                    onClick={() => setDiaSeleccionado(seleccionado ? null : clave)}
                    className={`flex min-h-[6.5rem] flex-col items-stretch gap-1 border-b border-r border-border p-1.5 text-left transition-colors last:border-r-0 hover:bg-brand-soft/40 ${
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
                            {e.tipo === "tarea" && <IconClipboardCheck className="h-3 w-3 shrink-0" />}
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
                            {e.tipo === "tarea" && <IconClipboardCheck className="h-3.5 w-3.5 shrink-0 text-muted" />}
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
              <p className="text-sm text-muted">Haz clic en un día para ver el detalle completo.</p>
            )}
          </Card>
        </div>
      ) : (
        <Card>
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
                      {e.tipo === "tarea" && <IconClipboardCheck className="h-3.5 w-3.5 shrink-0 text-muted" />}
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
      )}
    </DashboardShell>
  );
}
