"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Calendar, Check, Layers, Plus, Wrench } from "lucide-react";
import type { AgendaProConfig, AgendaProHorario, Servicio, TipoPack } from "@bitacora/shared";
import { apiFetch } from "@/lib/api";
import { Button, Card, Input, LoadingState, Select, StatusBadge, Table } from "@bitacora/ui/web";
import { InputMonto } from "@/components/InputMonto";
import { useConfiguracion } from "../ConfiguracionContext";

const DIAS = [
  { valor: 1, etiqueta: "Lunes" },
  { valor: 2, etiqueta: "Martes" },
  { valor: 3, etiqueta: "Miércoles" },
  { valor: 4, etiqueta: "Jueves" },
  { valor: 5, etiqueta: "Viernes" },
  { valor: 6, etiqueta: "Sábado" },
  { valor: 0, etiqueta: "Domingo" },
];

type DiaEditable = { abierto: boolean; hora_inicio: string; hora_fin: string };

function formatoPrecio(precio: number | null) {
  if (precio === null) return "—";
  return precio.toLocaleString("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 });
}

// Catálogo de servicios (ver 88_servicios_y_packs_con_vigencia.sql) —
// nombre, precio de lista y duración sugerida. Se usa para precargar la
// Nueva reserva y para atar un Tipo de pack a un servicio puntual.
function ServiciosCard({ servicios, onCambio }: { servicios: Servicio[] | null; onCambio: () => void }) {
  const { usuario } = useConfiguracion();
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [nombre, setNombre] = useState("");
  const [precio, setPrecio] = useState("");
  const [duracion, setDuracion] = useState(45);
  const [guardando, setGuardando] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  function abrirNuevo() {
    setEditandoId("nuevo");
    setNombre("");
    setPrecio("");
    setDuracion(45);
    setFormError(null);
  }

  function abrirEdicion(s: Servicio) {
    setEditandoId(s.id);
    setNombre(s.nombre);
    setPrecio(s.precio != null ? String(s.precio) : "");
    setDuracion(s.duracion_sugerida_min);
    setFormError(null);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    if (!nombre.trim()) {
      setFormError("Falta nombre");
      return;
    }
    if (!Number.isInteger(duracion) || duracion <= 0) {
      setFormError("La duración debe ser un entero mayor a 0");
      return;
    }
    if (Number(precio) < 0) {
      setFormError("Precio inválido");
      return;
    }
    setGuardando(true);
    const cuerpo = { nombre: nombre.trim(), precio: Number(precio) || 0, duracion_sugerida_min: duracion };
    const res =
      editandoId === "nuevo"
        ? await apiFetch("/api/servicios", { method: "POST", body: JSON.stringify(cuerpo) })
        : await apiFetch(`/api/servicios/${editandoId}`, { method: "PATCH", body: JSON.stringify(cuerpo) });
    setGuardando(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setFormError(body.error ?? "No se pudo guardar");
      return;
    }
    setEditandoId(null);
    setAviso(editandoId === "nuevo" ? "Servicio creado." : "Servicio actualizado.");
    onCambio();
  }

  async function alternarActivo(s: Servicio) {
    setAviso(null);
    const res = await apiFetch(`/api/servicios/${s.id}`, { method: "PATCH", body: JSON.stringify({ activo: !s.activo }) });
    if (!res.ok) {
      setError("No se pudo actualizar el estado");
      return;
    }
    onCambio();
  }

  return (
    <Card>
      <div className="mb-ds-4 flex flex-wrap items-center justify-between gap-ds-3">
        <div>
          <p className="font-ds-body text-ds-small font-semibold text-ds-text">Servicios</p>
          <p className="font-ds-body text-ds-small text-ds-text/70">Lo que ofreces — precio de lista y duración sugerida para Nueva reserva.</p>
        </div>
        {editandoId === null && (
          <Button variante="secundario" onPress={abrirNuevo} iconoIzq={<Plus size={16} strokeWidth={2.75} />}>
            Nuevo servicio
          </Button>
        )}
      </div>

      {editandoId !== null && (
        <form onSubmit={onSubmit} className="mb-ds-4 flex flex-col gap-ds-4 rounded-ds-lg border border-ds-divider p-ds-3">
          <div className="grid gap-ds-4 sm:grid-cols-3">
            <Input etiqueta="Nombre" placeholder="Ej: Manicure" valor={nombre} onCambio={setNombre} />
            <div className="flex flex-col gap-ds-1">
              <label className="font-ds-body text-ds-caption font-medium text-ds-text/70">Precio de lista</label>
              <InputMonto value={precio} onChange={setPrecio} moneda={usuario.empresa.moneda} />
            </div>
            <Input
              etiqueta="Duración sugerida (min)"
              tipo="numero"
              valor={String(duracion)}
              onCambio={(v) => setDuracion(Number(v) || 5)}
            />
          </div>
          {formError ? <p className="font-ds-body text-ds-small text-ds-accent-700">{formError}</p> : null}
          <div className="flex gap-ds-2">
            <div className="self-start">
              <Button tipo="submit" cargando={guardando}>
                {editandoId === "nuevo" ? "Crear" : "Guardar cambios"}
              </Button>
            </div>
            <Button variante="ghost" onPress={() => setEditandoId(null)}>
              Cancelar
            </Button>
          </div>
        </form>
      )}

      {error ? <p className="font-ds-body text-ds-small text-ds-accent-700">{error}</p> : null}
      {aviso ? <p className="font-ds-body text-ds-small font-medium text-ds-accent2-800">{aviso}</p> : null}
      {servicios === null && !error && <LoadingState />}

      {servicios && (
        <Table
          filas={servicios}
          claveFila={(s) => s.id}
          columnas={[
            { encabezado: "Nombre", celda: (s) => <span className="font-medium text-ds-text">{s.nombre}</span> },
            { encabezado: "Precio", celda: (s) => <span className="text-ds-text/60">{formatoPrecio(s.precio)}</span> },
            { encabezado: "Duración sugerida", celda: (s) => <span className="text-ds-text/60">{s.duracion_sugerida_min} min</span> },
            { encabezado: "Estado", celda: (s) => <StatusBadge estado={s.activo ? "activo" : "inactivo"} /> },
          ]}
          acciones={[
            { etiqueta: "Editar", onPress: abrirEdicion, tono: "brand" },
            { etiqueta: (s) => (s.activo ? "Descontinuar" : "Reactivar"), onPress: alternarActivo, tono: "muted" },
          ]}
          vacio={{ icono: <Wrench size={28} strokeWidth={2.75} />, titulo: "Ningún servicio todavía", mensaje: "Crea el primero para poder elegirlo en Nueva reserva." }}
        />
      )}
    </Card>
  );
}

// CATÁLOGO de packs (ver 84_tipos_pack.sql, 88, 90) — la plantilla que
// el negocio define una vez. No tiene saldo: vender un pack crea una
// instancia aparte en paquetes_sesiones con un snapshot de estos valores.
function TiposPackCard({ servicios }: { servicios: Servicio[] | null }) {
  const { usuario } = useConfiguracion();
  const [tipos, setTipos] = useState<TipoPack[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  const [editandoId, setEditandoId] = useState<string | null>(null); // null = form cerrado; "nuevo" = creando
  const [nombre, setNombre] = useState("");
  const [cantidadSesiones, setCantidadSesiones] = useState(5);
  const [precio, setPrecio] = useState("");
  const [servicioId, setServicioId] = useState("");
  const [vigenciaDias, setVigenciaDias] = useState(""); // "" = no vence
  const [guardando, setGuardando] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    const res = await apiFetch("/api/tipos-pack");
    if (!res.ok) {
      setError("No se pudieron cargar los tipos de pack");
      return;
    }
    setTipos(await res.json());
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  function abrirNuevo() {
    setEditandoId("nuevo");
    setNombre("");
    setCantidadSesiones(5);
    setPrecio("");
    setServicioId("");
    setVigenciaDias("");
    setFormError(null);
  }

  function abrirEdicion(t: TipoPack) {
    setEditandoId(t.id);
    setNombre(t.nombre);
    setCantidadSesiones(t.cantidad_sesiones);
    setPrecio(t.precio !== null ? String(t.precio) : "");
    setServicioId(t.servicio_id ?? "");
    setVigenciaDias(t.vigencia_dias !== null ? String(t.vigencia_dias) : "");
    setFormError(null);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    if (!nombre.trim()) {
      setFormError("Falta nombre");
      return;
    }
    if (!Number.isInteger(cantidadSesiones) || cantidadSesiones <= 0) {
      setFormError("La cantidad debe ser un entero mayor a 0");
      return;
    }
    const precioNumero = precio.trim() ? Number(precio) : null;
    if (precioNumero !== null && (Number.isNaN(precioNumero) || precioNumero < 0)) {
      setFormError("Precio inválido");
      return;
    }
    const vigenciaNumero = vigenciaDias.trim() ? Number(vigenciaDias) : null;
    if (vigenciaNumero !== null && (!Number.isInteger(vigenciaNumero) || vigenciaNumero <= 0)) {
      setFormError("La vigencia debe ser un entero de días mayor a 0 (o vacío si el pack no vence)");
      return;
    }
    setGuardando(true);
    const cuerpo = {
      nombre: nombre.trim(),
      cantidad_sesiones: cantidadSesiones,
      precio: precioNumero,
      servicio_id: servicioId || null,
      vigencia_dias: vigenciaNumero,
    };
    const res =
      editandoId === "nuevo"
        ? await apiFetch("/api/tipos-pack", { method: "POST", body: JSON.stringify(cuerpo) })
        : await apiFetch(`/api/tipos-pack/${editandoId}`, { method: "PATCH", body: JSON.stringify(cuerpo) });
    setGuardando(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setFormError(body.error ?? "No se pudo guardar");
      return;
    }
    setEditandoId(null);
    setAviso(editandoId === "nuevo" ? "Tipo de pack creado." : "Tipo de pack actualizado.");
    cargar();
  }

  async function alternarActivo(t: TipoPack) {
    setAviso(null);
    const res = await apiFetch(`/api/tipos-pack/${t.id}`, { method: "PATCH", body: JSON.stringify({ activo: !t.activo }) });
    if (!res.ok) {
      setError("No se pudo actualizar el estado");
      return;
    }
    cargar();
  }

  const nombreServicio = (id: string | null) => servicios?.find((s) => s.id === id)?.nombre ?? "—";

  return (
    <Card>
      <div className="mb-ds-4 flex flex-wrap items-center justify-between gap-ds-3">
        <div>
          <p className="font-ds-body text-ds-small font-semibold text-ds-text">Tipos de pack</p>
          <p className="font-ds-body text-ds-small text-ds-text/70">Plantillas de packs que vendes — evita tipear nombre y cantidad cada vez.</p>
        </div>
        {editandoId === null && (
          <Button variante="secundario" onPress={abrirNuevo} iconoIzq={<Plus size={16} strokeWidth={2.75} />}>
            Nuevo tipo de pack
          </Button>
        )}
      </div>

      {editandoId !== null && (
        <form onSubmit={onSubmit} className="mb-ds-4 flex flex-col gap-ds-4 rounded-ds-lg border border-ds-divider p-ds-3">
          <div className="grid gap-ds-4 sm:grid-cols-3">
            <Input etiqueta="Nombre" placeholder="Ej: Pack 5 sesiones" valor={nombre} onCambio={setNombre} />
            <Input
              etiqueta="Cantidad de sesiones"
              tipo="numero"
              valor={String(cantidadSesiones)}
              onCambio={(v) => setCantidadSesiones(Number(v) || 1)}
            />
            <div className="flex flex-col gap-ds-1">
              <label className="font-ds-body text-ds-caption font-medium text-ds-text/70">Precio total (recomendado)</label>
              <InputMonto placeholder="45000" value={precio} onChange={setPrecio} moneda={usuario.empresa.moneda} />
            </div>
            <Select
              etiqueta="Servicio al que aplica (opcional)"
              valor={servicioId}
              onCambio={setServicioId}
              placeholder="Cualquier servicio"
              opciones={(servicios ?? []).map((s) => ({ valor: s.id, etiqueta: s.nombre }))}
            />
            <Input
              etiqueta="Vigencia en días (opcional)"
              tipo="numero"
              placeholder="Vacío = no vence"
              valor={vigenciaDias}
              onCambio={setVigenciaDias}
            />
          </div>
          {formError ? <p className="font-ds-body text-ds-small text-ds-accent-700">{formError}</p> : null}
          <div className="flex gap-ds-2">
            <div className="self-start">
              <Button tipo="submit" cargando={guardando}>
                {editandoId === "nuevo" ? "Crear" : "Guardar cambios"}
              </Button>
            </div>
            <Button variante="ghost" onPress={() => setEditandoId(null)}>
              Cancelar
            </Button>
          </div>
        </form>
      )}

      {error ? <p className="font-ds-body text-ds-small text-ds-accent-700">{error}</p> : null}
      {aviso ? <p className="font-ds-body text-ds-small font-medium text-ds-accent2-800">{aviso}</p> : null}
      {tipos === null && !error && <LoadingState />}

      {tipos && (
        <Table
          filas={tipos}
          claveFila={(t) => t.id}
          columnas={[
            { encabezado: "Nombre", celda: (t) => <span className="font-medium text-ds-text">{t.nombre}</span> },
            { encabezado: "Sesiones", celda: (t) => <span className="text-ds-text">{t.cantidad_sesiones}</span> },
            { encabezado: "Precio", celda: (t) => <span className="text-ds-text/60">{formatoPrecio(t.precio)}</span> },
            { encabezado: "Servicio", celda: (t) => <span className="text-ds-text/60">{nombreServicio(t.servicio_id)}</span> },
            { encabezado: "Vigencia", celda: (t) => <span className="text-ds-text/60">{t.vigencia_dias !== null ? `${t.vigencia_dias} días` : "No vence"}</span> },
            { encabezado: "Estado", celda: (t) => <StatusBadge estado={t.activo ? "activo" : "inactivo"} /> },
          ]}
          acciones={[
            { etiqueta: "Editar", onPress: abrirEdicion, tono: "brand" },
            { etiqueta: (t) => (t.activo ? "Descontinuar" : "Reactivar"), onPress: alternarActivo, tono: "muted" },
          ]}
          vacio={{ icono: <Layers size={28} strokeWidth={2.75} />, titulo: "Ningún tipo de pack todavía", mensaje: "Crea el primero para reutilizarlo al vender paquetes." }}
        />
      )}
    </Card>
  );
}

// PASO 6 (sistema de diseño) — migrado. Ver docs/design-system.md.
export default function AgendaProConfigPage() {
  const { usuario } = useConfiguracion();
  const [config, setConfig] = useState<AgendaProConfig | null>(null);
  const [dias, setDias] = useState<Record<number, DiaEditable>>({});
  const [servicios, setServicios] = useState<Servicio[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [copiado, setCopiado] = useState(false);

  const cargarServicios = useCallback(async () => {
    const res = await apiFetch("/api/servicios");
    if (res.ok) setServicios(await res.json());
  }, []);

  useEffect(() => {
    cargarServicios();
  }, [cargarServicios]);

  const cargar = useCallback(async () => {
    setError(null);
    const res = await apiFetch("/api/agenda-pro/config");
    if (!res.ok) {
      setError("No se pudo cargar la configuración");
      return;
    }
    const body: { config: AgendaProConfig; horarios: AgendaProHorario[] } = await res.json();
    setConfig(body.config);
    const porDia: Record<number, DiaEditable> = {};
    for (const d of DIAS) porDia[d.valor] = { abierto: false, hora_inicio: "09:00", hora_fin: "18:00" };
    for (const h of body.horarios) {
      porDia[h.dia_semana] = { abierto: true, hora_inicio: h.hora_inicio.slice(0, 5), hora_fin: h.hora_fin.slice(0, 5) };
    }
    setDias(porDia);
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  function actualizarDia(dia: number, cambios: Partial<DiaEditable>) {
    setDias((prev) => ({ ...prev, [dia]: { ...prev[dia], ...cambios } }));
  }

  async function onGuardar() {
    if (!config) return;
    setError(null);
    setAviso(null);
    for (const d of DIAS) {
      const info = dias[d.valor];
      if (info.abierto && info.hora_fin <= info.hora_inicio) {
        setError(`En ${d.etiqueta}, la hora de término debe ser posterior a la de inicio`);
        return;
      }
    }
    setGuardando(true);
    const [resConfig, resHorarios] = await Promise.all([
      apiFetch("/api/agenda-pro/config", {
        method: "PATCH",
        body: JSON.stringify({
          duracion_slot_min: config.duracion_slot_min,
          anticipacion_min_horas: config.anticipacion_min_horas,
          dias_max_adelante: config.dias_max_adelante,
          ventana_cancelacion_horas: config.ventana_cancelacion_horas,
        }),
      }),
      apiFetch("/api/agenda-pro/config/horarios", {
        method: "PUT",
        body: JSON.stringify({
          horarios: DIAS.filter((d) => dias[d.valor]?.abierto).map((d) => ({
            dia_semana: d.valor,
            hora_inicio: dias[d.valor].hora_inicio,
            hora_fin: dias[d.valor].hora_fin,
          })),
        }),
      }),
    ]);
    setGuardando(false);
    if (!resConfig.ok || !resHorarios.ok) {
      setError("No se pudo guardar");
      return;
    }
    setAviso("Configuración guardada");
  }

  function copiarLink() {
    const link = `${window.location.origin}/agendar/${usuario.empresa_id}`;
    navigator.clipboard.writeText(link).then(() => {
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    });
  }

  if (!config) {
    return (
      <div className="flex flex-col gap-ds-6">
        <div>
          <p className="ds-heading text-ds-h3 text-ds-text">Reserva online</p>
          <p className="mt-ds-1 font-ds-body text-ds-small text-ds-text/70">Horario de atención para que tus clientes agenden solos</p>
        </div>
        {error ? <p className="font-ds-body text-ds-small text-ds-accent-700">{error}</p> : <LoadingState />}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-ds-6">
      <div>
        <p className="ds-heading text-ds-h3 text-ds-text">Reserva online</p>
        <p className="mt-ds-1 font-ds-body text-ds-small text-ds-text/70">Horario de atención para que tus clientes agenden solos — Agenda Pro</p>
      </div>

      <Card>
        <div className="flex flex-col gap-ds-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-medium text-ds-text">Tu link de reserva</p>
            <p className="font-ds-body text-ds-small text-ds-text/70">Compártelo por WhatsApp, redes o en tu sitio.</p>
          </div>
          <Button
            variante="secundario"
            onPress={copiarLink}
            iconoIzq={copiado ? <Check size={16} strokeWidth={2.75} /> : <Calendar size={16} strokeWidth={2.75} />}
          >
            {copiado ? "Copiado" : "Copiar mi link de reserva"}
          </Button>
        </div>
      </Card>

      <Card>
        <p className="mb-ds-4 font-ds-body text-ds-small font-semibold text-ds-text">Horario de atención</p>
        <div className="flex flex-col gap-ds-2">
          {DIAS.map((d) => {
            const info = dias[d.valor];
            if (!info) return null;
            return (
              <div key={d.valor} className="flex flex-wrap items-center gap-ds-3 rounded-ds-lg border border-ds-divider px-ds-3 py-2">
                <label className="flex w-32 items-center gap-2 font-ds-body text-ds-small font-medium text-ds-text">
                  <input
                    type="checkbox"
                    checked={info.abierto}
                    onChange={(e) => actualizarDia(d.valor, { abierto: e.target.checked })}
                    className="accent-[var(--ds-brand)]"
                  />
                  {d.etiqueta}
                </label>
                {info.abierto && (
                  <div className="flex items-center gap-ds-2">
                    <div className="w-32">
                      <Input tipo="hora" valor={info.hora_inicio} onCambio={(v) => actualizarDia(d.valor, { hora_inicio: v })} />
                    </div>
                    <span className="font-ds-body text-ds-small text-ds-text/70">a</span>
                    <div className="w-32">
                      <Input tipo="hora" valor={info.hora_fin} onCambio={(v) => actualizarDia(d.valor, { hora_fin: v })} />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </Card>

      <ServiciosCard servicios={servicios} onCambio={cargarServicios} />

      <TiposPackCard servicios={servicios} />

      <Card>
        <p className="mb-ds-4 font-ds-body text-ds-small font-semibold text-ds-text">Reglas de la reserva</p>
        <div className="grid gap-ds-4 sm:grid-cols-3">
          <Input
            etiqueta="Duración de cada cita (min)"
            tipo="numero"
            valor={String(config.duracion_slot_min)}
            onCambio={(v) => setConfig((prev) => (prev ? { ...prev, duracion_slot_min: Number(v) || 5 } : prev))}
          />
          <Input
            etiqueta="Anticipación mínima (horas)"
            tipo="numero"
            valor={String(config.anticipacion_min_horas)}
            onCambio={(v) => setConfig((prev) => (prev ? { ...prev, anticipacion_min_horas: Number(v) || 0 } : prev))}
          />
          <Input
            etiqueta="Días máximos de anticipación"
            tipo="numero"
            valor={String(config.dias_max_adelante)}
            onCambio={(v) => setConfig((prev) => (prev ? { ...prev, dias_max_adelante: Number(v) || 1 } : prev))}
          />
        </div>
      </Card>

      <Card>
        <p className="mb-ds-1 font-ds-body text-ds-small font-semibold text-ds-text">Cancelación de sesiones de paquetes</p>
        <p className="mb-ds-4 font-ds-body text-ds-small text-ds-text/70">Aplica solo a citas asociadas a un paquete de sesiones.</p>
        <div className="max-w-xs">
          <Input
            etiqueta="Horas de anticipación para cancelar sin costo"
            tipo="numero"
            valor={String(config.ventana_cancelacion_horas)}
            onCambio={(v) => setConfig((prev) => (prev ? { ...prev, ventana_cancelacion_horas: Number(v) || 0 } : prev))}
            ayuda="Si la clienta cancela con menos anticipación que este valor, la sesión se descuenta igual del paquete."
          />
        </div>
      </Card>

      {error ? <p className="font-ds-body text-ds-small text-ds-accent-700">{error}</p> : null}
      {aviso ? <p className="font-ds-body text-ds-small font-medium text-ds-accent2-800">{aviso}</p> : null}
      <div className="self-start">
        <Button onPress={onGuardar} cargando={guardando}>
          Guardar cambios
        </Button>
      </div>
    </div>
  );
}
