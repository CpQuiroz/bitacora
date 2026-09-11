"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Camera, Eye, Plus, Receipt, Truck, X } from "lucide-react";
import type { Equipo, Proveedor, RegistroMantencionEquipo, RespuestaChecklistMantencion } from "@bitacora/shared";
import { MANTENCION_EXIGE_FOTO_EN_NO } from "@bitacora/shared";
import { apiFetch } from "@/lib/api";
import { comprimirImagen } from "@/lib/comprimirImagen";
import { abrirPdfRegistroMantencion } from "@/lib/descargarPdf";
import { Button, Cifra, EmptyState, ErrorState, LoadingState, Select, Textarea } from "@bitacora/ui/web";
import { Modal } from "@/components/Modal";
import { SelectCrear } from "@/components/SelectCrear";

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
const respuestaTexto: Record<RespuestaChecklistMantencion, string> = { si: "Sí", no: "No", na: "N/A" };

const clave = (s: string, i: string) => `${s}||${i}`;
const fechaCL = (iso: string | null | undefined) => {
  if (!iso) return "—";
  const [y, m, d] = iso.slice(0, 10).split("-");
  return d && m && y ? `${d}-${m}-${y}` : iso;
};
const tieneNovedad = (checklist: RegistroMantencionEquipo["checklist"]) =>
  Array.isArray(checklist) && checklist.some((c) => c.respuesta === "no");

