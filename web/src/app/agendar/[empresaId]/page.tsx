"use client";

import { useEffect, useState, type CSSProperties } from "react";
import Image from "next/image";
import { useParams } from "next/navigation";
import { marcaLegible } from "@bitacora/design-tokens";
import { Aviso, Button, Input, Textarea } from "@bitacora/ui/web";
import { EstadoCargando } from "@/components/estados";
import { IconCalendar, IconCheck } from "@/components/icons";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";

type Info = { nombre: string; logo_url: string | null; color_primario: string | null; duracion_slot_min: number; dias_max_adelante: number };
type Disponibilidad = Record<string, string[]>;

function fmtFechaCorta(fecha: string): string {
  return new Date(`${fecha}T00:00:00`).toLocaleDateString("es-CL", { weekday: "short", day: "numeric", month: "short" });
}
function fmtFechaLarga(fecha: string): string {
  return new Date(`${fecha}T00:00:00`).toLocaleDateString("es-CL", { weekday: "long", day: "numeric", month: "long" });
}

export default function ReservaPublicaPage() {
  const params = useParams<{ empresaId: string }>();
  const [info, setInfo] = useState<Info | null | "no-disponible">(null);
  const [disponibilidad, setDisponibilidad] = useState<Disponibilidad | null>(null);
  const [fechaElegida, setFechaElegida] = useState<string | null>(null);
  const [horaElegida, setHoraElegida] = useState<string | null>(null);

  const [nombre, setNombre] = useState("");
  const [telefono, setTelefono] = useState("");
  const [correo, setCorreo] = useState("");
  const [notas, setNotas] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reservado, setReservado] = useState(false);

  useEffect(() => {
    (async () => {
      const resInfo = await fetch(`${API_URL}/api/reserva-publica/${params.empresaId}/info`);
      if (!resInfo.ok) {
        setInfo("no-disponible");
        return;
      }
      setInfo(await resInfo.json());
      const resDisp = await fetch(`${API_URL}/api/reserva-publica/${params.empresaId}/disponibilidad`);
      if (resDisp.ok) setDisponibilidad(await resDisp.json());
    })();
  }, [params.empresaId]);

  const color = typeof info === "object" && info?.color_primario ? info.color_primario : "#4338ca";
  const fechasConCupo = disponibilidad ? Object.keys(disponibilidad).sort() : [];
  // El Button de @bitacora/ui pinta con --ds-brand: se le pasa el color de
  // la empresa (con contraste AA, tarea 154) en vez de un style suelto.
  const legible = marcaLegible(color);
  const marcaBoton = {
    "--ds-brand": legible.fondo,
    "--ds-brand-hover": `oklch(from ${legible.fondo} calc(l - 0.05) c h)`,
    "--ds-brand-pressed": `oklch(from ${legible.fondo} calc(l - 0.11) c h)`,
    "--ds-brand-foreground": legible.texto,
  } as CSSProperties;

  async function onReservar() {
    setError(null);
    if (!nombre.trim()) {
      setError("Falta tu nombre");
      return;
    }
    if (!telefono.trim() && !correo.trim()) {
      setError("Déjanos tu teléfono o tu correo");
      return;
    }
    if (!fechaElegida || !horaElegida) {
      setError("Elige un día y una hora");
      return;
    }
    setEnviando(true);
    const res = await fetch(`${API_URL}/api/reserva-publica/${params.empresaId}/reservar`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nombre,
        telefono: telefono || undefined,
        correo: correo || undefined,
        fecha: fechaElegida,
        hora: horaElegida,
        notas: notas || undefined,
      }),
    });
    setEnviando(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "No se pudo agendar tu cita");
      return;
    }
    setReservado(true);
  }

  if (info === null) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <EstadoCargando />
      </div>
    );
  }

  if (info === "no-disponible") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 px-6 text-center">
        <IconCalendar className="h-10 w-10 text-ds-text-secondary" />
        <p className="text-lg font-semibold text-ds-text">Este link de reserva no está disponible</p>
        <p className="max-w-sm text-sm text-ds-text-secondary">Puede que el negocio no tenga la reserva online activada, o el link ya no sea válido.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col gap-6 px-4 py-8">
      <div className="flex flex-col items-center gap-2 text-center">
        {info.logo_url ? (
          <Image src={info.logo_url} alt={info.nombre} width={56} height={56} className="h-14 w-14 rounded-xl object-contain" />
        ) : (
          <div
            className="flex h-14 w-14 items-center justify-center rounded-xl text-lg font-semibold text-white"
            style={{ backgroundColor: color }}
          >
            {info.nombre.slice(0, 1).toUpperCase()}
          </div>
        )}
        <h1 className="text-xl font-semibold text-ds-text">{info.nombre}</h1>
        <p className="text-sm text-ds-text-secondary">Agenda tu cita en línea</p>
      </div>

      {reservado ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-ds-divider bg-ds-surface p-8 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full" style={{ backgroundColor: color }}>
            <IconCheck className="h-6 w-6 text-white" />
          </div>
          <p className="font-semibold text-ds-text">¡Listo, tu cita quedó agendada!</p>
          <p className="text-sm text-ds-text-secondary">
            {fechaElegida && fmtFechaLarga(fechaElegida)} a las {horaElegida}
          </p>
          <p className="text-xs text-ds-text-secondary">Te avisaremos por correo o WhatsApp con los detalles.</p>
        </div>
      ) : (
        <>
          <div>
            <p className="mb-2 text-sm font-medium text-ds-text">Elige un día</p>
            {disponibilidad === null ? (
              <EstadoCargando mensaje="Cargando disponibilidad" />
            ) : fechasConCupo.length === 0 ? (
              <p className="text-sm text-ds-text-secondary">No hay horas disponibles por ahora — vuelve a intentar más tarde.</p>
            ) : (
              <div className="flex gap-2 overflow-x-auto pb-1">
                {fechasConCupo.map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => {
                      setFechaElegida(f);
                      setHoraElegida(null);
                    }}
                    className={`shrink-0 rounded-lg border px-3 py-2 text-xs font-medium capitalize transition-colors ${
                      fechaElegida === f ? "border-transparent text-white" : "border-ds-divider text-ds-text hover:bg-ds-brand/[0.08]"
                    }`}
                    style={fechaElegida === f ? { backgroundColor: color } : undefined}
                  >
                    {fmtFechaCorta(f)}
                  </button>
                ))}
              </div>
            )}
          </div>

          {fechaElegida && (
            <div>
              <p className="mb-2 text-sm font-medium text-ds-text">Elige una hora</p>
              <div className="flex flex-wrap gap-2">
                {(disponibilidad?.[fechaElegida] ?? []).map((h) => (
                  <button
                    key={h}
                    type="button"
                    onClick={() => setHoraElegida(h)}
                    className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${
                      horaElegida === h ? "border-transparent text-white" : "border-ds-divider text-ds-text hover:bg-ds-brand/[0.08]"
                    }`}
                    style={horaElegida === h ? { backgroundColor: color } : undefined}
                  >
                    {h}
                  </button>
                ))}
              </div>
            </div>
          )}

          {horaElegida && (
            <div className="flex flex-col gap-3 rounded-2xl border border-ds-divider bg-ds-surface p-4" style={marcaBoton}>
              <Input etiqueta="Tu nombre" valor={nombre} onCambio={setNombre} />
              <Input etiqueta="Teléfono" tipo="tel" placeholder="+56 9 1234 5678" valor={telefono} onCambio={setTelefono} />
              <Input etiqueta="Correo (opcional si dejaste teléfono)" tipo="email" valor={correo} onCambio={setCorreo} autoCapitalizar={false} />
              <Textarea etiqueta="Notas (opcional)" filas={2} valor={notas} onCambio={setNotas} />
              {error && <Aviso tono="error">{error}</Aviso>}
              <Button bloque onPress={onReservar} deshabilitado={enviando}>
                {enviando ? "Agendando…" : "Confirmar cita"}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
