"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Equipo, Proveedor, RegistroMantencionEquipo, RespuestaChecklistMantencion } from "@bitacora/shared";
import { MANTENCION_EXIGE_FOTO_EN_NO } from "@bitacora/shared";
import { apiFetch } from "@/lib/api";
import { comprimirImagen } from "@/lib/comprimirImagen";
import { abrirPdfRegistroMantencion } from "@/lib/descargarPdf";
import { Button, Cifra, Label, Select, Textarea } from "@/components/ui";
import { EstadoCargando, EstadoError, EstadoVacio } from "@/components/estados";
import { Modal } from "@/components/Modal";
import { SelectCrear } from "@/components/SelectCrear";
import { IconCamera, IconChevronDown, IconPlus, IconReceipt, IconTruck, IconX } from "@/components/icons";

type PlantillaSeccion = { nombre: string; preguntas: { texto: string; obligatorio: boolean }[] };
type Plantilla = { nombre: string; secciones: PlantillaSeccion[] };

type RegistroConRelaciones = RegistroMantencionEquipo & {
  proveedor: { nombre: string } | null;
  responsable: { nombre: string } | null;
};

type FiltroTipo = "" | "diario" | "programa";
type Respuestas = Record<string, RespuestaChecklistMantencion>;
type FotoLocal = { file: File; item: string | null };

const OPCIONES: { valor: RespuestaChecklistMantencion; texto: string }[] = [
  { valor: "si", texto: "SÍ" },
  { valor: "no", texto: "NO" },
  { valor: "na", texto: "N/A" },
];

const clave = (s: string, i: string) => `${s}||${i}`;
const fechaCL = (iso: string | null | undefined) => {
  if (!iso) return "—";
  const [y, m, d] = iso.slice(0, 10).split("-");
  return d && m && y ? `${d}-${m}-${y}` : iso;
};
const tieneNovedad = (checklist: RegistroMantencionEquipo["checklist"]) =>
  Array.isArray(checklist) && checklist.some((c) => c.respuesta === "no");

