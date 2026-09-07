"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import type { Documento, EntidadDocumento, EstadoDocumento, TipoDocumento } from "@bitacora/shared";
import { apiFetch } from "@/lib/api";
import { Badge, Button, Card, ErrorText, Input, Select } from "@/components/ui";
import { IconPaperclip, IconPlus } from "@/components/icons";

type DocumentoConTipo = Documento & { tipo: { nombre: string } | null; estado: EstadoDocumento | null };

// Campo con label asociado (htmlFor/id) — mismo estilo que <Label> del
// design system, pero enlazado al control para accesibilidad.
function Campo({ label, htmlFor, children }: { label: string; htmlFor: string; children: ReactNode }) {
  return (
    <div>
      <label htmlFor={htmlFor} className="mb-1.5 block text-[13px] font-semibold text-foreground">
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
  const accionCls = "inline-flex min-h-[44px] items-center px-2 hover:underline";

  return (
    <Card>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <IconPaperclip className="h-4 w-4 text-brand" />
          Documentos
        </h2>
        <Button type="button" variant="outline" onClick={toggleForm}>
          <IconPlus className="h-4 w-4" />
          {formAbierto ? "Cancelar" : "Agregar documento"}
        </Button>
      </div>

      {formAbierto && tiposCargados && tipos.length === 0 && (
        <div className="mb-4 rounded-xl border border-border bg-brand-soft p-4 text-sm">
          <p className="font-medium text-foreground">
            No hay tipos de documento configurados para {entidadTipo === "vehiculo" ? "vehículos" : "colaboradores"}.
          </p>
          <p className="mt-1 text-muted">
            Creá al menos uno en{" "}
            <Link href="/dashboard/configuracion/tipos-documento" className="font-medium text-brand hover:underline">
              Configuración → Tipos de Documento
            </Link>{" "}
            y después volvé acá para adjuntarlo.
          </p>
        </div>
      )}

      {formAbierto && tipos.length > 0 && (
        <div className="mb-4 rounded-xl border border-border p-4">
          <h3 className="mb-3 text-[13px] font-semibold text-foreground">
            {editando ? "Editar documento" : "Nuevo documento"}
          </h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo label="Tipo de documento" htmlFor="doc-tipo">
              <Select id="doc-tipo" value={tipoId} onChange={(e) => setTipoId(e.target.value)}>
                <option value="">Selecciona…</option>
                {tipos.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.nombre}
                  </option>
                ))}
              </Select>
            </Campo>
            <Campo label="Número (opcional)" htmlFor="doc-numero">
              <Input id="doc-numero" type="text" value={numero} onChange={(e) => setNumero(e.target.value)} />
            </Campo>
            <Campo label="Fecha de emisión" htmlFor="doc-emision">
              <Input id="doc-emision" type="date" value={fechaEmision} onChange={(e) => setFechaEmision(e.target.value)} />
            </Campo>
            <Campo label="Fecha de vencimiento" htmlFor="doc-vencimiento">
              <Input
                id="doc-vencimiento"
                type="date"
                value={fechaVencimiento}
                onChange={(e) => setFechaVencimiento(e.target.value)}
              />
            </Campo>
            <div className="sm:col-span-2">
              <label htmlFor="doc-archivo" className="mb-1.5 block text-[13px] font-semibold text-foreground">
                {editando ? "Reemplazar archivo (imagen o PDF, opcional)" : "Archivo (imagen o PDF, opcional)"}
              </label>
              <input
                id="doc-archivo"
                type="file"
                accept="image/jpeg,image/png,image/webp,application/pdf"
                onChange={(e) => setArchivo(e.target.files?.[0] ?? null)}
                className="block w-full text-sm text-muted file:mr-3 file:rounded-lg file:border-0 file:bg-brand-soft file:px-3 file:py-2 file:text-sm file:font-medium file:text-brand"
              />
              {editando && (
                <p className="mt-1 text-xs text-muted">Si no subís uno nuevo, se mantiene el archivo actual.</p>
              )}
            </div>
          </div>
          {errorForm && (
            <div className="mt-3">
              <ErrorText>{errorForm}</ErrorText>
            </div>
          )}
          <Button type="button" onClick={onGuardar} disabled={guardando} className="mt-4 min-h-[44px]">
            {guardando ? "Guardando…" : editando ? "Guardar cambios" : "Guardar documento"}
          </Button>
        </div>
      )}

      {error && <ErrorText>{error}</ErrorText>}
      {documentos === null && !error && <p className="text-sm text-muted">Cargando…</p>}
      {documentos?.length === 0 && <p className="text-sm text-muted">Sin documentos registrados.</p>}

      {documentos && documentos.length > 0 && (
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-border text-xs text-muted">
              <th className="py-2 font-medium">Tipo</th>
              <th className="py-2 font-medium">Número</th>
              <th className="py-2 font-medium">Vence</th>
              <th className="py-2 font-medium">Estado</th>
              <th className="py-2 font-medium" />
            </tr>
          </thead>
          <tbody>
            {documentos.map((d) => (
              <tr key={d.id} className="border-b border-border last:border-0">
                <td className="py-2.5 font-medium text-foreground">{d.tipo?.nombre ?? "—"}</td>
                <td className="py-2.5 text-muted">{d.numero ?? "—"}</td>
                <td className="py-2.5 text-muted">{d.fecha_vencimiento ?? "—"}</td>
                <td className="py-2.5">{d.estado ? <Badge value={d.estado} /> : "—"}</td>
                <td className="py-2.5">
                  <div className="flex justify-end gap-1 text-xs font-medium">
                    {d.archivo_key && (
                      <button type="button" onClick={() => onVerArchivo(d.id)} className={`${accionCls} text-brand`}>
                        Ver archivo
                      </button>
                    )}
                    <button type="button" onClick={() => abrirEdicion(d)} className={`${accionCls} text-brand`}>
                      Editar
                    </button>
                    <button type="button" onClick={() => onEliminar(d.id)} className={`${accionCls} text-danger`}>
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
