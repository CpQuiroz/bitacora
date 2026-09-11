"use client";

import { useCallback, useEffect, useState } from "react";
import { ClipboardCheck, Plus } from "lucide-react";
import type { ChecklistTemplate, ItemChecklistPregunta, SeccionChecklist } from "@bitacora/shared";
import { apiFetch } from "@/lib/api";
import { Button, Card, Input, StatusBadge } from "@bitacora/ui/web";
import { DataTable } from "@/components/DataTable";

type Editor = { id: string | null; nombre: string; descripcion: string; secciones: SeccionChecklist[] };

function nuevaPregunta(): ItemChecklistPregunta {
  return { texto: "", obligatorio: true };
}

function nuevoEditor(): Editor {
  return { id: null, nombre: "", descripcion: "", secciones: [{ nombre: "Sección 1", preguntas: [nuevaPregunta()] }] };
}

function aEditor(t: ChecklistTemplate): Editor {
  return {
    id: t.id,
    nombre: t.nombre,
    descripcion: t.descripcion ?? "",
    secciones: t.secciones.length > 0 ? t.secciones : [{ nombre: "Sección 1", preguntas: [nuevaPregunta()] }],
  };
}

// PASO 6 (sistema de diseño) — migrado. Ver docs/design-system.md.
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
    setEditor((prev) => (prev ? { ...prev, secciones: [...prev.secciones, { nombre: `Sección ${prev.secciones.length + 1}`, preguntas: [nuevaPregunta()] }] } : prev));
  }
  function quitarSeccion(i: number) {
    setEditor((prev) => (prev ? { ...prev, secciones: prev.secciones.filter((_, idx) => idx !== i) } : prev));
  }
  function actualizarPregunta(si: number, pi: number, cambios: Partial<ItemChecklistPregunta>) {
    setEditor((prev) => {
      if (!prev) return prev;
      const secciones = prev.secciones.map((s, idx) =>
        idx === si ? { ...s, preguntas: s.preguntas.map((p, pidx) => (pidx === pi ? { ...p, ...cambios } : p)) } : s
      );
      return { ...prev, secciones };
    });
  }
  function agregarPregunta(si: number) {
    setEditor((prev) => {
      if (!prev) return prev;
      const secciones = prev.secciones.map((s, idx) => (idx === si ? { ...s, preguntas: [...s.preguntas, nuevaPregunta()] } : s));
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
      .map((s) => ({
        nombre: s.nombre.trim() || "Sección",
        preguntas: s.preguntas.map((p) => ({ texto: p.texto.trim(), obligatorio: p.obligatorio })).filter((p) => p.texto),
      }))
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
      <div className="flex flex-col gap-ds-6">
        <div>
          <p className="ds-heading text-ds-h3 text-ds-text">{editor.id ? "Editar template" : "Nuevo template"}</p>
          <p className="mt-ds-1 font-ds-body text-ds-small text-ds-text/70">Secciones con preguntas</p>
        </div>
        <Card>
          <div className="grid gap-ds-4 sm:grid-cols-2">
            <Input etiqueta="Nombre" valor={editor.nombre} onCambio={(v) => setEditor({ ...editor, nombre: v })} />
            <Input etiqueta="Descripción" valor={editor.descripcion} onCambio={(v) => setEditor({ ...editor, descripcion: v })} />
          </div>
        </Card>

        {editor.secciones.map((s, si) => (
          <Card key={si}>
            <div className="mb-ds-3 flex items-center justify-between gap-ds-3">
              <div className="max-w-xs flex-1">
                <Input valor={s.nombre} onCambio={(v) => actualizarSeccion(si, v)} />
              </div>
              <button type="button" onClick={() => quitarSeccion(si)} className="font-ds-body text-ds-caption font-medium text-ds-accent-700 hover:underline">
                Quitar sección
              </button>
            </div>
            <div className="flex flex-col gap-ds-2">
              {s.preguntas.map((p, pi) => (
                <div key={pi} className="flex items-center gap-ds-2">
                  <div className="flex-1">
                    <Input placeholder="Pregunta" valor={p.texto} onCambio={(v) => actualizarPregunta(si, pi, { texto: v })} />
                  </div>
                  <label className="flex shrink-0 items-center gap-1.5 font-ds-body text-ds-caption text-ds-text/70">
                    <input
                      type="checkbox"
                      checked={p.obligatorio}
                      onChange={(e) => actualizarPregunta(si, pi, { obligatorio: e.target.checked })}
                      className="accent-[var(--ds-brand)]"
                    />
                    Obligatorio
                  </label>
                  <button type="button" onClick={() => quitarPregunta(si, pi)} className="shrink-0 font-ds-body text-ds-caption font-medium text-ds-accent-700 hover:underline">
                    Quitar
                  </button>
                </div>
              ))}
            </div>
            <div className="mt-ds-3">
              <Button variante="secundario" onPress={() => agregarPregunta(si)} iconoIzq={<Plus size={16} strokeWidth={2.75} />}>
                Agregar pregunta
              </Button>
            </div>
          </Card>
        ))}

        <div>
          <Button variante="secundario" onPress={agregarSeccion} iconoIzq={<Plus size={16} strokeWidth={2.75} />}>
            Agregar sección
          </Button>
        </div>

        {errorEditor ? <p className="font-ds-body text-ds-small text-ds-accent-700">{errorEditor}</p> : null}
        <div className="flex gap-ds-3">
          <Button onPress={onGuardarEditor} cargando={guardando}>
            Guardar template
          </Button>
          <Button variante="ghost" onPress={() => setEditor(null)}>
            Cancelar
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-ds-6">
      <div className="flex flex-wrap items-center justify-between gap-ds-3">
        <div>
          <p className="ds-heading text-ds-h3 text-ds-text">Checklists</p>
          <p className="mt-ds-1 font-ds-body text-ds-small text-ds-text/70">Templates para las órdenes de servicio</p>
        </div>
        <Button iconoIzq={<Plus size={16} strokeWidth={2.75} />} onPress={() => setEditor(nuevoEditor())}>
          Nuevo Template
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-ds-3">
        <div className="max-w-xs flex-1">
          <Input placeholder="Buscar por nombre o descripción" valor={busqueda} onCambio={setBusqueda} />
        </div>
        <label className="flex items-center gap-ds-2 font-ds-body text-ds-small text-ds-text/70">
          <input type="checkbox" checked={mostrarInactivos} onChange={(e) => setMostrarInactivos(e.target.checked)} className="accent-[var(--ds-brand)]" />
          Mostrar inactivos
        </label>
      </div>

      {error ? <p className="font-ds-body text-ds-small text-ds-accent-700">{error}</p> : null}
      <DataTable
        rows={filtrados}
        rowKey={(t) => t.id}
        loading={templates === null && !error}
        columns={[
          {
            header: "Nombre",
            cell: (t) => (
              <>
                <p className="font-medium text-ds-text">{t.nombre}</p>
                {t.descripcion && <p className="font-ds-body text-ds-caption text-ds-text/60">{t.descripcion}</p>}
              </>
            ),
          },
          { header: "Secciones", cell: (t) => t.secciones.length },
          { header: "Preguntas", cell: (t) => t.secciones.reduce((acc, s) => acc + s.preguntas.length, 0) },
          { header: "Versión", cell: (t) => `v${t.version}` },
          { header: "Estado", cell: (t) => <StatusBadge estado={t.activo ? "activo" : "inactivo"} /> },
        ]}
        actions={[
          { label: "Ver/Editar", onClick: (t) => setEditor(aEditor(t)), variant: "brand" },
          { label: "Duplicar", onClick: (t) => onDuplicar(t.id), variant: "brand" },
          { label: (t) => (t.activo ? "Desactivar" : "Activar"), onClick: onAlternarActivo, variant: "muted" },
          { label: "Eliminar", onClick: (t) => onEliminar(t.id), variant: "danger" },
        ]}
        emptyState={{ icon: ClipboardCheck, message: "No hay checklists que coincidan." }}
      />
    </div>
  );
}
