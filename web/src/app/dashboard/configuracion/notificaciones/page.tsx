"use client";

import { useCallback, useEffect, useState } from "react";
import type { MensajePersonalizado, NotificacionClienteLog, NotificacionesConfig, TipoMensajePersonalizado } from "@bitacora/shared";
import { apiFetch } from "@/lib/api";
import { Badge, Button, Card, ErrorText, Input, Label, PageHeader, SuccessText, Textarea } from "@/components/ui";
import { DataTable } from "@/components/DataTable";
import { IconChat, IconClock, IconMail } from "@/components/icons";

type Tab = "correo" | "whatsapp" | "recordatorios" | "historial";

// Estos son los switches que de verdad disparan un correo al CLIENTE
// (a diferencia de cotizacion_creada/aprobada/rechazada y
// cobranza_recibida, que hoy son solo config sin ningún envío real
// detrás — quedan igual, no se tocan en este cambio).
const TOGGLES: { grupo: string; items: { campo: keyof NotificacionesConfig; etiqueta: string }[] }[] = [
  {
    grupo: "Cotizaciones",
    items: [
      { campo: "cotizacion_creada", etiqueta: "Nueva cotización creada" },
      { campo: "cotizacion_enviada", etiqueta: "Cotización enviada (con PDF)" },
      { campo: "cotizacion_aprobada", etiqueta: "Aprobada por el cliente" },
      { campo: "cotizacion_rechazada", etiqueta: "Rechazada por el cliente" },
    ],
  },
  {
    grupo: "Órdenes de Trabajo/Servicio",
    items: [
      { campo: "os_creada", etiqueta: "Nueva OS creada" },
      { campo: "tecnico_en_camino", etiqueta: "Técnico en camino (al hacer Check-in)" },
      { campo: "os_completada", etiqueta: "OS completada y firmada (con PDF)" },
    ],
  },
  {
    grupo: "Cobranzas",
    items: [
      { campo: "cobranza_recibida", etiqueta: "Pago recibido" },
      { campo: "cobro_pendiente", etiqueta: "Cobro pendiente (antes de vencer)" },
      { campo: "cobranza_atrasada", etiqueta: "Cobro vencido" },
    ],
  },
  {
    grupo: "Agenda Pro",
    items: [{ campo: "cita_agendada", etiqueta: "Nueva cita agendada (con link para confirmar o cancelar)" }],
  },
];

const TIPOS_MENSAJE: { valor: TipoMensajePersonalizado; etiqueta: string; variables: string }[] = [
  { valor: "cotizacion", etiqueta: "Cotizaciones", variables: "{cliente}, {fecha}, {monto}, {empresa}" },
  { valor: "orden_servicio", etiqueta: "Órdenes de Trabajo/Servicio", variables: "{cliente}, {empresa}, {tecnico}" },
  { valor: "tecnico_en_camino", etiqueta: "Técnico en camino", variables: "{cliente}, {tecnico}, {empresa}" },
  { valor: "cobranza", etiqueta: "Cobranzas", variables: "{cliente}, {fecha}, {monto}, {empresa}" },
  { valor: "cita_agendada", etiqueta: "Agenda Pro", variables: "{cliente}, {fecha}, {hora}, {empresa}" },
];

const ETIQUETA_TIPO_LOG: Record<string, string> = {
  cotizacion_enviada: "Cotización enviada",
  cotizacion_por_vencer: "Cotización por vencer",
  tecnico_en_camino: "Técnico en camino",
  os_completada: "OS completada",
  cobro_pendiente: "Cobro pendiente",
  cobro_vencido: "Cobro vencido",
  cita_agendada: "Cita agendada",
};

type Mensajes = Record<TipoMensajePersonalizado, MensajePersonalizado | null>;

// Indicador "N de M completados": M = los 3 campos personalizables de
// cada tipo de mensaje (whatsapp/asunto/cuerpo). No hay restricción de
// obligatoriedad (dejar vacío usa el default), esto es solo progreso.
const CAMPOS_POR_MENSAJE = 3;
function camposCompletados(m: MensajePersonalizado | null): number {
  if (!m) return 0;
  return [m.mensaje_whatsapp, m.asunto_correo, m.cuerpo_correo].filter((v) => Boolean(v && v.trim())).length;
}

