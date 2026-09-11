"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Clock, Paperclip, Plus, Route as RouteIcon, Tag as TagIcon } from "lucide-react";
import type {
  Cliente,
  DiaSemana,
  Equipo,
  Prioridad,
  RutaPlanificada,
  TipoCheckin,
  TipoTrabajo,
  Trabajo,
  Usuario,
} from "@bitacora/shared";
import { supabase } from "@/lib/supabase";
import { apiFetch } from "@/lib/api";
import { DashboardShell, type UsuarioShell } from "@/components/DashboardShell";
import { Button, Card, Input, Select, StatusBadge, Tag, Textarea } from "@bitacora/ui/web";
import { ComboboxCliente } from "@/components/ComboboxCliente";
import { ComboboxResponsable } from "@/components/ComboboxResponsable";
import { SelectCrear } from "@/components/SelectCrear";
import dynamic from "next/dynamic";
import type { Parada } from "@/components/MapaRutas";
// Leaflet ~148 KB — carga aparte (AUDITORIA_PERFORMANCE_COSTOS.md #7).
const MapaRutas = dynamic(() => import("@/components/MapaRutas").then((m) => m.MapaRutas), {
  ssr: false,
  loading: () => <div className="h-64 animate-pulse rounded-ds-md bg-ds-surface" />,
});

type TareaConCliente = Trabajo & { cliente_info: Cliente | null };
type VehiculoConAsignacion = Equipo & { asignacion_vigente: { colaborador_id: string; colaborador_nombre: string } | null };

const DIAS: { valor: DiaSemana; etiqueta: string }[] = [
  { valor: "lunes", etiqueta: "Lun" },
  { valor: "martes", etiqueta: "Mar" },
  { valor: "miercoles", etiqueta: "Mié" },
  { valor: "jueves", etiqueta: "Jue" },
  { valor: "viernes", etiqueta: "Vie" },
  { valor: "sabado", etiqueta: "Sáb" },
  { valor: "domingo", etiqueta: "Dom" },
];
const PRIORIDADES: Prioridad[] = ["alta", "media", "baja"];
const TIPOS_CHECKIN: { valor: TipoCheckin; etiqueta: string }[] = [
  { valor: "manual", etiqueta: "Manual" },
  { valor: "ubicacion", etiqueta: "Ubicación" },
];
const TONO_PRIORIDAD: Record<Prioridad, "accent" | "neutral" | "outline"> = {
  alta: "accent",
  media: "neutral",
  baja: "outline",
};

