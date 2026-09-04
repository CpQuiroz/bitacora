"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import type { AgendaProConfig, AgendaProHorario, TipoPack } from "@bitacora/shared";
import { apiFetch } from "@/lib/api";
import { Badge, Button, Card, ErrorText, Input, Label, PageHeader, SuccessText } from "@/components/ui";
import { IconCalendar, IconCheck, IconLayers, IconPlus } from "@/components/icons";
import { EstadoCargando, EstadoVacio } from "@/components/estados";
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

// Catálogo reutilizable de "tipos de pack" (ver 84_tipos_pack.sql) — se
// vende como plantilla al crear un paquete de sesiones a un cliente, tanto
// desde Paquetes de sesiones (web) como desde Nueva cita (móvil).
function TiposPackCard() {
  const [tipos, setTipos] = useState<TipoPack[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  const [editandoId, setEditandoId] = useState<string | null>(null); // null = form cerrado; "nuevo" = creando
  const [nombre, setNombre] = useState("");
  const [cantidadSesiones, setCantidadSesiones] = useState(5);
  const [precio, setPrecio] = useState("");
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
    setFormError(null);
  }

  function abrirEdicion(t: TipoPack) {
    setEditandoId(t.id);
    setNombre(t.nombre);
    setCantidadSesiones(t.cantidad_sesiones);
    setPrecio(t.precio !== null ? String(t.precio) : "");
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
    setGuardando(true);
    const cuerpo = { nombre: nombre.trim(), cantidad_sesiones: cantidadSesiones, precio: precioNumero };
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

  return (
    <Card>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Tipos de pack</h2>
          <p className="text-sm text-muted">Plantillas de packs que vendes — evita tipear nombre y cantidad cada vez.</p>
        </div>
        {editandoId === null && (
          <Button type="button" variant="outline" onClick={abrirNuevo}>
            <IconPlus className="h-4 w-4" />
            Nuevo tipo de pack
          </Button>
        )}
      </div>

      {editandoId !== null && (
        <form onSubmit={onSubmit} className="mb-4 flex flex-col gap-4 rounded-lg border border-border p-3">
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <Label>Nombre</Label>
              <Input type="text" placeholder="Ej: Pack 5 sesiones" value={nombre} onChange={(e) => setNombre(e.target.value)} />
            </div>
            <div>
              <Label>Cantidad de sesiones</Label>
              <Input
                type="number"
                min={1}
                value={cantidadSesiones}
                onChange={(e) => setCantidadSesiones(Number(e.target.value) || 1)}
              />
            </div>
            <div>
              <Label>Precio (opcional)</Label>
              <Input type="number" min={0} placeholder="45000" value={precio} onChange={(e) => setPrecio(e.target.value)} />
            </div>
          </div>
          {formError && <ErrorText>{formError}</ErrorText>}
          <div className="flex gap-2">
            <Button type="submit" disabled={guardando} className="self-start">
              {guardando ? "Guardando…" : editandoId === "nuevo" ? "Crear" : "Guardar cambios"}
            </Button>
            <Button type="button" variant="ghost" onClick={() => setEditandoId(null)}>
              Cancelar
            </Button>
          </div>
        </form>
      )}

      {error && <ErrorText>{error}</ErrorText>}
      {aviso && <SuccessText>{aviso}</SuccessText>}
      {tipos === null && !error && <EstadoCargando />}
      {tipos?.length === 0 && (
        <EstadoVacio icono={IconLayers} titulo="Ningún tipo de pack todavía" mensaje="Crea el primero para reutilizarlo al vender paquetes." />
      )}

      {tipos && tipos.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border bg-surface-sunken font-mono text-[10px] uppercase tracking-[0.1em] text-muted">
                <th className="px-3 py-2 font-medium">Nombre</th>
                <th className="px-3 py-2 font-medium">Sesiones</th>
                <th className="px-3 py-2 font-medium">Precio</th>
                <th className="px-3 py-2 font-medium">Estado</th>
                <th className="px-3 py-2 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {tipos.map((t) => (
                <tr key={t.id} className="border-b border-border-soft last:border-0">
                  <td className="px-3 py-2 font-medium text-foreground">{t.nombre}</td>
                  <td className="px-3 py-2 text-foreground">{t.cantidad_sesiones}</td>
                  <td className="px-3 py-2 text-muted">{formatoPrecio(t.precio)}</td>
                  <td className="px-3 py-2">
                    <Badge value={t.activo ? "activo" : "inactivo"} />
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex justify-end gap-2">
                      <Button type="button" variant="ghost" onClick={() => abrirEdicion(t)}>
                        Editar
                      </Button>
                      <Button type="button" variant="ghost" onClick={() => alternarActivo(t)}>
                        {t.activo ? "Descontinuar" : "Reactivar"}
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

export default function AgendaProConfigPage() {
  const { usuario } = useConfiguracion();
  const [config, setConfig] = useState<AgendaProConfig | null>(null);
  const [dias, setDias] = useState<Record<number, DiaEditable>>({});
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [copiado, setCopiado] = useState(false);

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
      <div className="flex flex-col gap-6">
        <PageHeader title="Reserva online" subtitle="Horario de atención para que tus clientes agenden solos" />
        {error ? <ErrorText>{error}</ErrorText> : <EstadoCargando />}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Reserva online" subtitle="Horario de atención para que tus clientes agenden solos — Agenda Pro" />

      <Card>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-medium text-foreground">Tu link de reserva</p>
            <p className="text-sm text-muted">Compártelo por WhatsApp, redes o en tu sitio.</p>
          </div>
          <Button type="button" variant="outline" onClick={copiarLink}>
            {copiado ? (
              <>
                <IconCheck className="h-4 w-4" /> Copiado
              </>
            ) : (
              <>
                <IconCalendar className="h-4 w-4" /> Copiar mi link de reserva
              </>
            )}
          </Button>
        </div>
      </Card>

      <Card>
        <h2 className="mb-4 text-sm font-semibold text-foreground">Horario de atención</h2>
        <div className="flex flex-col gap-2">
          {DIAS.map((d) => {
            const info = dias[d.valor];
            if (!info) return null;
            return (
              <div key={d.valor} className="flex flex-wrap items-center gap-3 rounded-lg border border-border px-3 py-2">
                <label className="flex w-32 items-center gap-2 text-sm font-medium text-foreground">
                  <input
                    type="checkbox"
                    checked={info.abierto}
                    onChange={(e) => actualizarDia(d.valor, { abierto: e.target.checked })}
                    className="accent-brand"
                  />
                  {d.etiqueta}
                </label>
                {info.abierto && (
                  <div className="flex items-center gap-2">
                    <Input
                      type="time"
                      value={info.hora_inicio}
                      onChange={(e) => actualizarDia(d.valor, { hora_inicio: e.target.value })}
                      className="w-32"
                    />
                    <span className="text-sm text-muted">a</span>
                    <Input
                      type="time"
                      value={info.hora_fin}
                      onChange={(e) => actualizarDia(d.valor, { hora_fin: e.target.value })}
                      className="w-32"
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </Card>

      <TiposPackCard />

      <Card>
        <h2 className="mb-4 text-sm font-semibold text-foreground">Reglas de la reserva</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <Label>Duración de cada cita (min)</Label>
            <Input
              type="number"
              min={5}
              value={config.duracion_slot_min}
              onChange={(e) => setConfig((prev) => (prev ? { ...prev, duracion_slot_min: Number(e.target.value) || 5 } : prev))}
            />
          </div>
          <div>
            <Label>Anticipación mínima (horas)</Label>
            <Input
              type="number"
              min={0}
              value={config.anticipacion_min_horas}
              onChange={(e) => setConfig((prev) => (prev ? { ...prev, anticipacion_min_horas: Number(e.target.value) || 0 } : prev))}
            />
          </div>
          <div>
            <Label>Días máximos de anticipación</Label>
            <Input
              type="number"
              min={1}
              value={config.dias_max_adelante}
              onChange={(e) => setConfig((prev) => (prev ? { ...prev, dias_max_adelante: Number(e.target.value) || 1 } : prev))}
            />
          </div>
        </div>
      </Card>

      <Card>
        <h2 className="mb-1 text-sm font-semibold text-foreground">Cancelación de sesiones de paquetes</h2>
        <p className="mb-4 text-sm text-muted">Aplica solo a citas asociadas a un paquete de sesiones.</p>
        <div className="max-w-xs">
          <Label>Horas de anticipación para cancelar sin costo</Label>
          <Input
            type="number"
            min={0}
            value={config.ventana_cancelacion_horas}
            onChange={(e) =>
              setConfig((prev) => (prev ? { ...prev, ventana_cancelacion_horas: Number(e.target.value) || 0 } : prev))
            }
          />
          <p className="mt-1 text-xs text-muted">
            Si la clienta cancela con menos anticipación que este valor, la sesión se descuenta igual del paquete.
          </p>
        </div>
      </Card>

      {error && <ErrorText>{error}</ErrorText>}
      {aviso && <SuccessText>{aviso}</SuccessText>}
      <Button type="button" onClick={onGuardar} disabled={guardando} className="self-start">
        {guardando ? "Guardando…" : "Guardar cambios"}
      </Button>
    </div>
  );
}