// ============================================================
// Pestaña "Mantención"
// ============================================================
export function RegistrosMantencion({ equipo, puedeGestionar }: { equipo: Equipo; puedeGestionar: boolean }) {
  const [registros, setRegistros] = useState<RegistroConRelaciones[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tipo, setTipo] = useState<FiltroTipo>("");
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [modalAbierto, setModalAbierto] = useState(false);

  const cargar = useCallback(async () => {
    if (!puedeGestionar) {
      setRegistros([]);
      return;
    }
    setError(null);
    setRegistros(null);
    const qs = new URLSearchParams();
    if (tipo) qs.set("tipo", tipo);
    if (desde) qs.set("desde", desde);
    if (hasta) qs.set("hasta", hasta);
    const suf = qs.toString() ? `?${qs}` : "";
    const res = await apiFetch(`/api/equipos/${equipo.id}/registros-mantencion${suf}`);
    if (!res.ok) {
      setError("No se pudo cargar el historial de mantención.");
      setRegistros([]);
      return;
    }
    setRegistros(await res.json());
  }, [equipo.id, puedeGestionar, tipo, desde, hasta]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  if (!puedeGestionar) {
    return (
      <div className="rounded-2xl border border-border bg-surface p-5 text-sm text-muted">
        El historial de mantención lo ven Administración y Supervisión. Desde la app, el chofer registra el
        chequeo diario de su vehículo.
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border bg-surface">
      {/* Barra de filtros */}
      <div className="flex flex-wrap items-end gap-3 border-b border-border p-5">
        <div className="w-40">
          <Label>Tipo</Label>
          <Select value={tipo} onChange={(e) => setTipo(e.target.value as FiltroTipo)}>
            <option value="">Todos</option>
            <option value="diario">Diario</option>
            <option value="programa">Programa</option>
          </Select>
        </div>
        <div>
          <Label>Desde</Label>
          <input
            type="date"
            value={desde}
            onChange={(e) => setDesde(e.target.value)}
            className="h-10 rounded-lg border border-border bg-surface px-3 font-mono text-sm text-foreground focus:outline-none focus-visible:border-brand focus-visible:ring-[3px] focus-visible:ring-brand/25"
          />
        </div>
        <div>
          <Label>Hasta</Label>
          <input
            type="date"
            value={hasta}
            onChange={(e) => setHasta(e.target.value)}
            className="h-10 rounded-lg border border-border bg-surface px-3 font-mono text-sm text-foreground focus:outline-none focus-visible:border-brand focus-visible:ring-[3px] focus-visible:ring-brand/25"
          />
        </div>
        <span className="ml-auto self-center font-mono text-[11px] uppercase tracking-[0.1em] text-muted">
          {registros ? `${registros.length} registro${registros.length === 1 ? "" : "s"}` : "…"}
        </span>
        <Button type="button" onClick={() => setModalAbierto(true)}>
          <IconPlus className="h-4 w-4" />
          Nuevo registro
        </Button>
      </div>

      {/* Tabla / estados */}
      <div className="p-5">
        {registros === null && !error ? (
          <EstadoCargando mensaje="Cargando registros" />
        ) : error ? (
          <EstadoError mensaje={error} onReintentar={cargar} />
        ) : registros && registros.length === 0 ? (
          <EstadoVacio
            icono={IconTruck}
            titulo="Todavía no hay registros de mantención para este vehículo"
            mensaje="Registra el chequeo diario o el Programa de Mantención para empezar el historial."
            accion={
              <Button type="button" onClick={() => setModalAbierto(true)}>
                <IconPlus className="h-4 w-4" />
                Nuevo registro
              </Button>
            }
          />
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border bg-surface-sunken font-mono text-[10px] uppercase tracking-[0.1em] text-muted">
                  <th className="px-5 py-3 font-medium">Fecha</th>
                  <th className="px-5 py-3 font-medium">Tipo</th>
                  <th className="px-5 py-3 font-medium">Origen</th>
                  <th className="px-5 py-3 font-medium">Realizado por</th>
                  <th className="px-5 py-3 font-medium">Km / Horas</th>
                  <th className="px-5 py-3 font-medium">Estado</th>
                  <th className="px-5 py-3 font-medium">PDF</th>
                </tr>
              </thead>
              <tbody>
                {(registros ?? []).map((r) => {
                  const nov = tieneNovedad(r.checklist);
                  const quien =
                    r.origen === "externo" ? (r.proveedor?.nombre ?? "Taller externo") : (r.responsable?.nombre ?? "—");
                  return (
                    <tr
                      key={r.id}
                      className="border-b border-border-soft last:border-0 even:bg-[#fafbfc] hover:bg-surface-sunken"
                    >
                      <td className="px-5 py-3">
                        <Cifra>{fechaCL(r.fecha)}</Cifra>
                      </td>
                      <td className="px-5 py-3">
                        <span
                          className={`inline-block rounded-sm px-2 py-0.5 text-[11px] font-semibold ${
                            r.tipo === "programa" ? "bg-brand-soft text-brand" : "bg-surface-sunken text-muted"
                          }`}
                        >
                          {r.tipo === "programa" ? "Programa" : "Diario"}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-muted">{r.origen === "externo" ? "Taller externo" : "Interno"}</td>
                      <td className="px-5 py-3">{quien}</td>
                      <td className="px-5 py-3">
                        <Cifra>
                          {r.kilometraje != null ? `${Number(r.kilometraje).toLocaleString("es-CL")} km` : "—"}
                          {r.horas_motor != null ? ` · ${Number(r.horas_motor).toLocaleString("es-CL")} h` : ""}
                        </Cifra>
                      </td>
                      <td className="px-5 py-3">
                        <span
                          className={`inline-block rounded-sm px-2 py-0.5 text-[11px] font-semibold ${
                            nov ? "bg-warning-soft text-warning" : "bg-success-soft text-success"
                          }`}
                        >
                          {nov ? "Con novedades" : "Sin novedades"}
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        <button
                          type="button"
                          onClick={() => abrirPdfRegistroMantencion(equipo.id, r.id)}
                          aria-label="Ver PDF del registro"
                          className="flex h-7 w-7 items-center justify-center rounded-sm border border-border text-muted transition-colors hover:border-brand hover:text-brand"
                        >
                          <IconReceipt className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal open={modalAbierto} onClose={() => setModalAbierto(false)} title="Nuevo registro de mantención" xl>
        <ModalNuevoRegistro
          equipo={equipo}
          onListo={() => {
            setModalAbierto(false);
            cargar();
          }}
        />
      </Modal>
    </div>
  );
}

// ============================================================
// Modal — formulario de alta
// ============================================================
function ModalNuevoRegistro({ equipo, onListo }: { equipo: Equipo; onListo: () => void }) {
  const [plantilla, setPlantilla] = useState<Plantilla | null>(null);
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [cargando, setCargando] = useState(true);
  const [errorCarga, setErrorCarga] = useState<string | null>(null);

  const [tipo, setTipo] = useState<"diario" | "programa">("diario");
  const [fecha, setFecha] = useState(() => new Date().toISOString().slice(0, 10));
  const [kilometraje, setKilometraje] = useState("");
  const [horasMotor, setHorasMotor] = useState("");
  const [proveedorId, setProveedorId] = useState("");
  const [respuestas, setRespuestas] = useState<Respuestas>({});
  const [observaciones, setObservaciones] = useState("");
  const [fotos, setFotos] = useState<FotoLocal[]>([]);
  const [abiertas, setAbiertas] = useState<Set<number>>(new Set([0]));

  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileGeneral = useRef<HTMLInputElement>(null);
  const fileItem = useRef<HTMLInputElement>(null);
  const itemPendiente = useRef<string | null>(null);

  useEffect(() => {
    (async () => {
      const [resP, resProv] = await Promise.all([
        apiFetch(`/api/equipos/${equipo.id}/registros-mantencion/plantilla`),
        apiFetch("/api/proveedores"),
      ]);
      if (resP.ok) setPlantilla(await resP.json());
      else setErrorCarga("No se pudo cargar el checklist.");
      if (resProv.ok) setProveedores((await resProv.json()).filter((p: Proveedor) => p.activo));
      setCargando(false);
    })();
  }, [equipo.id]);

  const responder = (s: string, i: string, v: RespuestaChecklistMantencion) =>
    setRespuestas((r) => ({ ...r, [clave(s, i)]: v }));

  const totalItems = useMemo(
    () => (plantilla ? plantilla.secciones.reduce((n, s) => n + s.preguntas.length, 0) : 0),
    [plantilla]
  );
  const respondidos = Object.keys(respuestas).length;

  // Ítems en NO que todavía no tienen foto asociada.
  const itemsNoSinFoto = useMemo(() => {
    if (!plantilla || !MANTENCION_EXIGE_FOTO_EN_NO) return [];
    const conFoto = new Set(fotos.map((f) => f.item).filter((x): x is string => Boolean(x)));
    return plantilla.secciones
      .flatMap((s) => s.preguntas.map((p) => ({ item: p.texto, k: clave(s.nombre, p.texto) })))
      .filter(({ item, k }) => respuestas[k] === "no" && !conFoto.has(item))
      .map(({ item }) => item);
  }, [plantilla, respuestas, fotos]);

  async function agregarFotos(files: FileList | null, item: string | null) {
    if (!files) return;
    const nuevas: FotoLocal[] = [];
    for (const f of Array.from(files).slice(0, 8)) {
      nuevas.push({ file: await comprimirImagen(f), item });
    }
    setFotos((prev) => [...prev, ...nuevas].slice(0, 12));
  }

  const faltaKm = kilometraje.trim() === "";
  const faltaHoras = horasMotor.trim() === "";
  const faltaProveedor = tipo === "programa" && !proveedorId;
  const sinResponder = respondidos === 0;
  const bloqueado = faltaKm || faltaHoras || faltaProveedor || sinResponder || itemsNoSinFoto.length > 0;

  const ayudaBloqueo = faltaKm || faltaHoras
    ? "Completa kilometraje y horas motor."
    : faltaProveedor
      ? "Elige el taller o lubricentro."
      : sinResponder
        ? "Responde al menos un ítem del checklist."
        : itemsNoSinFoto.length > 0
          ? `Falta una foto de respaldo en: ${itemsNoSinFoto.join(", ")}.`
          : "Listo para guardar.";

  async function onSubmit() {
    if (!plantilla || bloqueado) return;
    setError(null);
    setGuardando(true);

    const checklist = plantilla.secciones.flatMap((sec) =>
      sec.preguntas.flatMap((p) => {
        const resp = respuestas[clave(sec.nombre, p.texto)];
        return resp ? [{ seccion: sec.nombre, item: p.texto, respuesta: resp }] : [];
      })
    );

    // Las fotos van como archivos en un multipart/form-data (patrón de
    // trabajos.ts), NUNCA en el JSON — eso choca con el límite de
    // express.json (100 kb) y devuelve 413.
    const fd = new FormData();
    fd.append("tipo", tipo);
    fd.append("fecha", fecha);
    fd.append("checklist", JSON.stringify(checklist));
    fd.append("kilometraje", kilometraje);
    fd.append("horas_motor", horasMotor);
    if (observaciones.trim()) fd.append("observaciones", observaciones.trim());
    if (tipo === "programa" && proveedorId) fd.append("proveedor_id", proveedorId);
    fd.append("fotos_items", JSON.stringify(fotos.map((f) => f.item)));
    for (const f of fotos) fd.append("fotos", f.file);

    const res = await apiFetch(`/api/equipos/${equipo.id}/registros-mantencion`, {
      method: "POST",
      body: fd,
    });
    setGuardando(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "No se pudo guardar el registro.");
      return;
    }
    onListo();
  }

  if (cargando) return <EstadoCargando mensaje="Cargando formulario" />;
  if (errorCarga || !plantilla) return <EstadoError mensaje={errorCarga ?? "No se pudo cargar el formulario."} />;

  const todasAbiertas = abiertas.size === plantilla.secciones.length;

  return (
    <div className="flex flex-col gap-5">
      <input ref={fileGeneral} type="file" accept="image/*" multiple className="hidden" onChange={(e) => agregarFotos(e.target.files, null)} />
      <input
        ref={fileItem}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          agregarFotos(e.target.files, itemPendiente.current);
          itemPendiente.current = null;
        }}
      />

      {/* 1. Vehículo (solo lectura) */}
      <div className="grid gap-3 rounded-lg border border-border-soft bg-surface-sunken p-4 sm:grid-cols-3">
        {[
          ["Patente", equipo.patente ?? "—"],
          ["Marca / modelo", [equipo.marca, equipo.modelo].filter(Boolean).join(" ") || equipo.nombre],
          ["Tipo de vehículo", equipo.tipo_vehiculo ?? equipo.categoria ?? "—"],
        ].map(([k, v]) => (
          <div key={k}>
            <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted">{k}</p>
            <p className="mt-0.5 font-mono text-sm font-semibold text-foreground">{v}</p>
          </div>
        ))}
      </div>

      {/* 2. Tipo */}
      <fieldset>
        <legend className="mb-1.5 text-[13px] font-semibold text-foreground">Tipo de registro</legend>
        <div className="flex flex-wrap gap-2">
          {([
            { v: "diario", t: "Chequeo diario" },
            { v: "programa", t: "Programa de mantención" },
          ] as const).map((o) => (
            <button
              key={o.v}
              type="button"
              aria-pressed={tipo === o.v}
              onClick={() => setTipo(o.v)}
              className={`h-11 rounded-lg border px-4 text-sm font-medium transition-colors ${
                tipo === o.v ? "border-[1.5px] border-brand bg-brand-soft text-brand" : "border-border bg-surface text-foreground hover:border-muted-soft"
              }`}
            >
              {o.t}
            </button>
          ))}
        </div>
        <p className="mt-1.5 text-[13px] text-muted">
          {tipo === "diario"
            ? "Lo hace el chofer antes de salir a ruta. Queda como interno."
            : "Cada 250 h o 6 meses, en un taller o lubricentro autorizado."}
        </p>
      </fieldset>

      {/* 3. Km / Horas / Fecha */}
      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <label htmlFor="rm-km" className="mb-1.5 block text-[13px] font-semibold text-foreground">
            Kilometraje
          </label>
          <input
            id="rm-km"
            inputMode="numeric"
            value={kilometraje}
            onChange={(e) => setKilometraje(e.target.value.replace(/[^\d]/g, ""))}
            className="h-10 w-full rounded-lg border border-border bg-surface px-3 font-mono text-sm tabular-nums text-foreground focus:outline-none focus-visible:border-brand focus-visible:ring-[3px] focus-visible:ring-brand/25"
            placeholder="412860"
          />
        </div>
        <div>
          <label htmlFor="rm-horas" className="mb-1.5 block text-[13px] font-semibold text-foreground">
            Horas motor
          </label>
          <input
            id="rm-horas"
            inputMode="numeric"
            value={horasMotor}
            onChange={(e) => setHorasMotor(e.target.value.replace(/[^\d]/g, ""))}
            className="h-10 w-full rounded-lg border border-border bg-surface px-3 font-mono text-sm tabular-nums text-foreground focus:outline-none focus-visible:border-brand focus-visible:ring-[3px] focus-visible:ring-brand/25"
            placeholder="6120"
          />
        </div>
        <div>
          <label htmlFor="rm-fecha" className="mb-1.5 block text-[13px] font-semibold text-foreground">
            Fecha
          </label>
          <input
            id="rm-fecha"
            type="date"
            max={new Date().toISOString().slice(0, 10)}
            value={fecha}
            onChange={(e) => setFecha(e.target.value)}
            className="h-10 w-full rounded-lg border border-border bg-surface px-3 font-mono text-sm text-foreground focus:outline-none focus-visible:border-brand focus-visible:ring-[3px] focus-visible:ring-brand/25"
          />
        </div>
      </div>

      {/* 4. Taller (solo Programa) */}
      {tipo === "programa" && (
        <div>
          <Label>Taller / lubricentro</Label>
          <SelectCrear<Proveedor>
            value={proveedorId}
            onChange={setProveedorId}
            opciones={proveedores}
            endpoint="/api/proveedores"
            placeholder="Buscar taller o lubricentro autorizado…"
            etiquetaCrear="+ Crear proveedor nuevo"
            onCreado={(nuevo) => setProveedores((p) => [...p, nuevo])}
            gestionHref="/dashboard/registros/proveedores"
            gestionLabel="Gestionar proveedores"
          />
        </div>
      )}

      {/* 5. Checklist */}
      <div>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <p className="text-[13px] font-semibold text-foreground">
            Checklist — <Cifra className="text-muted">{respondidos} de {totalItems}</Cifra> ítems respondidos
          </p>
          <button
            type="button"
            onClick={() =>
              setAbiertas(todasAbiertas ? new Set() : new Set(plantilla.secciones.map((_, i) => i)))
            }
            className="text-xs font-medium text-brand hover:underline"
          >
            {todasAbiertas ? "Colapsar todo" : "Expandir todo"}
          </button>
        </div>

        <div className="flex flex-col gap-2">
          {plantilla.secciones.map((sec, idx) => {
            const abierta = abiertas.has(idx);
            const enSeccion = sec.preguntas.filter((p) => respuestas[clave(sec.nombre, p.texto)]).length;
            const completa = enSeccion === sec.preguntas.length;
            return (
              <div key={sec.nombre} className="overflow-hidden rounded-lg border border-border">
                <button
                  type="button"
                  aria-expanded={abierta}
                  onClick={() =>
                    setAbiertas((s) => {
                      const n = new Set(s);
                      if (n.has(idx)) n.delete(idx);
                      else n.add(idx);
                      return n;
                    })
                  }
                  className="flex min-h-[46px] w-full items-center gap-3 bg-surface-sunken px-3 text-left text-sm font-semibold text-foreground"
                >
                  <span
                    className={`grid h-[22px] w-[22px] shrink-0 place-items-center rounded-sm text-xs font-bold ${
                      completa ? "bg-success-soft text-success" : "bg-brand text-white"
                    }`}
                  >
                    {idx + 1}
                  </span>
                  <span className="flex-1">{sec.nombre}</span>
                  <Cifra
                    className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                      completa ? "bg-success-soft text-success" : "bg-surface text-muted"
                    }`}
                  >
                    {enSeccion}/{sec.preguntas.length}
                  </Cifra>
                  <IconChevronDown className={`h-4 w-4 text-muted transition-transform ${abierta ? "rotate-180" : ""}`} />
                </button>
                {abierta && (
                  <div className="flex flex-col divide-y divide-border-soft px-3">
                    {sec.preguntas.map((p) => {
                      const actual = respuestas[clave(sec.nombre, p.texto)];
                      const necesitaFoto =
                        MANTENCION_EXIGE_FOTO_EN_NO &&
                        actual === "no" &&
                        !fotos.some((f) => f.item === p.texto);
                      return (
                        <div key={p.texto} className="flex flex-wrap items-center gap-x-3 gap-y-2 py-2.5">
                          <span className="min-w-[10rem] flex-1 text-sm">{p.texto}</span>
                          {necesitaFoto && (
                            <span className="rounded-sm bg-warning-soft px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-warning">
                              Foto requerida
                            </span>
                          )}
                          {actual === "no" && (
                            <button
                              type="button"
                              onClick={() => {
                                itemPendiente.current = p.texto;
                                fileItem.current?.click();
                              }}
                              className="text-xs font-medium text-brand hover:underline"
                            >
                              + Foto{fotos.filter((f) => f.item === p.texto).length ? ` (${fotos.filter((f) => f.item === p.texto).length})` : ""}
                            </button>
                          )}
                          <span
                            role="group"
                            aria-label={p.texto}
                            className="inline-flex overflow-hidden rounded-lg border border-border bg-surface-sunken p-0.5"
                          >
                            {OPCIONES.map((op) => {
                              const sel = actual === op.valor;
                              return (
                                <button
                                  key={op.valor}
                                  type="button"
                                  aria-pressed={sel}
                                  onClick={() => responder(sec.nombre, p.texto, op.valor)}
                                  className={`min-h-[34px] rounded-md px-3 text-xs font-semibold transition-colors ${
                                    sel
                                      ? op.valor === "si"
                                        ? "bg-success-soft text-success"
                                        : op.valor === "no"
                                          ? "bg-danger-soft text-danger"
                                          : "bg-surface text-muted"
                                      : "text-muted hover:text-foreground"
                                  }`}
                                >
                                  {op.texto}
                                </button>
                              );
                            })}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* 6. Fotos */}
      <div>
        <Label>Fotos de respaldo</Label>
        <div className="rounded-lg border border-dashed border-border bg-surface-sunken p-4 text-center">
          <p className="text-[13px] text-muted">Arrastra fotos aquí o</p>
          <Button type="button" variant="outline" size="sm" className="mt-2" onClick={() => fileGeneral.current?.click()}>
            <IconCamera className="h-4 w-4" />
            Seleccionar
          </Button>
        </div>
        {fotos.length > 0 && (
          <ul className="mt-3 flex flex-wrap gap-2">
            {fotos.map((f, i) => (
              <li key={i} className="relative">
                <div className="flex h-[66px] w-[88px] items-center justify-center overflow-hidden rounded-sm border border-border bg-surface">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={URL.createObjectURL(f.file)} alt={f.item ?? "Foto general"} className="h-full w-full object-cover" />
                </div>
                {f.item && (
                  <span className="absolute inset-x-0 bottom-0 truncate bg-black/55 px-1 text-[9px] text-white">{f.item}</span>
                )}
                <button
                  type="button"
                  aria-label="Quitar foto"
                  onClick={() => setFotos((prev) => prev.filter((_, j) => j !== i))}
                  className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-danger text-white"
                >
                  <IconX className="h-2.5 w-2.5" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* 7. Observaciones */}
      <div>
        <Label>Observaciones</Label>
        <Textarea rows={6} value={observaciones} onChange={(e) => setObservaciones(e.target.value)} />
      </div>

      {error && (
        <p role="alert" className="rounded-lg border-l-[3px] border-danger bg-danger-soft px-3 py-2 text-sm font-medium text-danger">
          {error}
        </p>
      )}

      {/* 8. Pie */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
        <p className="text-[13px] text-muted">{ayudaBloqueo}</p>
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={onListo}>
            Cancelar
          </Button>
          <Button type="button" onClick={onSubmit} disabled={bloqueado || guardando}>
            {guardando ? "Guardando…" : "Guardar registro"}
          </Button>
        </div>
      </div>
    </div>
  );
}