export default function NotificacionesPage() {
  const [tab, setTab] = useState<Tab>("correo");
  const [config, setConfig] = useState<NotificacionesConfig | null>(null);
  const [mensajes, setMensajes] = useState<Mensajes | null>(null);
  const [acordeonAbierto, setAcordeonAbierto] = useState<TipoMensajePersonalizado | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);

  const [historial, setHistorial] = useState<NotificacionClienteLog[] | null>(null);
  const [errorHistorial, setErrorHistorial] = useState<string | null>(null);
  const [reenviandoId, setReenviandoId] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setError(null);
    const res = await apiFetch("/api/notificaciones");
    if (!res.ok) {
      setError("No se pudo cargar la configuración");
      return;
    }
    const body = await res.json();
    setConfig(body.config);
    setMensajes(body.mensajes);
  }, []);

  const cargarHistorial = useCallback(async () => {
    setErrorHistorial(null);
    const res = await apiFetch("/api/notificaciones-cliente");
    if (!res.ok) {
      setErrorHistorial("No se pudo cargar el historial de envíos");
      return;
    }
    setHistorial(await res.json());
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  useEffect(() => {
    if (tab === "historial" && historial === null) cargarHistorial();
  }, [tab, historial, cargarHistorial]);

  async function onReenviar(id: string) {
    setReenviandoId(id);
    const res = await apiFetch(`/api/notificaciones-cliente/${id}/reenviar`, { method: "POST" });
    setReenviandoId(null);
    if (res.ok) cargarHistorial();
  }

  function actualizarToggle(campo: keyof NotificacionesConfig, valor: boolean) {
    setConfig((prev) => (prev ? { ...prev, [campo]: valor } : prev));
  }

  async function onGuardarPreferencias() {
    if (!config) return;
    setError(null);
    setAviso(null);
    setGuardando(true);
    const res = await apiFetch("/api/notificaciones", {
      method: "PATCH",
      body: JSON.stringify({
        correo_activado: config.correo_activado,
        whatsapp_activado: config.whatsapp_activado,
        cotizacion_creada: config.cotizacion_creada,
        cotizacion_enviada: config.cotizacion_enviada,
        cotizacion_aprobada: config.cotizacion_aprobada,
        cotizacion_rechazada: config.cotizacion_rechazada,
        cotizacion_por_vencer: config.cotizacion_por_vencer,
        dias_aviso_vencimiento: config.dias_aviso_vencimiento,
        os_creada: config.os_creada,
        tecnico_en_camino: config.tecnico_en_camino,
        os_completada: config.os_completada,
        cobranza_recibida: config.cobranza_recibida,
        cobro_pendiente: config.cobro_pendiente,
        cobranza_atrasada: config.cobranza_atrasada,
        cita_agendada: config.cita_agendada,
      }),
    });
    setGuardando(false);
    if (!res.ok) {
      setError("No se pudo guardar");
      return;
    }
    setAviso("Preferencias guardadas");
  }

  async function onGuardarMensaje(tipo: TipoMensajePersonalizado, datos: { mensaje_whatsapp: string; asunto_correo: string; cuerpo_correo: string }) {
    const res = await apiFetch(`/api/notificaciones/mensajes/${tipo}`, { method: "PATCH", body: JSON.stringify(datos) });
    if (res.ok) {
      const actualizado: MensajePersonalizado = await res.json();
      setMensajes((prev) => (prev ? { ...prev, [tipo]: actualizado } : prev));
      setAviso("Mensaje guardado");
    }
  }

  if (!config || !mensajes) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="Notificaciones" subtitle="Correo, WhatsApp y recordatorios" />
        {error ? <ErrorText>{error}</ErrorText> : <p className="text-sm text-muted">Cargando…</p>}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Notificaciones" subtitle="Correo, WhatsApp y recordatorios" />

      <div className="flex gap-1 border-b border-border">
        {(
          [
            { valor: "correo", etiqueta: "Correo", icon: IconMail },
            { valor: "whatsapp", etiqueta: "WhatsApp", icon: IconChat },
            { valor: "recordatorios", etiqueta: "Recordatorios", icon: IconClock },
            { valor: "historial", etiqueta: "Historial de envíos", icon: IconClock },
          ] as const
        ).map((t) => (
          <button
            key={t.valor}
            type="button"
            onClick={() => setTab(t.valor)}
            className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium transition-colors ${
              tab === t.valor ? "border-b-2 border-brand text-brand" : "text-muted hover:text-brand"
            }`}
          >
            <t.icon className="h-4 w-4" />
            {t.etiqueta}
          </button>
        ))}
      </div>

      {tab === "correo" && (
        <Card>
          <div className="mb-5 flex items-center justify-between">
            <div>
              <p className="font-medium text-foreground">Notificaciones por correo</p>
              <p className="text-sm text-muted">Apaga esto para silenciar todos los correos de eventos.</p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={config.correo_activado}
              onClick={() => actualizarToggle("correo_activado", !config.correo_activado)}
              className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${config.correo_activado ? "bg-brand" : "bg-border"}`}
            >
              <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${config.correo_activado ? "translate-x-5" : "translate-x-0.5"}`} />
            </button>
          </div>

          <div className="flex flex-col gap-5">
            {TOGGLES.map((grupo) => (
              <div key={grupo.grupo}>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">{grupo.grupo}</p>
                <div className="flex flex-col gap-2">
                  {grupo.items.map((item) => (
                    <label key={item.campo} className="flex items-center gap-2 text-sm text-foreground">
                      <input
                        type="checkbox"
                        checked={Boolean(config[item.campo])}
                        onChange={(e) => actualizarToggle(item.campo, e.target.checked)}
                        className="accent-brand"
                      />
                      {item.etiqueta}
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {error && (
            <div className="mt-4">
              <ErrorText>{error}</ErrorText>
            </div>
          )}
          {aviso && (
            <div className="mt-4">
              <SuccessText>{aviso}</SuccessText>
            </div>
          )}
          <Button type="button" onClick={onGuardarPreferencias} disabled={guardando} className="mt-4">
            {guardando ? "Guardando…" : "Guardar preferencias"}
          </Button>
        </Card>
      )}

      {tab === "whatsapp" && (
        <Card>
          <div className="mb-5 flex items-center justify-between">
            <div>
              <p className="font-medium text-foreground">Notificaciones por WhatsApp</p>
              <p className="text-sm text-muted">Apaga esto para silenciar todos los avisos por WhatsApp a clientes.</p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={config.whatsapp_activado}
              onClick={() => actualizarToggle("whatsapp_activado", !config.whatsapp_activado)}
              className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${config.whatsapp_activado ? "bg-brand" : "bg-border"}`}
            >
              <span
                className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${config.whatsapp_activado ? "translate-x-5" : "translate-x-0.5"}`}
              />
            </button>
          </div>
          <p className="text-sm text-muted">
            Usa los mismos eventos que ya prendiste en la pestaña Correo — un cliente con teléfono recibe el aviso por
            WhatsApp además del correo (o en su lugar, si no dejó correo). Edita el texto del mensaje en “Mensajes
            personalizados” más abajo.
          </p>
          {error && (
            <div className="mt-4">
              <ErrorText>{error}</ErrorText>
            </div>
          )}
          {aviso && (
            <div className="mt-4">
              <SuccessText>{aviso}</SuccessText>
            </div>
          )}
          <Button type="button" onClick={onGuardarPreferencias} disabled={guardando} className="mt-4">
            {guardando ? "Guardando…" : "Guardar"}
          </Button>
        </Card>
      )}

      {tab === "recordatorios" && (
        <Card>
          <p className="mb-4 text-sm text-muted">
            &ldquo;Cotización por vencer&rdquo; y &ldquo;Cobro pendiente/vencido&rdquo; se activan o desactivan en la
            pestaña Correo — acá solo se ajusta cuántos días antes avisar de una cotización por vencer.
          </p>
          <div className="max-w-xs">
            <Label>Días de aviso antes del vencimiento</Label>
            <Input
              type="number"
              min={0}
              value={config.dias_aviso_vencimiento}
              onChange={(e) => setConfig((prev) => (prev ? { ...prev, dias_aviso_vencimiento: Number(e.target.value) } : prev))}
            />
          </div>
          {error && (
            <div className="mt-4">
              <ErrorText>{error}</ErrorText>
            </div>
          )}
          {aviso && (
            <div className="mt-4">
              <SuccessText>{aviso}</SuccessText>
            </div>
          )}
          <Button type="button" onClick={onGuardarPreferencias} disabled={guardando} className="mt-4">
            {guardando ? "Guardando…" : "Guardar"}
          </Button>
        </Card>
      )}

      {tab === "historial" && (
        <Card className="p-0">
          <div className="p-6 pb-0">
            <p className="text-sm text-muted">
              Cada intento de correo automático al cliente queda registrado acá — si algo falló, puedes reenviarlo.
            </p>
          </div>
          <div className="p-6">
            {errorHistorial && <ErrorText>{errorHistorial}</ErrorText>}
            <DataTable
              rows={historial ?? []}
              rowKey={(h) => h.id}
              loading={historial === null && !errorHistorial}
              columns={[
                { header: "Evento", cell: (h) => ETIQUETA_TIPO_LOG[h.tipo] ?? h.tipo },
                { header: "Canal", cell: (h) => <Badge value={h.canal} /> },
                { header: "Destinatario", cell: (h) => <span className="text-muted">{h.destinatario}</span> },
                { header: "Fecha", cell: (h) => <span className="text-muted">{new Date(h.creado_en).toLocaleString("es-CL")}</span> },
                { header: "Estado", cell: (h) => <Badge value={h.exito ? "exito" : "fallido"} /> },
              ]}
              actions={[
                {
                  label: (h) => (reenviandoId === h.id ? "Reenviando…" : "Reenviar"),
                  onClick: (h) => onReenviar(h.id),
                  variant: "brand",
                  hidden: (h) => h.exito,
                },
              ]}
              emptyState={{ icon: IconMail, message: "Todavía no se ha enviado ninguna notificación al cliente." }}
            />
          </div>
        </Card>
      )}

      <Card>
        <div className="mb-1 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground">Mensajes personalizados</h2>
          <span className="text-xs font-medium text-muted">
            {TIPOS_MENSAJE.filter((t) => camposCompletados(mensajes[t.valor]) === CAMPOS_POR_MENSAJE).length} de {TIPOS_MENSAJE.length} completados
          </span>
        </div>
        <p className="mb-4 text-xs text-muted">
          Si dejas asunto/cuerpo vacíos, se usa un mensaje por defecto. El cuerpo del correo es texto simple, sin editor
          enriquecido.
        </p>
        <div className="flex flex-col divide-y divide-border">
          {TIPOS_MENSAJE.map((t) => (
            <AcordeonMensaje
              key={t.valor}
              tipo={t.valor}
              etiqueta={t.etiqueta}
              variables={t.variables}
              abierto={acordeonAbierto === t.valor}
              onToggle={() => setAcordeonAbierto((prev) => (prev === t.valor ? null : t.valor))}
              mensaje={mensajes[t.valor]}
              onGuardar={(datos) => onGuardarMensaje(t.valor, datos)}
            />
          ))}
        </div>
      </Card>
    </div>
  );
}

function AcordeonMensaje({
  etiqueta,
  variables,
  abierto,
  onToggle,
  mensaje,
  onGuardar,
}: {
  tipo: TipoMensajePersonalizado;
  etiqueta: string;
  variables: string;
  abierto: boolean;
  onToggle: () => void;
  mensaje: MensajePersonalizado | null;
  onGuardar: (datos: { mensaje_whatsapp: string; asunto_correo: string; cuerpo_correo: string }) => void;
}) {
  const [whatsapp, setWhatsapp] = useState(mensaje?.mensaje_whatsapp ?? "");
  const [asunto, setAsunto] = useState(mensaje?.asunto_correo ?? "");
  const [cuerpo, setCuerpo] = useState(mensaje?.cuerpo_correo ?? "");
  const [guardando, setGuardando] = useState(false);
  const completados = [whatsapp, asunto, cuerpo].filter((v) => Boolean(v.trim())).length;

  async function guardar() {
    setGuardando(true);
    await onGuardar({ mensaje_whatsapp: whatsapp, asunto_correo: asunto, cuerpo_correo: cuerpo });
    setGuardando(false);
  }

  return (
    <div className="py-3">
      <button type="button" onClick={onToggle} className="flex w-full items-center justify-between text-left text-sm font-medium text-foreground">
        {etiqueta}
        <span className="flex items-center gap-2 text-xs text-muted">
          <span className={completados === CAMPOS_POR_MENSAJE ? "font-medium text-success" : ""}>
            {completados} de {CAMPOS_POR_MENSAJE} completados
          </span>
          {abierto ? "Ocultar" : "Editar"}
        </span>
      </button>
      {abierto && (
        <div className="mt-3 flex flex-col gap-3">
          <div>
            <Label>Mensaje de WhatsApp</Label>
            <Textarea rows={2} value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} />
          </div>
          <div>
            <Label>Asunto del correo</Label>
            <Input type="text" value={asunto} onChange={(e) => setAsunto(e.target.value)} />
          </div>
          <div>
            <Label>Cuerpo del correo</Label>
            <Textarea rows={4} value={cuerpo} onChange={(e) => setCuerpo(e.target.value)} />
            <p className="mt-1.5 font-mono text-[11px] text-muted">Variables disponibles: {variables}</p>
          </div>
          <Button type="button" onClick={guardar} disabled={guardando} className="self-start">
            {guardando ? "Guardando…" : "Guardar mensaje"}
          </Button>
        </div>
      )}
    </div>
  );
}
