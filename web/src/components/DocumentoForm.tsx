"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { Paperclip, Plus } from "lucide-react";
import type { Documento, EntidadDocumento, EstadoDocumento, TipoDocumento } from "@bitacora/shared";
import { apiFetch } from "@/lib/api";
import { Button, Card, Input, Select, StatusBadge, type TonoEstado } from "@bitacora/ui/web";

type DocumentoConTipo = Documento & { tipo: { nombre: string } | null; estado: EstadoDocumento | null };

// "por_vencer" no está en MAPA_ESTADO_TONO (ambiguo a propósito).
const TONO_FORZADO: Partial<Record<EstadoDocumento, TonoEstado>> = { por_vencer: "en_progreso" };

// Campo con label asociado (htmlFor/id) — mismo estilo que <label> del
// design system, pero enlazado al control para accesibilidad.
function Campo({ label, htmlFor, children }: { label: string; htmlFor: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-ds-1">
      <label htmlFor={htmlFor} className="font-ds-body text-ds-caption font-medium text-ds-text/70">
        {label}
      </label>
      {children}
    </div>
  );
}

// Editor + listado de documentos de UN colaborador o vehículo — mismo
// componente para ambas entidades (no hay dos implementaciones
// paralelas), reutilizado en Flota > Colaboradores, Flota > Vehículos y
// Mis Documentos (self-service, con soloLectura parcial).
//
// PASO 6 (sistema de diseño) — migrado. Ver docs/design-system.md.
export function DocumentoForm({ entidadTipo, entidadId }: { entidadTipo: EntidadDocumento; entidadId: string }) {
  const [tipos, setTipos] = useState<TipoDocumento[]>([]);
  const [tiposCargados, setTiposCargados] = useState(false);
  const [documentos, setDocumentos] = useState<DocumentoConTipo[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [formAbierto, setFormAbierto] = useState(false);
  // null = el formulario crea; un id = edita ese documento.
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [tipoId, setTipoId] = useState("");
  const [numero, setNumero] = useState("");
  const [fechaEmision, setFechaEmision] = useState("");
  const [fechaVencimiento, setFechaVencimiento] = useState("");
  const [archivo, setArchivo] = useState<File | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [errorForm, setErrorForm] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setError(null);
    const [resTipos, resDocs] = await Promise.all([
      apiFetch("/api/tipos-documento"),
      apiFetch(`/api/documentos?entidad_tipo=${entidadTipo}&entidad_id=${entidadId}`),
    ]);
    if (resTipos.ok) {
      const todos: TipoDocumento[] = await resTipos.json();
      setTipos(todos.filter((t) => t.activo && (t.aplica_a === entidadTipo || t.aplica_a === "ambos")));
      setTiposCargados(true);
    }
    if (!resDocs.ok) {
      setError("No se pudieron cargar los documentos");
      return;
    }
    setDocumentos(await resDocs.json());
  }, [entidadTipo, entidadId]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  function resetCampos() {
    setEditandoId(null);
    setTipoId("");
    setNumero("");
    setFechaEmision("");
    setFechaVencimiento("");
    setArchivo(null);
    setErrorForm(null);
  }

  function limpiarForm() {
    setFormAbierto(false);
    resetCampos();
  }

  function toggleForm() {
    if (formAbierto) {
      limpiarForm();
    } else {
      resetCampos();
      setFormAbierto(true);
    }
  }

  function abrirEdicion(d: DocumentoConTipo) {
    setEditandoId(d.id);
    setTipoId(d.tipo_documento_id);
    setNumero(d.numero ?? "");
    setFechaEmision(d.fecha_emision ?? "");
    setFechaVencimiento(d.fecha_vencimiento ?? "");
    setArchivo(null);
    setErrorForm(null);
    setFormAbierto(true);
  }

  async function onGuardar() {
    setErrorForm(null);
    if (!tipoId) {
      setErrorForm("Selecciona un tipo de documento");
      return;
    }
    setGuardando(true);

    const form = new FormData();
    form.append("tipo_documento_id", tipoId);
    form.append("numero", numero);
    form.append("fecha_emision", fechaEmision);
    form.append("fecha_vencimiento", fechaVencimiento);
    // Solo se manda el archivo si el usuario eligió uno nuevo; en edición
    // sin archivo, el backend conserva el actual.
    if (archivo) form.append("archivo", archivo);

    let res: Response;
    if (editandoId) {
      res = await apiFetch(`/api/documentos/${editandoId}`, { method: "PATCH", body: form });
    } else {
      form.append("entidad_tipo", entidadTipo);
      form.append("entidad_id", entidadId);
      res = await apiFetch("/api/documentos", { method: "POST", body: form });
    }

    setGuardando(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setErrorForm(body.error ?? "No se pudo guardar el documento");
      return;
    }
    limpiarForm();
    cargar();
  }

  async function onEliminar(id: string) {
    const res = await apiFetch(`/api/documentos/${id}`, { method: "DELETE" });
    if (res.ok) cargar();
  }

  async function onVerArchivo(id: string) {
    const res = await apiFetch(`/api/documentos/${id}/archivo`);
    if (!res.ok) return;
    const { url } = await res.json();
    window.open(url, "_blank");
  }

  const editando = editandoId !== null;
  const accionCls = "inline-flex min-h-[44px] items-center px-ds-2 hover:underline";

  return (
    <Card>
      <div className="mb-ds-4 flex items-center justify-between">
        <p className="flex items-center gap-ds-2 font-ds-body text-ds-small font-semibold text-ds-text">
          <Paperclip size={16} strokeWidth={2.75} className="text-ds-brand" />
          Documentos
        </p>
        <Button variante="secundario" iconoIzq={<Plus size={16} strokeWidth={2.75} />} onPress={toggleForm}>
          {formAbierto ? "Cancelar" : "Agregar documento"}
        </Button>
      </div>

      {formAbierto && tiposCargados && tipos.length === 0 && (
        <div className="mb-ds-4 rounded-ds-md border border-ds-divider bg-ds-brand/[0.06] p-ds-4 font-ds-body text-ds-small">
          <p className="font-medium text-ds-text">
            No hay tipos de documento configurados para {entidadTipo === "vehiculo" ? "vehículos" : "colaboradores"}.
          </p>
          <p className="mt-ds-1 text-ds-text/70">
            Creá al menos uno en{" "}
            <Link href="/dashboard/configuracion/tipos-documento" className="font-medium text-ds-brand hover:underline">
              Configuración → Tipos de Documento
            </Link>{" "}
            y después volvé acá para adjuntarlo.
          </p>
        </div>
      )}

      {formAbierto && tipos.length > 0 && (
        <div className="mb-ds-4 rounded-ds-md border border-ds-divider p-ds-4">
          <p className="mb-ds-3 font-ds-body text-ds-small font-semibold text-ds-text">{editando ? "Editar documento" : "Nuevo documento"}</p>
          <div className="grid gap-ds-4 sm:grid-cols-2">
            {/* Select (ds-) no acepta `id` — su <label> interno no queda
                enlazado por htmlFor a este <Campo>, a diferencia del resto
                de campos nativos de este form (impacto visual nulo, mismo
                layout; el gap real es de accesibilidad). */}
            <Campo label="Tipo de documento" htmlFor="doc-tipo">
              <Select valor={tipoId} onCambio={setTipoId} opciones={[{ valor: "", etiqueta: "Selecciona…" }, ...tipos.map((t) => ({ valor: t.id, etiqueta: t.nombre }))]} />
            </Campo>
            <Campo label="Número (opcional)" htmlFor="doc-numero">
              <Input valor={numero} onCambio={setNumero} />
            </Campo>
            <Campo label="Fecha de emisión" htmlFor="doc-emision">
              <input
                id="doc-emision"
                type="date"
                value={fechaEmision}
                onChange={(e) => setFechaEmision(e.target.value)}
                className="h-11 w-full rounded-ds-md border border-ds-divider bg-ds-surface px-ds-3 font-ds-body text-ds-body text-ds-text transition-colors hover:border-ds-text/30 focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ds-brand)]"
              />
            </Campo>
            <Campo label="Fecha de vencimiento" htmlFor="doc-vencimiento">
              <input
                id="doc-vencimiento"
                type="date"
                value={fechaVencimiento}
                onChange={(e) => setFechaVencimiento(e.target.value)}
                className="h-11 w-full rounded-ds-md border border-ds-divider bg-ds-surface px-ds-3 font-ds-body text-ds-body text-ds-text transition-colors hover:border-ds-text/30 focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ds-brand)]"
              />
            </Campo>
            <div className="sm:col-span-2">
              <label htmlFor="doc-archivo" className="mb-ds-1 block font-ds-body text-ds-caption font-medium text-ds-text/70">
                {editando ? "Reemplazar archivo (imagen o PDF, opcional)" : "Archivo (imagen o PDF, opcional)"}
              </label>
              <input
                id="doc-archivo"
                type="file"
                accept="image/jpeg,image/png,image/webp,application/pdf"
                onChange={(e) => setArchivo(e.target.files?.[0] ?? null)}
                className="block w-full font-ds-body text-ds-small text-ds-text/70 file:mr-ds-3 file:rounded-ds-pill file:border-0 file:bg-ds-brand/[0.08] file:px-ds-3 file:py-2 file:font-ds-body file:text-ds-small file:font-medium file:text-ds-brand"
              />
              {editando && <p className="mt-ds-1 font-ds-body text-ds-caption text-ds-text/60">Si no subís uno nuevo, se mantiene el archivo actual.</p>}
            </div>
          </div>
          {errorForm ? <p className="mt-ds-3 font-ds-body text-ds-small text-ds-accent-700">{errorForm}</p> : null}
          <div className="mt-ds-4">
            <Button onPress={onGuardar} cargando={guardando}>
              {editando ? "Guardar cambios" : "Guardar documento"}
            </Button>
          </div>
        </div>
      )}

      {error ? <p className="font-ds-body text-ds-small text-ds-accent-700">{error}</p> : null}
      {documentos === null && !error && <p className="font-ds-body text-ds-small text-ds-text/70">Cargando…</p>}
      {documentos?.length === 0 && <p className="font-ds-body text-ds-small text-ds-text/70">Sin documentos registrados.</p>}

      {documentos && documentos.length > 0 && (
        <table className="w-full text-left text-ds-body">
          <thead>
            <tr className="border-b border-ds-divider text-ds-caption text-ds-text/60">
              <th className="py-ds-2 font-medium">Tipo</th>
              <th className="py-ds-2 font-medium">Número</th>
              <th className="py-ds-2 font-medium">Vence</th>
              <th className="py-ds-2 font-medium">Estado</th>
              <th className="py-ds-2 font-medium" />
            </tr>
          </thead>
          <tbody>
            {documentos.map((d) => (
              <tr key={d.id} className="border-b border-ds-divider last:border-0">
                <td className="py-2.5 font-medium text-ds-text">{d.tipo?.nombre ?? "—"}</td>
                <td className="py-2.5 text-ds-text/70">{d.numero ?? "—"}</td>
                <td className="py-2.5 text-ds-text/70">{d.fecha_vencimiento ?? "—"}</td>
                <td className="py-2.5">{d.estado ? <StatusBadge estado={d.estado} tonoForzado={TONO_FORZADO[d.estado]} /> : "—"}</td>
                <td className="py-2.5">
                  <div className="flex justify-end gap-1 font-ds-body text-ds-caption font-medium">
                    {d.archivo_key && (
                      <button type="button" onClick={() => onVerArchivo(d.id)} className={`${accionCls} text-ds-brand`}>
                        Ver archivo
                      </button>
                    )}
                    <button type="button" onClick={() => abrirEdicion(d)} className={`${accionCls} text-ds-brand`}>
                      Editar
                    </button>
                    <button type="button" onClick={() => onEliminar(d.id)} className={`${accionCls} text-ds-accent-700`}>
                      Eliminar
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Card>
  );
}
