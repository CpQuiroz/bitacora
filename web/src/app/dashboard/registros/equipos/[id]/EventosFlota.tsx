"use client";

// Eventos semanales de flota (migración 128, 23-sep-2026) — pestaña
// "Eventos" de la ficha de un vehículo. Vista por semana (lunes–domingo)
// con navegación, más un formulario corto: fecha, tipo (lista fija),
// descripción y kilometraje opcionales. Varios eventos por semana.

import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Plus, Trash2 } from "lucide-react";
import type { Equipo, EventoFlotaConAutor, TipoEventoFlota } from "@bitacora/shared";
import { ETIQUETA_TIPO_EVENTO_FLOTA, TIPOS_EVENTO_FLOTA } from "@bitacora/shared";
import { apiFetch } from "@/lib/api";
import { Button, Card, DatePicker, EmptyState, ErrorState, Input, LoadingState, Select, Textarea } from "@bitacora/ui/web";

const DIAS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

function iso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function lunesDe(d: Date): Date {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  return x;
}
function sumarDias(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

export function EventosFlota({ equipo, puedeGestionar }: { equipo: Equipo; puedeGestionar: boolean }) {
  const [lunes, setLunes] = useState(() => lunesDe(new Date()));
  const domingo = useMemo(() => sumarDias(lunes, 6), [lunes]);
  const [eventos, setEventos] = useState<EventoFlotaConAutor[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [formAbierto, setFormAbierto] = useState(false);
  const [fecha, setFecha] = useState<Date | null>(new Date());
  const [tipo, setTipo] = useState<TipoEventoFlota>("luz");
  const [descripcion, setDescripcion] = useState("");
  const [kilometraje, setKilometraje] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [errorForm, setErrorForm] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setError(null);
    const res = await apiFetch(`/api/equipos/${equipo.id}/eventos?desde=${iso(lunes)}&hasta=${iso(domingo)}`);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "No se pudieron cargar los eventos");
      return;
    }
    setEventos(await res.json());
  }, [equipo.id, lunes, domingo]);

  useEffect(() => {
    setEventos(null);
    void cargar();
  }, [cargar]);

  async function guardar() {
    setErrorForm(null);
    if (!fecha) return setErrorForm("Elige la fecha");
    if (tipo === "otro" && !descripcion.trim()) return setErrorForm("Describe el evento cuando el tipo es \"Otro\"");
    setGuardando(true);
    const res = await apiFetch(`/api/equipos/${equipo.id}/eventos`, {
      method: "POST",
      body: JSON.stringify({ tipo, fecha: iso(fecha), descripcion: descripcion.trim() || undefined, kilometraje: kilometraje || undefined }),
    });
    setGuardando(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      return setErrorForm(body.error ?? "No se pudo registrar el evento");
    }
    setDescripcion("");
    setKilometraje("");
    setFormAbierto(false);
    // Salta a la semana del evento registrado, así se ve de inmediato.
    const semana = lunesDe(fecha);
    if (iso(semana) !== iso(lunes)) setLunes(semana);
    else void cargar();
  }

  async function eliminar(id: string) {
    if (!confirm("¿Eliminar este evento?")) return;
    const res = await apiFetch(`/api/equipos/${equipo.id}/eventos/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      alert(body.error ?? "No se pudo eliminar");
      return;
    }
    void cargar();
  }

  const esSemanaActual = iso(lunes) === iso(lunesDe(new Date()));
  const titulo = `${lunes.getDate()} ${MESES[lunes.getMonth()]} – ${domingo.getDate()} ${MESES[domingo.getMonth()]} ${domingo.getFullYear()}`;

  // Agrupados por día (ya vienen ordenados por fecha desc).
  const porDia = useMemo(() => {
    const m = new Map<string, EventoFlotaConAutor[]>();
    for (const e of eventos ?? []) {
      if (!m.has(e.fecha)) m.set(e.fecha, []);
      m.get(e.fecha)!.push(e);
    }
    return [...m.entries()];
  }, [eventos]);

  return (
    <div className="flex flex-col gap-ds-4">
      <div className="flex flex-wrap items-center justify-between gap-ds-3">
        <div className="flex items-center gap-ds-2">
          <button type="button" onClick={() => setLunes(sumarDias(lunes, -7))} className="rounded-ds-sm p-1 text-ds-text/70 hover:bg-ds-text/5" aria-label="Semana anterior">
            <ChevronLeft size={18} />
          </button>
          <p className="min-w-44 text-center font-ds-body text-ds-small font-semibold text-ds-text">
            {esSemanaActual ? "Esta semana · " : ""}
            {titulo}
          </p>
          <button type="button" onClick={() => setLunes(sumarDias(lunes, 7))} className="rounded-ds-sm p-1 text-ds-text/70 hover:bg-ds-text/5" aria-label="Semana siguiente">
            <ChevronRight size={18} />
          </button>
          {!esSemanaActual ? (
            <button type="button" onClick={() => setLunes(lunesDe(new Date()))} className="font-ds-body text-ds-caption text-ds-brand hover:underline">
              Ir a esta semana
            </button>
          ) : null}
        </div>
        {!formAbierto ? (
          <Button onPress={() => setFormAbierto(true)} iconoIzq={<Plus size={16} strokeWidth={2.75} />}>
            Registrar evento
          </Button>
        ) : null}
      </div>

      {formAbierto ? (
        <Card>
          <p className="mb-ds-3 font-ds-body text-ds-small font-semibold text-ds-text">Nuevo evento</p>
          <div className="grid gap-ds-3 sm:grid-cols-3">
            <DatePicker etiqueta="Fecha" valor={fecha} onCambio={setFecha} maximo={new Date()} />
            <Select
              etiqueta="Tipo de evento"
              valor={tipo}
              onCambio={(v) => setTipo(v as TipoEventoFlota)}
              opciones={TIPOS_EVENTO_FLOTA.map((t) => ({ valor: t, etiqueta: ETIQUETA_TIPO_EVENTO_FLOTA[t] }))}
            />
            <Input etiqueta="Kilometraje (opcional)" tipo="numero" valor={kilometraje} onCambio={setKilometraje} />
            <div className="sm:col-span-3">
              <Textarea
                etiqueta={tipo === "otro" ? "Descripción" : "Descripción (opcional)"}
                placeholder="Ej.: se cambió la ampolleta del foco trasero izquierdo"
                filas={2}
                valor={descripcion}
                onCambio={setDescripcion}
              />
            </div>
          </div>
          {errorForm ? <p className="mt-ds-2 font-ds-body text-ds-small text-ds-danger">{errorForm}</p> : null}
          <div className="mt-ds-4 flex gap-ds-2">
            <Button onPress={() => void guardar()} cargando={guardando}>
              Guardar evento
            </Button>
            <Button variante="ghost" onPress={() => setFormAbierto(false)}>
              Cancelar
            </Button>
          </div>
        </Card>
      ) : null}

      {error ? (
        <ErrorState mensaje={error} onReintentar={() => void cargar()} />
      ) : eventos === null ? (
        <LoadingState />
      ) : eventos.length === 0 ? (
        <EmptyState titulo="Sin eventos esta semana" mensaje="Registra aquí lo que le pasó al vehículo: una luz cambiada, un neumático pinchado, un golpe…" />
      ) : (
        <Card>
          <div className="flex flex-col divide-y divide-ds-divider">
            {porDia.map(([dia, lista]) => {
              const d = new Date(dia + "T00:00:00");
              return (
                <div key={dia} className="py-ds-3 first:pt-0 last:pb-0">
                  <p className="mb-ds-2 font-ds-body text-ds-caption font-semibold uppercase tracking-wide text-ds-text-secondary">
                    {DIAS[d.getDay()]} {d.getDate()} {MESES[d.getMonth()]}
                  </p>
                  <ul className="flex flex-col gap-ds-2">
                    {lista.map((e) => (
                      <li key={e.id} className="flex items-start justify-between gap-ds-3">
                        <div className="min-w-0">
                          <p className="font-ds-body text-ds-small font-semibold text-ds-text">{ETIQUETA_TIPO_EVENTO_FLOTA[e.tipo] ?? e.tipo}</p>
                          {e.descripcion ? <p className="font-ds-body text-ds-small text-ds-text/80">{e.descripcion}</p> : null}
                          <p className="font-ds-body text-ds-caption text-ds-text-secondary">
                            {e.autor?.nombre ?? "—"}
                            {e.kilometraje != null ? ` · ${Number(e.kilometraje).toLocaleString("es-CL")} km` : ""}
                          </p>
                        </div>
                        {puedeGestionar ? (
                          <button type="button" onClick={() => void eliminar(e.id)} className="shrink-0 rounded-ds-sm p-1 text-ds-text-secondary hover:text-ds-danger" aria-label="Eliminar evento">
                            <Trash2 size={16} />
                          </button>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        </Card>
      )}
    </div>
  );
}
