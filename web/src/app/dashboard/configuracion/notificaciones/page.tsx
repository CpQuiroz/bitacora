"use client";

import { useCallback, useEffect, useState } from "react";
import type { MensajePersonalizado, NotificacionesConfig, TipoMensajePersonalizado } from "@bitacora/shared";
import { apiFetch } from "@/lib/api";
import { Button, Card, ErrorText, Input, Label, PageHeader, SuccessText, Textarea } from "@/components/ui";
import { IconChat, IconClock, IconMail } from "@/components/icons";

type Tab = "correo" | "whatsapp" | "recordatorios";

const TOGGLES: { grupo: string; items: { campo: keyof NotificacionesConfig; etiqueta: string }[] }[] = [
  {
    grupo: "Cotizaciones",
    items: [
      { campo: "cotizacion_creada", etiqueta: "Nueva cotización creada" },
      { campo: "cotizacion_aprobada", etiqueta: "Aprobada por el cliente" },
      { campo: "cotizacion_rechazada", etiqueta: "Rechazada por el cliente" },
    ],
  },
  {
    grupo: "Órdenes de Servicio",
    items: [
      { campo: "os_creada", etiqueta: "Nueva OS creada" },
      { campo: "os_completada", etiqueta: "OS completada" },
    ],
  },
  {
    grupo: "Cobranzas",
    items: [
      { campo: "cobranza_recibida", etiqueta: "Pago recibido" },
      { campo: "cobranza_atrasada", etiqueta: "Pago atrasado" },
    ],
  },
];

const TIPOS_MENSAJE: { valor: TipoMensajePersonalizado; etiqueta: string }[] = [
  { valor: "cotizacion", etiqueta: "Cotizaciones" },
  { valor: "orden_servicio", etiqueta: "Órdenes de Servicio" },
  { valor: "cobranza", etiqueta: "Cobranzas" },
];

const VARIABLES = ["{nombre_cliente}", "{valor}", "{numero_cotizacion}"];

type Mensajes = Record<TipoMensajePersonalizado, MensajePersonalizado | null>;

export default function NotificacionesPage() {
  const [tab, setTab] = useState<Tab>("correo");
  const [config, setConfig] = useState<NotificacionesConfig | null>(null);
  const [mensajes, setMensajes] = useState<Mensajes | null>(null);
  const [acordeonAbierto, setAcordeonAbierto] = useState<TipoMensajePersonalizado | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const [whatsappConectado, setWhatsappConectado] = useState(false);

  const cargar = useCallback(async () => {
    setError(null);
    const [res, resIntegraciones] = await Promise.all([apiFetch("/api/notificaciones"), apiFetch("/api/integraciones")]);
    if (!res.ok) {
      setError("No se pudo cargar la configuración");
      return;
    }
    const body = await res.json();
    setConfig(body.config);
    setMensajes(body.mensajes);
    if (resIntegraciones.ok) {
      const lista = await resIntegraciones.json();
      setWhatsappConectado(Boolean(lista.find((i: { proveedor: string; conectado: boolean }) => i.proveedor === "whatsapp")?.conectado));
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

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
        cotizacion_creada: config.cotizacion_creada,
        cotizacion_aprobada: config.cotizacion_aprobada,
        cotizacion_rechazada: config.cotizacion_rechazada,
        os_creada: config.os_creada,
        os_completada: config.os_completada,
        cobranza_recibida: config.cobranza_recibida,
        cobranza_atrasada: config.cobranza_atrasada,
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
          <p className="text-sm text-foreground">
            {whatsappConectado ? "WhatsApp está conectado." : "WhatsApp todavía no está conectado."}
          </p>
          <p className="mt-1 text-sm text-muted">
            Los envíos por WhatsApp usan los mismos eventos configurados en la pestaña Correo — conecta la integración
            en{" "}
            <a href="/dashboard/configuracion/integraciones" className="font-medium text-brand hover:underline">
              Integraciones
            </a>{" "}
            y edita el texto del mensaje en “Mensajes personalizados” más abajo.
          </p>
        </Card>
      )}

      {tab === "recordatorios" && (
        <Card>
          <p className="text-sm text-muted">Próximamente: recordatorios automáticos antes de una OS agendada o un pago por vencer.</p>
        </Card>
      )}

      <Card>
        <h2 className="mb-1 text-sm font-semibold text-foreground">Mensajes personalizados</h2>
        <p className="mb-4 text-xs text-muted">
          Variables disponibles: {VARIABLES.join(", ")} — el cuerpo del correo es texto simple, sin editor enriquecido.
        </p>
        <div className="flex flex-col divide-y divide-border">
          {TIPOS_MENSAJE.map((t) => (
            <AcordeonMensaje
              key={t.valor}
              tipo={t.valor}
              etiqueta={t.etiqueta}
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
  abierto,
  onToggle,
  mensaje,
  onGuardar,
}: {
  tipo: TipoMensajePersonalizado;
  etiqueta: string;
  abierto: boolean;
  onToggle: () => void;
  mensaje: MensajePersonalizado | null;
  onGuardar: (datos: { mensaje_whatsapp: string; asunto_correo: string; cuerpo_correo: string }) => void;
}) {
  const [whatsapp, setWhatsapp] = useState(mensaje?.mensaje_whatsapp ?? "");
  const [asunto, setAsunto] = useState(mensaje?.asunto_correo ?? "");
  const [cuerpo, setCuerpo] = useState(mensaje?.cuerpo_correo ?? "");
  const [guardando, setGuardando] = useState(false);

  async function guardar() {
    setGuardando(true);
    await onGuardar({ mensaje_whatsapp: whatsapp, asunto_correo: asunto, cuerpo_correo: cuerpo });
    setGuardando(false);
  }

  return (
    <div className="py-3">
      <button type="button" onClick={onToggle} className="flex w-full items-center justify-between text-left text-sm font-medium text-foreground">
        {etiqueta}
        <span className="text-xs text-muted">{abierto ? "Ocultar" : "Editar"}</span>
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
          </div>
          <Button type="button" onClick={guardar} disabled={guardando} className="self-start">
            {guardando ? "Guardando…" : "Guardar mensaje"}
          </Button>
        </div>
      )}
    </div>
  );
}
