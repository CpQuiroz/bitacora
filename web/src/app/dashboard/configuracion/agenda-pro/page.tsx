"use client";

import { useCallback, useEffect, useState } from "react";
import type { AgendaProConfig, AgendaProHorario } from "@bitacora/shared";
import { apiFetch } from "@/lib/api";
import { Button, Card, ErrorText, Input, Label, PageHeader, SuccessText } from "@/components/ui";
import { IconCalendar, IconCheck } from "@/components/icons";
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
        {error ? <ErrorText>{error}</ErrorText> : <p className="text-sm text-muted">Cargando…</p>}
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
