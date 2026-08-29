"use client";

import { useCallback, useEffect, useState } from "react";
import type { Documento, EntidadDocumento, EstadoDocumento, TipoDocumento } from "@bitacora/shared";
import { apiFetch } from "@/lib/api";
import { Badge, Button, Card, ErrorText, Input, Label, Select } from "@/components/ui";
import { IconPaperclip, IconPlus } from "@/components/icons";

type DocumentoConTipo = Documento & { tipo: { nombre: string } | null; estado: EstadoDocumento | null };

// Editor + listado de documentos de UN colaborador o vehículo — mismo
// componente para ambas entidades (no hay dos implementaciones
// paralelas), reutilizado en Flota > Colaboradores, Flota > Vehículos y
// Mis Documentos (self-service, con soloLectura parcial).
export function DocumentoForm({ entidadTipo, entidadId }: { entidadTipo: EntidadDocumento; entidadId: string }) {
  const [tipos, setTipos] = useState<TipoDocumento[]>([]);
  const [documentos, setDocumentos] = useState<DocumentoConTipo[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [formAbierto, setFormAbierto] = useState(false);
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

  function limpiarForm() {
    setFormAbierto(false);
    setTipoId("");
    setNumero("");
    setFechaEmision("");
    setFechaVencimiento("");
    setArchivo(null);
    setErrorForm(null);
  }

  async function onGuardar() {
    setErrorForm(null);
    if (!tipoId) {
      setErrorForm("Selecciona un tipo de documento");
      return;
    }
    setGuardando(true);
    const form = new FormData();
    form.append("entidad_tipo", entidadTipo);
    form.append("entidad_id", entidadId);
    form.append("tipo_documento_id", tipoId);
    form.append("numero", numero);
    form.append("fecha_emision", fechaEmision);
    form.append("fecha_vencimiento", fechaVencimiento);
    if (archivo) form.append("archivo", archivo);

    const res = await apiFetch("/api/documentos", { method: "POST", body: form });
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

  return (
    <Card>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <IconPaperclip className="h-4 w-4 text-brand" />
          Documentos
        </h2>
        <Button type="button" variant="outline" onClick={() => setFormAbierto((v) => !v)}>
          <IconPlus className="h-4 w-4" />
          {formAbierto ? "Cancelar" : "Agregar documento"}
        </Button>
      </div>

      {formAbierto && (
        <div className="mb-4 rounded-xl border border-border p-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label>Tipo de documento</Label>
              <Select value={tipoId} onChange={(e) => setTipoId(e.target.value)}>
                <option value="">Selecciona…</option>
                {tipos.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.nombre}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label>Número (opcional)</Label>
              <Input type="text" value={numero} onChange={(e) => setNumero(e.target.value)} />
            </div>
            <div>
              <Label>Fecha de emisión</Label>
              <Input type="date" value={fechaEmision} onChange={(e) => setFechaEmision(e.target.value)} />
            </div>
            <div>
              <Label>Fecha de vencimiento</Label>
              <Input type="date" value={fechaVencimiento} onChange={(e) => setFechaVencimiento(e.target.value)} />
            </div>
            <div className="sm:col-span-2">
              <Label>Archivo (imagen o PDF, opcional)</Label>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,application/pdf"
                onChange={(e) => setArchivo(e.target.files?.[0] ?? null)}
                className="block w-full text-sm text-muted file:mr-3 file:rounded-lg file:border-0 file:bg-brand-soft file:px-3 file:py-2 file:text-sm file:font-medium file:text-brand"
              />
            </div>
          </div>
          {errorForm && (
            <div className="mt-3">
              <ErrorText>{errorForm}</ErrorText>
            </div>
          )}
          <Button type="button" onClick={onGuardar} disabled={guardando} className="mt-4">
            {guardando ? "Guardando…" : "Guardar documento"}
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
                  <div className="flex justify-end gap-3 text-xs font-medium">
                    {d.archivo_key && (
                      <button type="button" onClick={() => onVerArchivo(d.id)} className="text-brand hover:underline">
                        Ver archivo
                      </button>
                    )}
                    <button type="button" onClick={() => onEliminar(d.id)} className="text-danger hover:underline">
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
