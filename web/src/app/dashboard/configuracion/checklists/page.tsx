"use client";

import { useCallback, useEffect, useState } from "react";
import type { ChecklistTemplate, SeccionChecklist } from "@bitacora/shared";
import { apiFetch } from "@/lib/api";
import { Badge, Button, Card, ErrorText, Input, Label, PageHeader, Textarea } from "@/components/ui";
import { IconClipboardCheck, IconPlus } from "@/components/icons";

type Editor = { id: string | null; nombre: string; descripcion: string; secciones: SeccionChecklist[] };

function nuevoEditor(): Editor {
  return { id: null, nombre: "", descripcion: "", secciones: [{ nombre: "Sección 1", preguntas: [""] }] };
}

function aEditor(t: ChecklistTemplate): Editor {
  return {
    id: t.id,
    nombre: t.nombre,
    descripcion: t.descripcion ?? "",
    secciones: t.secciones.length > 0 ? t.secciones : [{ nombre: "Sección 1", preguntas: [""] }],
  };
}

export default function ChecklistsPage() {
  const [templates, setTemplates] = useState<ChecklistTemplate[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState("");
  const [mostrarInactivos, setMostrarInactivos] = useState(false);

  const [editor, setEditor] = useState<Editor | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [errorEditor, setErrorEditor] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setError(null);
    const res = await apiFetch("/api/checklists");
    if (!res.ok) {
      setError("No se pudieron cargar los checklists");
      return;
    }
    setTemplates(await res.json());
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const filtrados = (templates ?? []).filter((t) => {
    if (!mostrarInactivos && !t.activo) return false;
    const q = busqueda.trim().toLowerCase();
    if (!q) return true;
    return t.nombre.toLowerCase().includes(q) || (t.descripcion ?? "").toLowerCase().includes(q);
  });

  async function onDuplicar(id: string) {
    const res = await apiFetch(`/api/checklists/${id}/duplicar`, { method: "POST" });
    if (res.ok) cargar();
  }

  async function onAlternarActivo(t: ChecklistTemplate) {
    const res = await apiFetch(`/api/checklists/${t.id}`, {
      method: "PATCH",
      body: JSON.stringify({ activo: !t.activo }),
    });
    if (res.ok) cargar();
  }

  async function onEliminar(id: string) {
    const res = await apiFetch(`/api/checklists/${id}`, { method: "DELETE" });
    if (res.ok) cargar();
  }

  function actualizarSeccion(i: number, nombre: string) {
    setEditor((prev) => {
      if (!prev) return prev;
      const secciones = prev.secciones.map((s, idx) => (idx === i ? { ...s, nombre } : s));
      return { ...prev, secciones };
    });
  }
  function agregarSeccion() {
    setEditor((prev) => (prev ? { ...prev, secciones: [...prev.secciones, { nombre: `Sección ${prev.secciones.length + 1}`, preguntas: [""] }] } : prev));
  }
  function quitarSeccion(i: number) {
    setEditor((prev) => (prev ? { ...prev, secciones: prev.secciones.filter((_, idx) => idx !== i) } : prev));
  }
  function actualizarPregunta(si: number, pi: number, texto: string) {
    setEditor((prev) => {
      if (!prev) return prev;
      const secciones = prev.secciones.map((s, idx) =>
        idx === si ? { ...s, preguntas: s.preguntas.map((p, pidx) => (pidx === pi ? texto : p)) } : s
      );
      return { ...prev, secciones };
    });
  }
  function agregarPregunta(si: number) {
    setEditor((prev) => {
      if (!prev) return prev;
      const secciones = prev.secciones.map((s, idx) => (idx === si ? { ...s, preguntas: [...s.preguntas, ""] } : s));
      return { ...prev, secciones };
    });
  }
  function quitarPregunta(si: number, pi: number) {
    setEditor((prev) => {
      if (!prev) return prev;
      const secciones = prev.secciones.map((s, idx) => (idx === si ? { ...s, preguntas: s.preguntas.filter((_, pidx) => pidx !== pi) } : s));
      return { ...prev, secciones };
    });
  }

  async function onGuardarEditor() {
    if (!editor) return;
    setErrorEditor(null);
    if (!editor.nombre.trim()) {
      setErrorEditor("Falta el nombre");
      return;
    }
    const seccionesLimpias = editor.secciones
      .map((s) => ({ nombre: s.nombre.trim() || "Sección", preguntas: s.preguntas.map((p) => p.trim()).filter(Boolean) }))
      .filter((s) => s.preguntas.length > 0);

    setGuardando(true);
    const res = editor.id
      ? await apiFetch(`/api/checklists/${editor.id}`, {
          method: "PATCH",
          body: JSON.stringify({ nombre: editor.nombre, descripcion: editor.descripcion, secciones: seccionesLimpias }),
        })
      : await apiFetch("/api/checklists", {
          method: "POST",
          body: JSON.stringify({ nombre: editor.nombre, descripcion: editor.descripcion, secciones: seccionesLimpias }),
        });
    setGuardando(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setErrorEditor(body.error ?? "No se pudo guardar");
      return;
    }
    setEditor(null);
    cargar();
  }

  if (editor) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title={editor.id ? "Editar template" : "Nuevo template"} subtitle="Secciones con preguntas" />
        <Card>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label>Nombre</Label>
              <Input type="text" value={editor.nombre} onChange={(e) => setEditor({ ...editor, nombre: e.target.value })} />
            </div>
            <div>
              <Label>Descripción</Label>
              <Input type="text" value={editor.descripcion} onChange={(e) => setEditor({ ...editor, descripcion: e.target.value })} />
            </div>
          </div>
        </Card>

        {editor.secciones.map((s, si) => (
          <Card key={si}>
            <div className="mb-3 flex items-center justify-between gap-3">
              <Input
                type="text"
                value={s.nombre}
                onChange={(e) => actualizarSeccion(si, e.target.value)}
                className="max-w-xs font-medium"
              />
              <button type="button" onClick={() => quitarSeccion(si)} className="text-xs font-medium text-danger hover:underline">
                Quitar sección
              </button>
            </div>
            <div className="flex flex-col gap-2">
              {s.preguntas.map((p, pi) => (
                <div key={pi} className="flex items-center gap-2">
                  <Input type="text" placeholder="Pregunta" value={p} onChange={(e) => actualizarPregunta(si, pi, e.target.value)} />
                  <button type="button" onClick={() => quitarPregunta(si, pi)} className="shrink-0 text-xs font-medium text-danger hover:underline">
                    Quitar
                  </button>
                </div>
              ))}
            </div>
            <Button type="button" variant="outline" onClick={() => agregarPregunta(si)} className="mt-3">
              <IconPlus className="h-4 w-4" />
              Agregar pregunta
            </Button>
          </Card>
        ))}

        <Button type="button" variant="outline" onClick={agregarSeccion} className="self-start">
          <IconPlus className="h-4 w-4" />
          Agregar sección
        </Button>

        {errorEditor && <ErrorText>{errorEditor}</ErrorText>}
        <div className="flex gap-3">
          <Button type="button" onClick={onGuardarEditor} disabled={guardando}>
            {guardando ? "Guardando…" : "Guardar template"}
          </Button>
          <Button type="button" variant="ghost" onClick={() => setEditor(null)}>
            Cancelar
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <PageHeader title="Checklists" subtitle="Templates para las órdenes de servicio" />
        <Button type="button" onClick={() => setEditor(nuevoEditor())}>
          <IconPlus className="h-4 w-4" />
          Nuevo Template
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Input
          type="text"
          placeholder="Buscar por nombre o descripción"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          className="max-w-xs"
        />
        <label className="flex items-center gap-2 text-sm text-muted">
          <input type="checkbox" checked={mostrarInactivos} onChange={(e) => setMostrarInactivos(e.target.checked)} className="accent-brand" />
          Mostrar inactivos
        </label>
      </div>

      {error && <ErrorText>{error}</ErrorText>}
      {templates === null && !error && <p className="text-sm text-muted">Cargando…</p>}
      {filtrados.length === 0 && templates !== null && (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border py-16 text-center">
          <IconClipboardCheck className="h-8 w-8 text-muted" />
          <p className="text-sm text-muted">No hay checklists que coincidan.</p>
        </div>
      )}
      {filtrados.length > 0 && (
        <Card className="overflow-x-auto p-0">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border text-xs text-muted">
                <th className="px-5 py-3 font-medium">Nombre</th>
                <th className="px-5 py-3 font-medium">Secciones</th>
                <th className="px-5 py-3 font-medium">Preguntas</th>
                <th className="px-5 py-3 font-medium">Versión</th>
                <th className="px-5 py-3 font-medium">Estado</th>
                <th className="px-5 py-3 font-medium">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filtrados.map((t) => {
                const totalPreguntas = t.secciones.reduce((acc, s) => acc + s.preguntas.length, 0);
                return (
                  <tr key={t.id} className="border-b border-border last:border-0">
                    <td className="px-5 py-3">
                      <p className="font-medium text-foreground">{t.nombre}</p>
                      {t.descripcion && <p className="text-xs text-muted">{t.descripcion}</p>}
                    </td>
                    <td className="px-5 py-3">{t.secciones.length}</td>
                    <td className="px-5 py-3">{totalPreguntas}</td>
                    <td className="px-5 py-3">v{t.version}</td>
                    <td className="px-5 py-3">
                      <Badge value={t.activo ? "activo" : "inactivo"} />
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex flex-wrap gap-3 text-xs font-medium">
                        <button type="button" onClick={() => setEditor(aEditor(t))} className="text-brand hover:underline">
                          Ver/Editar
                        </button>
                        <button type="button" onClick={() => onDuplicar(t.id)} className="text-brand hover:underline">
                          Duplicar
                        </button>
                        <button type="button" onClick={() => onAlternarActivo(t)} className="text-muted hover:underline">
                          {t.activo ? "Desactivar" : "Activar"}
                        </button>
                        <button type="button" onClick={() => onEliminar(t.id)} className="text-danger hover:underline">
                          Eliminar
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
