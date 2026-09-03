"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
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
import {
  Badge,
  Button,
  Card,
  ErrorText,
  Input,
  Label,
  PageHeader,
  Select,
  SuccessText,
  Textarea,
  WarningText,
} from "@/components/ui";
import { ComboboxCliente } from "@/components/ComboboxCliente";
import { ComboboxResponsable } from "@/components/ComboboxResponsable";
import { SelectCrear } from "@/components/SelectCrear";
import { IconClock, IconPaperclip, IconPlus, IconRoute, IconTag } from "@/components/icons";
import { MapaRutas, type Parada } from "@/components/MapaRutas";

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
      <PageHeader
        title="Nueva ruta de trabajo"
        subtitle="Planifica la jornada de un colaborador y optimiza el orden de visita"
      />

      {!ruta && (
        <Card className="my-6">
          <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-foreground">
            <IconRoute className="h-4 w-4 text-brand" />
            Datos de la ruta
          </h2>
          <form onSubmit={onCrearRuta} className="flex flex-col gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label>Colaborador</Label>
                <ComboboxResponsable
                  value={responsableId}
                  onChange={setResponsableId}
                  equipo={equipo}
                  placeholder="Selecciona un colaborador"
                />
                <p className="mt-1 text-xs text-muted">
                  {vehiculoDelResponsable
                    ? `Vehículo asignado: ${vehiculoDelResponsable.patente ?? vehiculoDelResponsable.nombre}`
                    : "Sin vehículo asignado"}
                </p>
              </div>
              <div>
                <Label>Fecha de la primera tarea</Label>
                <Input type="date" required value={fechaInicio} onChange={(e) => setFechaInicio(e.target.value)} />
              </div>
              <div className="sm:col-span-2">
                <Label>Punto base / origen de la ruta</Label>
                <Input
                  type="text"
                  required
                  placeholder="Dirección — se ubica sola en el mapa"
                  value={puntoBase}
                  onChange={(e) => setPuntoBase(e.target.value)}
                />
              </div>
            </div>

            <div>
              <Label>Jornada de trabajo (días)</Label>
              <div className="flex flex-wrap gap-2">
                {DIAS.map((d) => (
                  <button
                    key={d.valor}
                    type="button"
                    onClick={() => toggleDia(d.valor)}
                    className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${
                      diasSemana.has(d.valor)
                        ? "border-brand bg-brand-soft text-brand"
                        : "border-border text-muted hover:bg-brand-soft"
                    }`}
                  >
                    {d.etiqueta}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label>Horario de trabajo</Label>
                <div className="flex items-center gap-2">
                  <Input type="time" required value={horaInicio} onChange={(e) => setHoraInicio(e.target.value)} />
                  <span className="text-muted">a</span>
                  <Input type="time" required value={horaFin} onChange={(e) => setHoraFin(e.target.value)} />
                </div>
              </div>
              <div>
                <Label>Intervalo de almuerzo</Label>
                <div className="flex items-center gap-2">
                  <Input type="time" value={almuerzoInicio} onChange={(e) => setAlmuerzoInicio(e.target.value)} />
                  <span className="text-muted">a</span>
                  <Input type="time" value={almuerzoFin} onChange={(e) => setAlmuerzoFin(e.target.value)} />
                </div>
              </div>
            </div>

            {errorRuta && <ErrorText>{errorRuta}</ErrorText>}
            <Button type="submit" disabled={creandoRuta} className="self-start">
              {creandoRuta ? "Creando…" : "Crear ruta"}
            </Button>
          </form>
        </Card>
      )}

      {ruta && (
        <>
          {avisoRuta && (
            <div className="my-4">
              <SuccessText>{avisoRuta}</SuccessText>
            </div>
          )}
          {ruta.advertencias && ruta.advertencias.length > 0 && (
            <div className="my-4 flex flex-col gap-2">
              {ruta.advertencias.map((a, i) => (
                <WarningText key={i}>{a}</WarningText>
              ))}
            </div>
          )}

          <Card className="my-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm text-muted">
                  {equipo.find((u) => u.id === ruta.responsable_id)?.nombre ?? "—"} · {ruta.fecha_inicio} ·{" "}
                  {ruta.hora_inicio}–{ruta.hora_fin}
                </p>
                <p className="text-xs text-muted">Desde: {ruta.punto_base_direccion}</p>
              </div>
              <Badge value={ruta.estado} />
            </div>
          </Card>

          <Card className="my-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <IconPlus className="h-4 w-4 text-brand" />
                Tareas ({tareas.length})
              </h2>
              {!mostrarFormTarea && (
                <Button type="button" onClick={() => setMostrarFormTarea(true)}>
                  Nueva tarea
                </Button>
              )}
            </div>

            {trabajosSinRuta.length > 0 && (
              <div className="mb-4 flex flex-wrap items-end gap-2 rounded-lg border border-dashed border-border p-3">
                <div className="flex-1">
                  <Label>Incluir tarea ya creada</Label>
                  <Select value={tareaExistenteId} onChange={(e) => setTareaExistenteId(e.target.value)}>
                    <option value="">Selecciona un trabajo existente</option>
                    {trabajosSinRuta.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.cliente} — {t.fecha}
                      </option>
                    ))}
                  </Select>
                </div>
                <Button type="button" variant="outline" disabled={!tareaExistenteId || incluyendo} onClick={onIncluirExistente}>
                  {incluyendo ? "Agregando…" : "Agregar"}
                </Button>
              </div>
            )}

            {mostrarFormTarea && (
              <form onSubmit={onCrearTarea} className="mb-6 flex flex-col gap-4 rounded-lg border border-border p-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <Label>Cliente</Label>
                    <ComboboxCliente
                      value={clienteId}
                      onChange={setClienteId}
                      clientes={clientes}
                      onClienteCreado={(c) => setClientes((prev) => [...prev, c])}
                    />
                  </div>

                  <div>
                    <Label>Tipo de tarea</Label>
                    <SelectCrear<TipoTrabajo>
                      value={tipoTrabajoId}
                      onChange={(id) => { setTipoTrabajoId(id); setDatosDinamicos({}); }}
                      opciones={tiposTrabajo}
                      endpoint="/api/tipos-trabajo"
                      placeholder="Sin tipo específico"
                      etiquetaCrear="+ Nuevo tipo de tarea…"
                      onCreado={(nuevo) => setTiposTrabajo((prev) => [...prev, nuevo])}
                      gestionHref="/dashboard/configuracion/tipos-trabajo"
                      gestionLabel="Configurar tipos de trabajo →"
                    />
                  </div>
                  <div>
                    <Label className="flex items-center gap-1">
                      <IconClock className="h-3.5 w-3.5" /> Duración estimada (min)
                    </Label>
                    <Input type="number" min="1" required value={duracionMin} onChange={(e) => setDuracionMin(e.target.value)} />
                  </div>

                  <div>
                    <Label className="flex items-center gap-1">
                      <IconTag className="h-3.5 w-3.5" /> Palabras clave / etiquetas
                    </Label>
                    <Input
                      type="text"
                      placeholder="separadas por coma"
                      value={etiquetas}
                      onChange={(e) => setEtiquetas(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label>Tipo de check-in</Label>
                    <Select value={tipoCheckin} onChange={(e) => setTipoCheckin(e.target.value as TipoCheckin)}>
                      {TIPOS_CHECKIN.map((t) => (
                        <option key={t.valor} value={t.valor}>
                          {t.etiqueta}
                        </option>
                      ))}
                    </Select>
                  </div>
                  <div>
                    <Label>Prioridad</Label>
                    <Select value={prioridad} onChange={(e) => setPrioridad(e.target.value as Prioridad)}>
                      {PRIORIDADES.map((p) => (
                        <option key={p} value={p}>
                          {p}
                        </option>
                      ))}
                    </Select>
                  </div>
                  <div>
                    <Label>Código externo (opcional)</Label>
                    <Input type="text" value={codigo} onChange={(e) => setCodigo(e.target.value)} />
                  </div>

                  {tipoTrabajoSeleccionado && tipoTrabajoSeleccionado.campos.length > 0 && (
                    <div className="sm:col-span-2 grid gap-3 rounded-lg bg-brand-soft/40 p-3 sm:grid-cols-2">
                      {tipoTrabajoSeleccionado.campos.map((campo) => (
                        <div key={campo.clave}>
                          <Label>{campo.etiqueta}</Label>
                          <Input
                            type={campo.tipo === "numero" ? "number" : campo.tipo === "fecha" ? "date" : "text"}
                            value={datosDinamicos[campo.clave] ?? ""}
                            onChange={(e) => setDatosDinamicos((prev) => ({ ...prev, [campo.clave]: e.target.value }))}
                          />
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="sm:col-span-2">
                    <Label>Descripción de la tarea</Label>
                    <Textarea rows={2} required value={descripcion} onChange={(e) => setDescripcion(e.target.value)} />
                  </div>
                  <div>
                    <Label>Email para encuesta de satisfacción (opcional)</Label>
                    <Input type="email" value={encuestaEmail} onChange={(e) => setEncuestaEmail(e.target.value)} />
                  </div>
                  <div>
                    <Label className="flex items-center gap-1">
                      <IconPaperclip className="h-3.5 w-3.5" /> Anexos (opcional, máx. 20MB c/u)
                    </Label>
                    <input
                      ref={inputAnexosRef}
                      type="file"
                      multiple
                      onChange={(e) => setAnexos(Array.from(e.target.files ?? []))}
                      className="block w-full text-sm text-muted file:mr-3 file:rounded-lg file:border-0 file:bg-brand-soft file:px-3 file:py-2 file:text-sm file:font-medium file:text-brand"
                    />
                  </div>
                </div>

                {errorTarea && <ErrorText>{errorTarea}</ErrorText>}
                <div className="flex gap-2">
                  <Button type="submit" disabled={guardandoTarea}>
                    {guardandoTarea ? "Guardando…" : "Guardar tarea"}
                  </Button>
                  <Button type="button" variant="outline" onClick={limpiarFormTarea}>
                    Cancelar
                  </Button>
                </div>
              </form>
            )}

            {tareas.length === 0 ? (
              <p className="text-sm text-muted">Todavía no hay tareas en esta ruta.</p>
            ) : (
              <div className="flex flex-col divide-y divide-border">
                {tareas.map((t) => (
                  <div key={t.id} className="flex items-start justify-between gap-3 py-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        {t.orden_en_ruta != null && (
                          <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-brand text-xs font-semibold text-brand-foreground">
                            {t.orden_en_ruta + 1}
                          </span>
                        )}
                        <p className="font-medium text-foreground">{t.cliente}</p>
                        <Badge value={t.prioridad} />
                      </div>
                      <p className="text-xs text-muted">{t.descripcion}</p>
                      <p className="text-xs text-muted">
                        {t.duracion_estimada_min} min
                        {t.hora_estimada_llegada && ` · llega ~${t.hora_estimada_llegada}`}
                        {t.etiquetas.length > 0 && ` · ${t.etiquetas.join(", ")}`}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => onEliminarTarea(t.id)}
                      className="shrink-0 text-xs font-medium text-danger hover:underline"
                    >
                      Eliminar
                    </button>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card className="my-6">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <IconRoute className="h-4 w-4 text-brand" />
                Mapa
              </h2>
              <Button type="button" onClick={onOptimizar} disabled={optimizando || tareas.length === 0}>
                {optimizando ? "Calculando…" : "Finalizar ruterización"}
              </Button>
            </div>
            {errorOptimizar && (
              <div className="mb-3">
                <ErrorText>{errorOptimizar}</ErrorText>
              </div>
            )}
            <MapaRutas
              paradas={paradas}
              puntoBase={{ direccion: ruta.punto_base_direccion, lat: ruta.punto_base_lat, lng: ruta.punto_base_lng }}
              mostrarLinea={ruta.estado === "finalizada"}
            />
            {ruta.estado === "finalizada" && (
              <p className="mt-3 text-xs text-muted">
                Distancia total estimada: {ruta.distancia_total_km ?? "—"} km · Duración total estimada:{" "}
                {ruta.duracion_total_min ?? "—"} min
              </p>
            )}
          </Card>
        </>
      )}
    </DashboardShell>
  );
}