// PASO 6 (sistema de diseño) — migrado. Ver docs/design-system.md.
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
  const [detalleId, setDetalleId] = useState<string | null>(null);

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
      <div className="rounded-[32px] border border-ds-divider bg-ds-surface p-ds-5 font-ds-body text-ds-small text-ds-text/70">
        El historial de mantención lo ven Administración y Supervisión. Desde la app, el chofer registra el
        chequeo diario de su vehículo.
      </div>
    );
  }

  return (
    <div className="rounded-[32px] border border-ds-divider bg-ds-surface">
      {/* Barra de filtros */}
      <div className="flex flex-wrap items-end gap-ds-3 border-b border-ds-divider p-ds-5">
        <div className="w-40">
          <Select etiqueta="Tipo" valor={tipo} onCambio={(v) => setTipo(v as FiltroTipo)} opciones={[{ valor: "", etiqueta: "Todos" }, { valor: "diario", etiqueta: "Diario" }, { valor: "programa", etiqueta: "Programa" }]} />
        </div>
        <div className="flex flex-col gap-ds-1">
          <label className="font-ds-body text-ds-caption font-medium text-ds-text/70">Desde</label>
          <input
            type="date"
            value={desde}
            onChange={(e) => setDesde(e.target.value)}
            className="h-10 rounded-ds-md border border-ds-divider bg-ds-surface px-ds-3 font-ds-body text-ds-small text-ds-text focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ds-brand)]"
          />
        </div>
        <div className="flex flex-col gap-ds-1">
          <label className="font-ds-body text-ds-caption font-medium text-ds-text/70">Hasta</label>
          <input
            type="date"
            value={hasta}
            onChange={(e) => setHasta(e.target.value)}
            className="h-10 rounded-ds-md border border-ds-divider bg-ds-surface px-ds-3 font-ds-body text-ds-small text-ds-text focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ds-brand)]"
          />
        </div>
        <span className="ml-auto self-center font-ds-body text-[11px] uppercase tracking-[0.1em] text-ds-text/60">
          {registros ? `${registros.length} registro${registros.length === 1 ? "" : "s"}` : "…"}
        </span>
        <Button iconoIzq={<Plus size={16} strokeWidth={2.75} />} onPress={() => setModalAbierto(true)}>
          Nuevo registro
        </Button>
      </div>

      {/* Tabla / estados */}
      <div className="p-ds-5">
        {registros === null && !error ? (
          <LoadingState />
        ) : error ? (
          <ErrorState mensaje={error} onReintentar={cargar} />
        ) : registros && registros.length === 0 ? (
          <EmptyState
            icono={<Truck size={28} strokeWidth={2.75} />}
            titulo="Todavía no hay registros de mantención para este vehículo"
            mensaje="Registra el chequeo diario o el Programa de Mantención para empezar el historial."
            accion={
              <Button iconoIzq={<Plus size={16} strokeWidth={2.75} />} onPress={() => setModalAbierto(true)}>
                Nuevo registro
              </Button>
            }
          />
        ) : (
          <div className="overflow-x-auto rounded-ds-md border border-ds-divider">
            <table className="w-full text-left text-ds-body">
              <thead>
                <tr className="border-b border-ds-divider text-[11px] font-medium uppercase tracking-[0.08em] text-ds-text/60">
                  <th className="px-ds-4 py-ds-3">Fecha</th>
                  <th className="px-ds-4 py-ds-3">Tipo</th>
                  <th className="px-ds-4 py-ds-3">Origen</th>
                  <th className="px-ds-4 py-ds-3">Realizado por</th>
                  <th className="px-ds-4 py-ds-3">Km / Horas</th>
                  <th className="px-ds-4 py-ds-3">Estado</th>
                  <th className="px-ds-4 py-ds-3">PDF</th>
                </tr>
              </thead>
              <tbody>
                {(registros ?? []).map((r) => {
                  const nov = tieneNovedad(r.checklist);
                  const quien =
                    r.origen === "externo" ? (r.proveedor?.nombre ?? "Taller externo") : (r.responsable?.nombre ?? "—");
                  return (
                    <tr key={r.id} className="border-b border-ds-text/[0.08] last:border-0 even:bg-ds-text/[0.02] hover:bg-ds-text/[0.04]">
                      <td className="px-ds-4 py-ds-3">
                        <Cifra>{fechaCL(r.fecha)}</Cifra>
                      </td>
                      <td className="px-ds-4 py-ds-3">
                        <span className={`inline-block rounded-ds-sm px-2 py-0.5 text-[11px] font-semibold ${r.tipo === "programa" ? "bg-ds-brand/[0.08] text-ds-brand" : "bg-ds-text/[0.05] text-ds-text/60"}`}>
                          {r.tipo === "programa" ? "Programa" : "Diario"}
                        </span>
                      </td>
                      <td className="px-ds-4 py-ds-3 text-ds-text/70">{r.origen === "externo" ? "Taller externo" : "Interno"}</td>
                      <td className="px-ds-4 py-ds-3 text-ds-text">{quien}</td>
                      <td className="px-ds-4 py-ds-3">
                        <Cifra>
                          {r.kilometraje != null ? `${Number(r.kilometraje).toLocaleString("es-CL")} km` : "—"}
                          {r.horas_motor != null ? ` · ${Number(r.horas_motor).toLocaleString("es-CL")} h` : ""}
                        </Cifra>
                      </td>
                      <td className="px-ds-4 py-ds-3">
                        <span className={`inline-block rounded-ds-sm px-2 py-0.5 text-[11px] font-semibold ${nov ? "bg-ds-accent-100 text-ds-accent-800" : "bg-ds-accent2-100 text-ds-accent2-800"}`}>
                          {nov ? "Con novedades" : "Sin novedades"}
                        </span>
                      </td>
                      <td className="px-ds-4 py-ds-3">
                        <div className="flex gap-ds-2">
                          <button
                            type="button"
                            onClick={() => setDetalleId(r.id)}
                            aria-label="Ver detalle y fotos"
                            className="flex h-7 w-7 items-center justify-center rounded-ds-sm border border-ds-divider text-ds-text/60 transition-colors hover:border-ds-brand hover:text-ds-brand"
                          >
                            <Eye size={16} strokeWidth={2.75} />
                          </button>
                          <button
                            type="button"
                            onClick={() => abrirPdfRegistroMantencion(equipo.id, r.id)}
                            aria-label="Ver PDF del registro"
                            className="flex h-7 w-7 items-center justify-center rounded-ds-sm border border-ds-divider text-ds-text/60 transition-colors hover:border-ds-brand hover:text-ds-brand"
                          >
                            <Receipt size={16} strokeWidth={2.75} />
                          </button>
                        </div>
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

      <Modal open={detalleId != null} onClose={() => setDetalleId(null)} title="Detalle del registro" xl>
        {detalleId && <DetalleRegistro equipoId={equipo.id} registroId={detalleId} onCambio={cargar} />}
      </Modal>
    </div>
  );
}

// ============================================================
// Detalle de un registro ya creado — checklist + fotos (agregar/
// eliminar). El registro en sí (checklist, km, firma) sigue sin poder
// editarse acá; solo las fotos de respaldo, a pedido de la usuaria
// (2026-09-11).
// ============================================================
type FotoDetalle = { id: string; url: string; item: string | null; creado_en: string };
type DetalleRegistroData = RegistroConRelaciones & { fotos: FotoDetalle[]; firma_url_firmada: string | null };

function DetalleRegistro({ equipoId, registroId, onCambio }: { equipoId: string; registroId: string; onCambio: () => void }) {
  const [datos, setDatos] = useState<DetalleRegistroData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [subiendo, setSubiendo] = useState(false);
  const [eliminandoId, setEliminandoId] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const cargar = useCallback(async () => {
    setError(null);
    const res = await apiFetch(`/api/equipos/${equipoId}/registros-mantencion/${registroId}`);
    if (!res.ok) {
      setError("No se pudo cargar el detalle del registro.");
      return;
    }
    setDatos(await res.json());
  }, [equipoId, registroId]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  async function subirFoto(archivo: File) {
    setSubiendo(true);
    setError(null);
    const fd = new FormData();
    fd.append("foto", archivo);
    const res = await apiFetch(`/api/equipos/${equipoId}/registros-mantencion/${registroId}/fotos`, { method: "POST", body: fd });
    setSubiendo(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "No se pudo subir la foto");
      return;
    }
    await cargar();
    onCambio();
  }

  async function eliminarFoto(fotoId: string) {
    if (!window.confirm("¿Eliminar esta foto de respaldo?")) return;
    setEliminandoId(fotoId);
    const res = await apiFetch(`/api/equipos/${equipoId}/registros-mantencion/${registroId}/fotos/${fotoId}`, { method: "DELETE" });
    setEliminandoId(null);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "No se pudo eliminar la foto");
      return;
    }
    await cargar();
    onCambio();
  }

  if (error && !datos) return <ErrorState mensaje={error} onReintentar={cargar} />;
  if (!datos) return <LoadingState />;

  // Agrupa el checklist por sección, respetando el orden de aparición.
  const ordenSecciones: string[] = [];
  const porSeccion = new Map<string, typeof datos.checklist>();
  for (const it of datos.checklist ?? []) {
    if (!porSeccion.has(it.seccion)) {
      porSeccion.set(it.seccion, []);
      ordenSecciones.push(it.seccion);
    }
    porSeccion.get(it.seccion)!.push(it);
  }

  return (
    <div className="flex flex-col gap-ds-5">
      <div className="grid gap-ds-3 sm:grid-cols-2">
        <div>
          <p className="font-ds-body text-ds-caption font-medium text-ds-text/70">Fecha</p>
          <p className="font-ds-body text-ds-small text-ds-text">{fechaCL(datos.fecha)}</p>
        </div>
        <div>
          <p className="font-ds-body text-ds-caption font-medium text-ds-text/70">Tipo</p>
          <p className="font-ds-body text-ds-small text-ds-text">{datos.tipo === "programa" ? "Programa" : "Diario"} · {datos.origen === "externo" ? (datos.proveedor?.nombre ?? "Taller externo") : (datos.responsable?.nombre ?? "—")}</p>
        </div>
        <div>
          <p className="font-ds-body text-ds-caption font-medium text-ds-text/70">Kilometraje / horas motor</p>
          <p className="font-ds-body text-ds-small text-ds-text">
            {datos.kilometraje != null ? `${Number(datos.kilometraje).toLocaleString("es-CL")} km` : "—"}
            {datos.horas_motor != null ? ` · ${Number(datos.horas_motor).toLocaleString("es-CL")} h` : ""}
          </p>
        </div>
        {datos.observaciones && (
          <div className="sm:col-span-2">
            <p className="font-ds-body text-ds-caption font-medium text-ds-text/70">Observaciones</p>
            <p className="font-ds-body text-ds-small text-ds-text">{datos.observaciones}</p>
          </div>
        )}
      </div>

      <div>
        <p className="mb-ds-2 font-ds-body text-ds-small font-semibold text-ds-text">Checklist</p>
        <div className="flex flex-col gap-ds-3">
          {ordenSecciones.map((seccion) => (
            <div key={seccion}>
              <p className="mb-ds-1 font-ds-body text-ds-caption font-semibold uppercase tracking-wide text-ds-text/60">{seccion}</p>
              <div className="flex flex-col gap-1">
                {porSeccion.get(seccion)!.map((it, i) => (
                  <div key={i} className="flex items-center justify-between gap-ds-3 font-ds-body text-ds-small">
                    <span className="text-ds-text">{it.item}</span>
                    <span
                      className={`rounded-ds-sm px-2 py-0.5 text-[11px] font-semibold ${
                        it.respuesta === "no" ? "bg-ds-accent-100 text-ds-accent-800" : it.respuesta === "si" ? "bg-ds-accent2-100 text-ds-accent2-800" : "bg-ds-text/[0.06] text-ds-text/60"
                      }`}
                    >
                      {respuestaTexto[it.respuesta]}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div>
        <div className="mb-ds-2 flex items-center justify-between">
          <p className="font-ds-body text-ds-small font-semibold text-ds-text">Fotos de respaldo</p>
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(e) => {
              const archivo = e.target.files?.[0];
              if (archivo) subirFoto(archivo);
              e.target.value = "";
            }}
          />
          <Button variante="secundario" tamano="sm" iconoIzq={<Camera size={16} strokeWidth={2.75} />} cargando={subiendo} onPress={() => fileRef.current?.click()}>
            Agregar foto
          </Button>
        </div>
        {datos.fotos.length > 0 ? (
          <div className="grid grid-cols-3 gap-ds-3 sm:grid-cols-4">
            {datos.fotos.map((f) => (
              <div key={f.id} className="group relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <a href={f.url} target="_blank" rel="noopener noreferrer">
                  <img src={f.url} alt={f.item ?? "Foto de respaldo"} className="aspect-square w-full rounded-ds-md border border-ds-divider object-cover" />
                </a>
                {f.item && <span className="absolute inset-x-0 bottom-0 truncate rounded-b-ds-md bg-ds-text/[0.7] px-1.5 py-0.5 text-[10px] text-white">{f.item}</span>}
                <button
                  type="button"
                  onClick={() => eliminarFoto(f.id)}
                  disabled={eliminandoId === f.id}
                  className="absolute right-1.5 top-1.5 rounded-ds-pill bg-ds-accent-700 px-2 py-0.5 font-ds-body text-[11px] font-medium text-white opacity-0 transition-opacity group-hover:opacity-100 disabled:opacity-50"
                >
                  {eliminandoId === f.id ? "…" : "Eliminar"}
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="font-ds-body text-ds-small text-ds-text/70">Todavía no hay fotos de respaldo.</p>
        )}
      </div>

      {error ? <p className="font-ds-body text-ds-small text-ds-accent-700">{error}</p> : null}
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
      // Sin equipoId a propósito: la ruta es /api/equipos/registros-mantencion/plantilla
      // (registrosMantencion.ts la registra ANTES de las rutas con :equipoId
      // justamente para no chocar con ellas). Bug real encontrado en vivo
      // (2026-09-11): esto tenía ${equipo.id} de más, matcheaba contra
      // GET /:equipoId/registros-mantencion/:id con id="plantilla" y
      // rompía con 500 (uuid inválido) — el modal de "Nuevo registro"
      // nunca llegaba a cargar, así que tampoco se podía subir una foto.
      const [resP, resProv] = await Promise.all([
        apiFetch(`/api/equipos/registros-mantencion/plantilla`),
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

  if (cargando) return <LoadingState />;
  if (errorCarga || !plantilla) return <ErrorState mensaje={errorCarga ?? "No se pudo cargar el formulario."} />;

  const todasAbiertas = abiertas.size === plantilla.secciones.length;

  return (
    <div className="flex flex-col gap-ds-5">
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
      <div className="grid gap-ds-3 rounded-ds-md border border-ds-divider bg-ds-text/[0.03] p-ds-4 sm:grid-cols-3">
        {[
          ["Patente", equipo.patente ?? "—"],
          ["Marca / modelo", [equipo.marca, equipo.modelo].filter(Boolean).join(" ") || equipo.nombre],
          ["Tipo de vehículo", equipo.tipo_vehiculo ?? equipo.categoria ?? "—"],
        ].map(([k, v]) => (
          <div key={k}>
            <p className="font-ds-body text-[10px] uppercase tracking-[0.12em] text-ds-text/60">{k}</p>
            <p className="mt-0.5 font-ds-body text-ds-small font-semibold text-ds-text">{v}</p>
          </div>
        ))}
      </div>

      {/* 2. Tipo */}
      <fieldset>
        <legend className="mb-ds-1 font-ds-body text-[13px] font-semibold text-ds-text">Tipo de registro</legend>
        <div className="flex flex-wrap gap-ds-2">
          {([
            { v: "diario", t: "Chequeo diario" },
            { v: "programa", t: "Programa de mantención" },
          ] as const).map((o) => (
            <button
              key={o.v}
              type="button"
              aria-pressed={tipo === o.v}
              onClick={() => setTipo(o.v)}
              className={`h-11 rounded-ds-md border px-ds-4 font-ds-body text-ds-small font-medium transition-colors ${
                tipo === o.v ? "border-[1.5px] border-ds-brand bg-ds-brand/[0.08] text-ds-brand" : "border-ds-divider bg-ds-surface text-ds-text hover:border-ds-text/30"
              }`}
            >
              {o.t}
            </button>
          ))}
        </div>
        <p className="mt-ds-1 font-ds-body text-[13px] text-ds-text/60">
          {tipo === "diario"
            ? "Lo hace el chofer antes de salir a ruta. Queda como interno."
            : "Cada 250 h o 6 meses, en un taller o lubricentro autorizado."}
        </p>
      </fieldset>

      {/* 3. Km / Horas / Fecha */}
      <div className="grid gap-ds-3 sm:grid-cols-3">
        <div>
          <label htmlFor="rm-km" className="mb-ds-1 block font-ds-body text-[13px] font-semibold text-ds-text">
            Kilometraje
          </label>
          <input
            id="rm-km"
            inputMode="numeric"
            value={kilometraje}
            onChange={(e) => setKilometraje(e.target.value.replace(/[^\d]/g, ""))}
            className="h-10 w-full rounded-ds-md border border-ds-divider bg-ds-surface px-ds-3 font-ds-body text-ds-small tabular-nums text-ds-text focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ds-brand)]"
            placeholder="412860"
          />
        </div>
        <div>
          <label htmlFor="rm-horas" className="mb-ds-1 block font-ds-body text-[13px] font-semibold text-ds-text">
            Horas motor
          </label>
          <input
            id="rm-horas"
            inputMode="numeric"
            value={horasMotor}
            onChange={(e) => setHorasMotor(e.target.value.replace(/[^\d]/g, ""))}
            className="h-10 w-full rounded-ds-md border border-ds-divider bg-ds-surface px-ds-3 font-ds-body text-ds-small tabular-nums text-ds-text focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ds-brand)]"
            placeholder="6120"
          />
        </div>
        <div>
          <label htmlFor="rm-fecha" className="mb-ds-1 block font-ds-body text-[13px] font-semibold text-ds-text">
            Fecha
          </label>
          <input
            id="rm-fecha"
            type="date"
            max={new Date().toISOString().slice(0, 10)}
            value={fecha}
            onChange={(e) => setFecha(e.target.value)}
            className="h-10 w-full rounded-ds-md border border-ds-divider bg-ds-surface px-ds-3 font-ds-body text-ds-small text-ds-text focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ds-brand)]"
          />
        </div>
      </div>

      {/* 4. Taller (solo Programa) */}
      {tipo === "programa" && (
        <div className="flex flex-col gap-ds-1">
          <label className="font-ds-body text-ds-caption font-medium text-ds-text/70">Taller / lubricentro</label>
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
        <div className="mb-ds-2 flex flex-wrap items-center justify-between gap-ds-2">
          <p className="font-ds-body text-[13px] font-semibold text-ds-text">
            Checklist — <Cifra>{respondidos} de {totalItems}</Cifra> ítems respondidos
          </p>
          <button
            type="button"
            onClick={() =>
              setAbiertas(todasAbiertas ? new Set() : new Set(plantilla.secciones.map((_, i) => i)))
            }
            className="font-ds-body text-ds-caption font-medium text-ds-brand hover:underline"
          >
            {todasAbiertas ? "Colapsar todo" : "Expandir todo"}
          </button>
        </div>

        <div className="flex flex-col gap-ds-2">
          {plantilla.secciones.map((sec, idx) => {
            const abierta = abiertas.has(idx);
            const enSeccion = sec.preguntas.filter((p) => respuestas[clave(sec.nombre, p.texto)]).length;
            const completa = enSeccion === sec.preguntas.length;
            return (
              <div key={sec.nombre} className="overflow-hidden rounded-ds-md border border-ds-divider">
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
                  className="flex min-h-[46px] w-full items-center gap-ds-3 bg-ds-text/[0.03] px-ds-3 text-left font-ds-body text-ds-small font-semibold text-ds-text"
                >
                  <span
                    className={`grid h-[22px] w-[22px] shrink-0 place-items-center rounded-ds-sm text-xs font-bold ${
                      completa ? "bg-ds-accent2-100 text-ds-accent2-800" : "bg-ds-brand text-ds-brand-foreground"
                    }`}
                  >
                    {idx + 1}
                  </span>
                  <span className="flex-1">{sec.nombre}</span>
                  <span
                    className={`rounded-ds-pill px-2 py-0.5 text-[11px] font-semibold tabular-nums ${
                      completa ? "bg-ds-accent2-100 text-ds-accent2-800" : "bg-ds-surface text-ds-text/60"
                    }`}
                  >
                    {enSeccion}/{sec.preguntas.length}
                  </span>
                  <ChevronDown size={16} strokeWidth={2.75} className={`text-ds-text/60 transition-transform ${abierta ? "rotate-180" : ""}`} />
                </button>
                {abierta && (
                  <div className="flex flex-col divide-y divide-ds-divider px-ds-3">
                    {sec.preguntas.map((p) => {
                      const actual = respuestas[clave(sec.nombre, p.texto)];
                      const necesitaFoto =
                        MANTENCION_EXIGE_FOTO_EN_NO &&
                        actual === "no" &&
                        !fotos.some((f) => f.item === p.texto);
                      return (
                        <div key={p.texto} className="flex flex-wrap items-center gap-x-ds-3 gap-y-2 py-2.5">
                          <span className="min-w-[10rem] flex-1 font-ds-body text-ds-small text-ds-text">{p.texto}</span>
                          {necesitaFoto && (
                            <span className="rounded-ds-sm bg-ds-accent-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-ds-accent-800">
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
                              className="font-ds-body text-ds-caption font-medium text-ds-brand hover:underline"
                            >
                              + Foto{fotos.filter((f) => f.item === p.texto).length ? ` (${fotos.filter((f) => f.item === p.texto).length})` : ""}
                            </button>
                          )}
                          <span role="group" aria-label={p.texto} className="inline-flex overflow-hidden rounded-ds-md border border-ds-divider bg-ds-text/[0.03] p-0.5">
                            {OPCIONES.map((op) => {
                              const sel = actual === op.valor;
                              return (
                                <button
                                  key={op.valor}
                                  type="button"
                                  aria-pressed={sel}
                                  onClick={() => responder(sec.nombre, p.texto, op.valor)}
                                  className={`min-h-[34px] rounded-ds-sm px-ds-3 text-xs font-semibold transition-colors ${
                                    sel
                                      ? op.valor === "si"
                                        ? "bg-ds-accent2-100 text-ds-accent2-800"
                                        : op.valor === "no"
                                          ? "bg-ds-accent-100 text-ds-accent-800"
                                          : "bg-ds-surface text-ds-text/60"
                                      : "text-ds-text/60 hover:text-ds-text"
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
        <p className="mb-ds-1 font-ds-body text-ds-caption font-medium text-ds-text/70">Fotos de respaldo</p>
        <div className="rounded-ds-md border border-dashed border-ds-divider bg-ds-text/[0.03] p-ds-4 text-center">
          <p className="font-ds-body text-[13px] text-ds-text/60">Arrastra fotos aquí o</p>
          <div className="mt-ds-2">
            <Button variante="secundario" tamano="sm" iconoIzq={<Camera size={16} strokeWidth={2.75} />} onPress={() => fileGeneral.current?.click()}>
              Seleccionar
            </Button>
          </div>
        </div>
        {fotos.length > 0 && (
          <ul className="mt-ds-3 flex flex-wrap gap-ds-2">
            {fotos.map((f, i) => (
              <li key={i} className="relative">
                <div className="flex h-[66px] w-[88px] items-center justify-center overflow-hidden rounded-ds-sm border border-ds-divider bg-ds-surface">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={URL.createObjectURL(f.file)} alt={f.item ?? "Foto general"} className="h-full w-full object-cover" />
                </div>
                {f.item && (
                  <span className="absolute inset-x-0 bottom-0 truncate bg-ds-text/[0.7] px-1 text-[9px] text-white">{f.item}</span>
                )}
                <button
                  type="button"
                  aria-label="Quitar foto"
                  onClick={() => setFotos((prev) => prev.filter((_, j) => j !== i))}
                  className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-ds-pill bg-ds-accent-700 text-white"
                >
                  <X size={10} strokeWidth={2.75} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* 7. Observaciones */}
      <Textarea etiqueta="Observaciones" filas={6} valor={observaciones} onCambio={setObservaciones} />

      {error ? (
        <p role="alert" className="rounded-ds-md border-l-[3px] border-ds-accent-700 bg-ds-accent-100 px-ds-3 py-ds-2 font-ds-body text-ds-small font-medium text-ds-accent-800">
          {error}
        </p>
      ) : null}

      {/* 8. Pie */}
      <div className="flex flex-wrap items-center justify-between gap-ds-3 border-t border-ds-divider pt-ds-4">
        <p className="font-ds-body text-[13px] text-ds-text/60">{ayudaBloqueo}</p>
        <div className="flex gap-ds-2">
          <Button variante="secundario" onPress={onListo}>
            Cancelar
          </Button>
          <Button onPress={onSubmit} deshabilitado={bloqueado || guardando} cargando={guardando}>
            Guardar registro
          </Button>
        </div>
      </div>
    </div>
  );
}