// PASO 6 (sistema de diseño) — migrado. Ver docs/design-system.md.
export default function NuevaRutaPage() {
  const router = useRouter();
  const inputAnexosRef = useRef<HTMLInputElement>(null);

  const [usuario, setUsuario] = useState<UsuarioShell | null>(null);
  const [equipo, setEquipo] = useState<Usuario[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [tiposTrabajo, setTiposTrabajo] = useState<TipoTrabajo[]>([]);
  const [trabajosSinRuta, setTrabajosSinRuta] = useState<Trabajo[]>([]);
  const [vehiculos, setVehiculos] = useState<VehiculoConAsignacion[]>([]);

  const [ruta, setRuta] = useState<(RutaPlanificada & { geocodificado?: boolean; advertencias?: string[] }) | null>(null);
  const [tareas, setTareas] = useState<TareaConCliente[]>([]);

  // --- form: datos de la ruta ---
  const [responsableId, setResponsableId] = useState("");
  const [puntoBase, setPuntoBase] = useState("");
  const [fechaInicio, setFechaInicio] = useState(() => new Date().toISOString().slice(0, 10));
  const [diasSemana, setDiasSemana] = useState<Set<DiaSemana>>(new Set());
  const [horaInicio, setHoraInicio] = useState("09:00");
  const [horaFin, setHoraFin] = useState("18:00");
  const [almuerzoInicio, setAlmuerzoInicio] = useState("13:00");
  const [almuerzoFin, setAlmuerzoFin] = useState("14:00");
  const [creandoRuta, setCreandoRuta] = useState(false);
  const [errorRuta, setErrorRuta] = useState<string | null>(null);
  const [avisoRuta, setAvisoRuta] = useState<string | null>(null);

  // --- form: nueva tarea ---
  const [mostrarFormTarea, setMostrarFormTarea] = useState(false);
  const [clienteId, setClienteId] = useState("");
  const [tipoTrabajoId, setTipoTrabajoId] = useState("");
  const [datosDinamicos, setDatosDinamicos] = useState<Record<string, string>>({});
  const [etiquetas, setEtiquetas] = useState("");
  const [duracionMin, setDuracionMin] = useState("30");
  const [tipoCheckin, setTipoCheckin] = useState<TipoCheckin>("manual");
  const [prioridad, setPrioridad] = useState<Prioridad>("media");
  const [descripcion, setDescripcion] = useState("");
  const [encuestaEmail, setEncuestaEmail] = useState("");
  const [codigo, setCodigo] = useState("");
  const [anexos, setAnexos] = useState<File[]>([]);
  const [guardandoTarea, setGuardandoTarea] = useState(false);
  const [errorTarea, setErrorTarea] = useState<string | null>(null);

  const [tareaExistenteId, setTareaExistenteId] = useState("");
  const [incluyendo, setIncluyendo] = useState(false);

  const [optimizando, setOptimizando] = useState(false);
  const [errorOptimizar, setErrorOptimizar] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        router.replace("/login");
        return;
      }
      const [resMe, resEquipo, resClientes, resTipos, resVehiculos] = await Promise.all([
        apiFetch("/api/me"),
        apiFetch("/api/usuarios"),
        apiFetch("/api/clientes"),
        apiFetch("/api/tipos-trabajo"),
        apiFetch("/api/equipos"),
      ]);
      if (resMe.ok) {
        const { usuario: u } = await resMe.json();
        if (u) {
          setUsuario({ nombre: u.nombre, rol: u.rol, empresaNombre: u.empresa?.nombre ?? "", empresaLogoUrl: u.empresa?.logo_url ?? null, colorPrimario: u.empresa?.color_primario ?? null, colorPrimarioForeground: u.empresa?.color_primario_foreground ?? null, colorSecundario: u.empresa?.color_secundario ?? null, fuente: u.empresa?.fuente ?? null, moneda: u.empresa?.moneda ?? "CLP" });
        }
      }
      if (resEquipo.ok) {
        const lista: Usuario[] = await resEquipo.json();
        setEquipo(lista);
        if (lista.length > 0) setResponsableId(lista[0].id);
      }
      if (resClientes.ok) setClientes(await resClientes.json());
      if (resTipos.ok) setTiposTrabajo(await resTipos.json());
      if (resVehiculos.ok) {
        const todosEquipos: VehiculoConAsignacion[] = await resVehiculos.json();
        setVehiculos(todosEquipos.filter((e) => e.categoria === "Vehículo"));
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function cargarRuta(rutaId: string) {
    const res = await apiFetch(`/api/rutas-planificadas/${rutaId}`);
    if (!res.ok) return;
    const body = await res.json();
    setRuta(body);
    setTareas(body.tareas ?? []);
  }

  async function cargarTrabajosSinRuta() {
    const res = await apiFetch("/api/trabajos");
    if (!res.ok) return;
    const lista: Trabajo[] = await res.json();
    setTrabajosSinRuta(lista.filter((t) => !t.ruta_id));
  }

  function toggleDia(dia: DiaSemana) {
    setDiasSemana((prev) => {
      const next = new Set(prev);
      if (next.has(dia)) next.delete(dia);
      else next.add(dia);
      return next;
    });
  }

  async function onCrearRuta(e: FormEvent) {
    e.preventDefault();
    setErrorRuta(null);
    setCreandoRuta(true);
    const res = await apiFetch("/api/rutas-planificadas", {
      method: "POST",
      body: JSON.stringify({
        responsable_id: responsableId,
        punto_base_direccion: puntoBase,
        fecha_inicio: fechaInicio,
        dias_semana: Array.from(diasSemana),
        hora_inicio: horaInicio,
        hora_fin: horaFin,
        almuerzo_inicio: almuerzoInicio || undefined,
        almuerzo_fin: almuerzoFin || undefined,
      }),
    });
    setCreandoRuta(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setErrorRuta(body.error ?? "No se pudo crear la ruta");
      return;
    }
    const nueva = await res.json();
    setAvisoRuta(
      nueva.geocodificado
        ? "Ruta creada — punto base ubicado en el mapa."
        : "Ruta creada, pero no encontramos el punto base en el mapa — revisa la dirección."
    );
    setRuta(nueva);
    setTareas([]);
    cargarTrabajosSinRuta();
  }

  const tipoTrabajoSeleccionado = tiposTrabajo.find((t) => t.id === tipoTrabajoId);

  function limpiarFormTarea() {
    setClienteId("");
    setTipoTrabajoId("");
    setDatosDinamicos({});
    setEtiquetas("");
    setDuracionMin("30");
    setTipoCheckin("manual");
    setPrioridad("media");
    setDescripcion("");
    setEncuestaEmail("");
    setCodigo("");
    setAnexos([]);
    setMostrarFormTarea(false);
  }

  async function onCrearTarea(e: FormEvent) {
    e.preventDefault();
    if (!ruta) return;
    setErrorTarea(null);

    if (!clienteId) {
      setErrorTarea("Selecciona un cliente");
      return;
    }
    if (!duracionMin || Number(duracionMin) <= 0) {
      setErrorTarea("Falta la duración estimada");
      return;
    }
    if (!descripcion.trim()) {
      setErrorTarea("Falta la descripción de la tarea");
      return;
    }

    setGuardandoTarea(true);
    const formData = new FormData();
    formData.append("cliente_id", clienteId);
    if (tipoTrabajoId) formData.append("tipo_trabajo_id", tipoTrabajoId);
    formData.append("etiquetas", etiquetas);
    formData.append("duracion_estimada_min", duracionMin);
    formData.append("tipo_checkin", tipoCheckin);
    formData.append("prioridad", prioridad);
    formData.append("descripcion", descripcion);
    if (encuestaEmail.trim()) formData.append("encuesta_email", encuestaEmail.trim());
    if (codigo.trim()) formData.append("codigo", codigo.trim());
    if (tipoTrabajoSeleccionado && Object.keys(datosDinamicos).length > 0) {
      formData.append("datos", JSON.stringify(datosDinamicos));
    }
    anexos.forEach((archivo) => formData.append("anexos", archivo));

    const res = await apiFetch(`/api/rutas-planificadas/${ruta.id}/tareas`, {
      method: "POST",
      body: formData,
    });
    setGuardandoTarea(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setErrorTarea(body.error ?? "No se pudo agregar la tarea");
      return;
    }
    limpiarFormTarea();
    cargarRuta(ruta.id);
  }

  async function onIncluirExistente() {
    if (!ruta || !tareaExistenteId) return;
    setIncluyendo(true);
    const res = await apiFetch(`/api/trabajos/${tareaExistenteId}`, {
      method: "PATCH",
      body: JSON.stringify({ ruta_id: ruta.id }),
    });
    setIncluyendo(false);
    if (!res.ok) return;
    setTareaExistenteId("");
    cargarRuta(ruta.id);
    cargarTrabajosSinRuta();
  }

  async function onEliminarTarea(id: string) {
    if (!ruta) return;
    const res = await apiFetch(`/api/trabajos/${id}`, { method: "DELETE" });
    if (!res.ok) return;
    cargarRuta(ruta.id);
    cargarTrabajosSinRuta();
  }

  async function onOptimizar() {
    if (!ruta) return;
    setErrorOptimizar(null);
    setOptimizando(true);
    const res = await apiFetch(`/api/rutas-planificadas/${ruta.id}/optimizar`, { method: "POST" });
    setOptimizando(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setErrorOptimizar(body.error ?? "No se pudo optimizar la ruta");
      return;
    }
    const body = await res.json();
    setRuta(body);
    setTareas(body.tareas ?? []);
  }

  if (!usuario) return null;

  const vehiculoDelResponsable = vehiculos.find((v) => v.asignacion_vigente?.colaborador_id === responsableId) ?? null;

  const paradas: Parada[] = tareas.map((t) => ({
    trabajo_id: t.id,
    cliente_nombre: t.cliente,
    direccion: t.ubicacion ?? "",
    lat: t.cliente_info?.lat ?? null,
    lng: t.cliente_info?.lng ?? null,
  }));

  return (
    <DashboardShell usuario={usuario}>
      <div className="mb-ds-6">
        <p className="ds-heading text-ds-h2 text-ds-text">Nueva ruta de trabajo</p>
        <p className="mt-ds-1 font-ds-body text-ds-small text-ds-text/70">
          Planifica la jornada de un colaborador y optimiza el orden de visita
        </p>
      </div>

      {!ruta && (
        <Card>
          <p className="mb-ds-4 flex items-center gap-ds-2 font-ds-body text-ds-small font-semibold text-ds-text">
            <RouteIcon size={16} strokeWidth={2.75} className="text-ds-brand" />
            Datos de la ruta
          </p>
          <form onSubmit={onCrearRuta} className="flex flex-col gap-ds-4">
            <div className="grid gap-ds-4 sm:grid-cols-2">
              <div className="flex flex-col gap-ds-1">
                <label className="font-ds-body text-ds-caption font-medium text-ds-text/70">Colaborador</label>
                <ComboboxResponsable
                  value={responsableId}
                  onChange={setResponsableId}
                  equipo={equipo}
                  placeholder="Selecciona un colaborador"
                />
                <p className="font-ds-body text-ds-caption text-ds-text/60">
                  {vehiculoDelResponsable
                    ? `Vehículo asignado: ${vehiculoDelResponsable.patente ?? vehiculoDelResponsable.nombre}`
                    : "Sin vehículo asignado"}
                </p>
              </div>
              <DatePickerCampo etiqueta="Fecha de la primera tarea" valor={fechaInicio} onCambio={setFechaInicio} />
              <div className="flex flex-col gap-ds-1 sm:col-span-2">
                <label className="font-ds-body text-ds-caption font-medium text-ds-text/70">Punto base / origen de la ruta</label>
                <Input
                  tipo="texto"
                  requerido
                  placeholder="Dirección — se ubica sola en el mapa"
                  valor={puntoBase}
                  onCambio={setPuntoBase}
                />
              </div>
            </div>

            <div className="flex flex-col gap-ds-1">
              <label className="font-ds-body text-ds-caption font-medium text-ds-text/70">Jornada de trabajo (días)</label>
              <div className="flex flex-wrap gap-ds-2">
                {DIAS.map((d) => (
                  <button
                    key={d.valor}
                    type="button"
                    onClick={() => toggleDia(d.valor)}
                    className={`rounded-ds-pill border px-ds-3 py-1.5 font-ds-body text-ds-small font-medium transition-colors ${
                      diasSemana.has(d.valor)
                        ? "border-ds-brand bg-ds-brand/[0.08] text-ds-brand"
                        : "border-ds-divider text-ds-text/70 hover:bg-ds-brand/[0.08]"
                    }`}
                  >
                    {d.etiqueta}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid gap-ds-4 sm:grid-cols-2">
              <div className="flex flex-col gap-ds-1">
                <label className="font-ds-body text-ds-caption font-medium text-ds-text/70">Horario de trabajo</label>
                <div className="flex items-center gap-ds-2">
                  <Input tipo="hora" requerido valor={horaInicio} onCambio={setHoraInicio} />
                  <span className="text-ds-text/60">a</span>
                  <Input tipo="hora" requerido valor={horaFin} onCambio={setHoraFin} />
                </div>
              </div>
              <div className="flex flex-col gap-ds-1">
                <label className="font-ds-body text-ds-caption font-medium text-ds-text/70">Intervalo de almuerzo</label>
                <div className="flex items-center gap-ds-2">
                  <Input tipo="hora" valor={almuerzoInicio} onCambio={setAlmuerzoInicio} />
                  <span className="text-ds-text/60">a</span>
                  <Input tipo="hora" valor={almuerzoFin} onCambio={setAlmuerzoFin} />
                </div>
              </div>
            </div>

            {errorRuta ? <p className="font-ds-body text-ds-small text-ds-accent-700">{errorRuta}</p> : null}
            <Button tipo="submit" cargando={creandoRuta}>
              Crear ruta
            </Button>
          </form>
        </Card>
      )}

      {ruta && (
        <>
          {avisoRuta ? (
            <p className="my-ds-4 font-ds-body text-ds-small font-medium text-ds-accent2-800">{avisoRuta}</p>
          ) : null}
          {ruta.advertencias && ruta.advertencias.length > 0 && (
            <div className="my-ds-4 flex flex-col gap-ds-2">
              {ruta.advertencias.map((a, i) => (
                <p key={i} className="font-ds-body text-ds-small font-medium text-ds-accent-700">
                  {a}
                </p>
              ))}
            </div>
          )}

          <div className="my-ds-6">
            <Card>
              <div className="flex flex-wrap items-center justify-between gap-ds-3">
                <div>
                  <p className="font-ds-body text-ds-small text-ds-text/70">
                    {equipo.find((u) => u.id === ruta.responsable_id)?.nombre ?? "—"} · {ruta.fecha_inicio} ·{" "}
                    {ruta.hora_inicio}–{ruta.hora_fin}
                  </p>
                  <p className="font-ds-body text-ds-caption text-ds-text/60">Desde: {ruta.punto_base_direccion}</p>
                </div>
                <StatusBadge estado={ruta.estado} tonoForzado={ruta.estado === "finalizada" ? "completado" : "en_progreso"} />
              </div>
            </Card>
          </div>

          <div className="my-ds-6">
            <Card>
              <div className="mb-ds-4 flex items-center justify-between">
                <p className="flex items-center gap-ds-2 font-ds-body text-ds-small font-semibold text-ds-text">
                  <Plus size={16} strokeWidth={2.75} className="text-ds-brand" />
                  Tareas ({tareas.length})
                </p>
                {!mostrarFormTarea && <Button onPress={() => setMostrarFormTarea(true)}>Nueva tarea</Button>}
              </div>

              {trabajosSinRuta.length > 0 && (
                <div className="mb-ds-4 flex flex-wrap items-end gap-ds-2 rounded-ds-md border border-dashed border-ds-divider p-ds-3">
                  <div className="flex-1">
                    <Select
                      etiqueta="Incluir tarea ya creada"
                      valor={tareaExistenteId}
                      onCambio={setTareaExistenteId}
                      opciones={[
                        { valor: "", etiqueta: "Selecciona un trabajo existente" },
                        ...trabajosSinRuta.map((t) => ({ valor: t.id, etiqueta: `${t.cliente} — ${t.fecha}` })),
                      ]}
                    />
                  </div>
                  <Button variante="secundario" deshabilitado={!tareaExistenteId || incluyendo} cargando={incluyendo} onPress={onIncluirExistente}>
                    Agregar
                  </Button>
                </div>
              )}

              {mostrarFormTarea && (
                <form onSubmit={onCrearTarea} className="mb-ds-6 flex flex-col gap-ds-4 rounded-ds-md border border-ds-divider p-ds-4">
                  <div className="grid gap-ds-4 sm:grid-cols-2">
                    <div className="flex flex-col gap-ds-1 sm:col-span-2">
                      <label className="font-ds-body text-ds-caption font-medium text-ds-text/70">Cliente</label>
                      <ComboboxCliente
                        value={clienteId}
                        onChange={setClienteId}
                        clientes={clientes}
                        onClienteCreado={(c) => setClientes((prev) => [...prev, c])}
                      />
                    </div>

                    <div className="flex flex-col gap-ds-1">
                      <label className="font-ds-body text-ds-caption font-medium text-ds-text/70">Tipo de tarea</label>
                      <SelectCrear<TipoTrabajo>
                        value={tipoTrabajoId}
                        onChange={(id) => { setTipoTrabajoId(id); setDatosDinamicos({}); }}
                        opciones={tiposTrabajo}
                        endpoint="/api/tipos-trabajo"
                        placeholder="Sin tipo específico"
                        etiquetaCrear="+ Crear tipo de tarea"
                        onCreado={(nuevo) => setTiposTrabajo((prev) => [...prev, nuevo])}
                        gestionHref="/dashboard/configuracion/tipos-trabajo"
                        gestionLabel="Configurar tipos de trabajo →"
                      />
                    </div>
                    <Input
                      etiqueta="Duración estimada (min)"
                      iconoIzq={<Clock size={14} strokeWidth={2.75} />}
                      tipo="numero"
                      requerido
                      valor={duracionMin}
                      onCambio={setDuracionMin}
                    />

                    <Input
                      etiqueta="Palabras clave / etiquetas"
                      iconoIzq={<TagIcon size={14} strokeWidth={2.75} />}
                      placeholder="separadas por coma"
                      valor={etiquetas}
                      onCambio={setEtiquetas}
                    />
                    <Select
                      etiqueta="Tipo de check-in"
                      valor={tipoCheckin}
                      onCambio={(v) => setTipoCheckin(v as TipoCheckin)}
                      opciones={TIPOS_CHECKIN.map((t) => ({ valor: t.valor, etiqueta: t.etiqueta }))}
                    />
                    <Select
                      etiqueta="Prioridad"
                      valor={prioridad}
                      onCambio={(v) => setPrioridad(v as Prioridad)}
                      opciones={PRIORIDADES.map((p) => ({ valor: p, etiqueta: p }))}
                    />
                    <Input etiqueta="Código externo (opcional)" valor={codigo} onCambio={setCodigo} />

                    {tipoTrabajoSeleccionado && tipoTrabajoSeleccionado.campos.length > 0 && (
                      <div className="grid gap-ds-3 rounded-ds-md bg-ds-text/[0.04] p-ds-3 sm:col-span-2 sm:grid-cols-2">
                        {tipoTrabajoSeleccionado.campos.map((campo) =>
                          // Input (ds-) no tiene tipo "fecha" (solo lo usan estos campos
                          // dinámicos de tipo_trabajo) — reusa el input date nativo de
                          // más abajo en vez de inventarle una variante puntual al
                          // primitivo compartido.
                          campo.tipo === "fecha" ? (
                            <DatePickerCampo
                              key={campo.clave}
                              etiqueta={campo.etiqueta}
                              valor={datosDinamicos[campo.clave] ?? ""}
                              onCambio={(v) => setDatosDinamicos((prev) => ({ ...prev, [campo.clave]: v }))}
                            />
                          ) : (
                            <Input
                              key={campo.clave}
                              etiqueta={campo.etiqueta}
                              tipo={campo.tipo === "numero" ? "numero" : "texto"}
                              valor={datosDinamicos[campo.clave] ?? ""}
                              onCambio={(v) => setDatosDinamicos((prev) => ({ ...prev, [campo.clave]: v }))}
                            />
                          )
                        )}
                      </div>
                    )}

                    <div className="sm:col-span-2">
                      {/* Textarea (ds-) no tiene `requerido` (Input sí) — la validación
                          real ya la hace onCrearTarea() más arriba antes del fetch. */}
                      <Textarea etiqueta="Descripción de la tarea" filas={2} valor={descripcion} onCambio={setDescripcion} />
                    </div>
                    <Input etiqueta="Email para encuesta de satisfacción (opcional)" tipo="email" valor={encuestaEmail} onCambio={setEncuestaEmail} />
                    <div className="flex flex-col gap-ds-1">
                      <label className="flex items-center gap-1 font-ds-body text-ds-caption font-medium text-ds-text/70">
                        <Paperclip size={14} strokeWidth={2.75} /> Anexos (opcional, máx. 20MB c/u)
                      </label>
                      <input
                        ref={inputAnexosRef}
                        type="file"
                        multiple
                        onChange={(e) => setAnexos(Array.from(e.target.files ?? []))}
                        className="block w-full font-ds-body text-ds-small text-ds-text/70 file:mr-ds-3 file:rounded-ds-pill file:border-0 file:bg-ds-brand/[0.08] file:px-ds-3 file:py-2 file:font-ds-body file:text-ds-small file:font-medium file:text-ds-brand"
                      />
                    </div>
                  </div>

                  {errorTarea ? <p className="font-ds-body text-ds-small text-ds-accent-700">{errorTarea}</p> : null}
                  <div className="flex gap-ds-2">
                    <Button tipo="submit" cargando={guardandoTarea}>
                      Guardar tarea
                    </Button>
                    <Button variante="secundario" onPress={limpiarFormTarea}>
                      Cancelar
                    </Button>
                  </div>
                </form>
              )}

              {tareas.length === 0 ? (
                <p className="font-ds-body text-ds-small text-ds-text/70">Todavía no hay tareas en esta ruta.</p>
              ) : (
                <div className="flex flex-col divide-y divide-ds-divider">
                  {tareas.map((t) => (
                    <div key={t.id} className="flex items-start justify-between gap-ds-3 py-ds-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-ds-2">
                          {t.orden_en_ruta != null && (
                            <span className="inline-flex h-5 w-5 items-center justify-center rounded-ds-pill bg-ds-brand text-xs font-semibold text-ds-brand-foreground">
                              {t.orden_en_ruta + 1}
                            </span>
                          )}
                          <p className="font-ds-body font-medium text-ds-text">{t.cliente}</p>
                          <Tag tono={TONO_PRIORIDAD[t.prioridad]}>{t.prioridad}</Tag>
                        </div>
                        <p className="font-ds-body text-ds-caption text-ds-text/60">{t.descripcion}</p>
                        <p className="font-ds-body text-ds-caption text-ds-text/60">
                          {t.duracion_estimada_min} min
                          {t.hora_estimada_llegada && ` · llega ~${t.hora_estimada_llegada}`}
                          {t.etiquetas.length > 0 && ` · ${t.etiquetas.join(", ")}`}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => onEliminarTarea(t.id)}
                        className="shrink-0 font-ds-body text-ds-caption font-medium text-ds-accent-700 hover:underline"
                      >
                        Eliminar
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>

          <div className="my-ds-6">
            <Card>
              <div className="mb-ds-4 flex flex-wrap items-center justify-between gap-ds-3">
                <p className="flex items-center gap-ds-2 font-ds-body text-ds-small font-semibold text-ds-text">
                  <RouteIcon size={16} strokeWidth={2.75} className="text-ds-brand" />
                  Mapa
                </p>
                <Button onPress={onOptimizar} deshabilitado={optimizando || tareas.length === 0} cargando={optimizando}>
                  Finalizar ruterización
                </Button>
              </div>
              {errorOptimizar ? (
                <p className="mb-ds-3 font-ds-body text-ds-small text-ds-accent-700">{errorOptimizar}</p>
              ) : null}
              <MapaRutas
                paradas={paradas}
                puntoBase={{ direccion: ruta.punto_base_direccion, lat: ruta.punto_base_lat, lng: ruta.punto_base_lng }}
                mostrarLinea={ruta.estado === "finalizada"}
              />
              {ruta.estado === "finalizada" && (
                <p className="mt-ds-3 font-ds-body text-ds-caption text-ds-text/60">
                  Distancia total estimada: {ruta.distancia_total_km ?? "—"} km · Duración total estimada:{" "}
                  {ruta.duracion_total_min ?? "—"} min
                </p>
              )}
            </Card>
          </div>
        </>
      )}
    </DashboardShell>
  );
}

// Input nativo type="date" contra un string YYYY-MM-DD — DatePicker (ds-)
// trabaja con Date, y este formulario mantiene el estado como string
// (se manda tal cual al backend). Envoltorio chico para no duplicar el
// parseo en cada campo de fecha del archivo.
function DatePickerCampo({ etiqueta, valor, onCambio }: { etiqueta: string; valor: string; onCambio: (v: string) => void }) {
  return (
    <div className="flex flex-col gap-ds-1">
      <label className="font-ds-body text-ds-caption font-medium text-ds-text/70">{etiqueta}</label>
      <input
        type="date"
        required
        value={valor}
        onChange={(e) => onCambio(e.target.value)}
        className="h-11 w-full rounded-ds-md border border-ds-divider bg-ds-surface px-ds-3 font-ds-body text-ds-body text-ds-text transition-colors hover:border-ds-text/30 focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ds-brand)]"
      />
    </div>
  );
}
