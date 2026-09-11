"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus, Tag } from "lucide-react";
import type { ChecklistTemplate, SugerenciaRubro, TipoOS } from "@bitacora/shared";
import { apiFetch } from "@/lib/api";
import { Button, Card, Input, Select, StatusBadge } from "@bitacora/ui/web";
import { DataTable } from "@/components/DataTable";

type TipoOsConChecklist = TipoOS & { checklist: { nombre: string } | null };

const SUGERIDOS: { nombre: string; color: string }[] = [
  { nombre: "Emergencia", color: "#dc2626" },
  { nombre: "Garantía", color: "#2563eb" },
  { nombre: "Instalación", color: "#16a34a" },
  { nombre: "Limpieza", color: "#0891b2" },
  { nombre: "Mantención Correctiva", color: "#d97706" },
  { nombre: "Mantención Preventiva", color: "#7c3aed" },
  { nombre: "Cambio de Piezas", color: "#db2777" },
  { nombre: "Visita Técnica", color: "#4338ca" },
];

// PASO 6 (sistema de diseño) — migrado. Ver docs/design-system.md.
export default function TiposOsPage() {
  const [tipos, setTipos] = useState<TipoOsConChecklist[] | null>(null);
  const [checklists, setChecklists] = useState<ChecklistTemplate[]>([]);
  // Bloque E: sugerencias según el rubro de la empresa — se anteponen
  // a las genéricas de siempre, sin ocultarlas (útil mientras la
  // mayoría de los rubros todavía no tiene contenido propio cargado).
  const [sugerenciasRubro, setSugerenciasRubro] = useState<SugerenciaRubro[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState("");
  const [mostrarInactivos, setMostrarInactivos] = useState(false);

  const [formAbierto, setFormAbierto] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [nombre, setNombre] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [color, setColor] = useState("#4338ca");
  const [checklistId, setChecklistId] = useState("");
  const [tiempoEstimado, setTiempoEstimado] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [errorForm, setErrorForm] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setError(null);
    const [resTipos, resChecklists, resSugerencias] = await Promise.all([
      apiFetch("/api/tipos-os"),
      apiFetch("/api/checklists"),
      apiFetch("/api/sugerencias-rubro"),
    ]);
    if (!resTipos.ok) {
      setError("No se pudieron cargar los tipos de OS");
      return;
    }
    setTipos(await resTipos.json());
    if (resChecklists.ok) setChecklists(await resChecklists.json());
    if (resSugerencias.ok) {
      const todas: SugerenciaRubro[] = await resSugerencias.json();
      setSugerenciasRubro(todas.filter((s) => s.tipo_sugerencia === "tipo_os"));
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const sugeridosFinal = [
    ...sugerenciasRubro.map((s) => ({ nombre: s.valor, color: s.color ?? "#4338ca" })),
    ...SUGERIDOS.filter((s) => !sugerenciasRubro.some((r) => r.valor === s.nombre)),
  ];

  const filtrados = (tipos ?? []).filter((t) => {
    if (!mostrarInactivos && !t.activo) return false;
    const q = busqueda.trim().toLowerCase();
    if (!q) return true;
    return t.nombre.toLowerCase().includes(q) || (t.descripcion ?? "").toLowerCase().includes(q);
  });

  function limpiarForm() {
    setFormAbierto(false);
    setEditandoId(null);
    setNombre("");
    setDescripcion("");
    setColor("#4338ca");
    setChecklistId("");
    setTiempoEstimado("");
    setErrorForm(null);
  }

  function abrirEdicion(t: TipoOsConChecklist) {
    setEditandoId(t.id);
    setNombre(t.nombre);
    setDescripcion(t.descripcion ?? "");
    setColor(t.color);
    setChecklistId(t.checklist_template_id ?? "");
    setTiempoEstimado(t.tiempo_estimado_minutos != null ? String(t.tiempo_estimado_minutos) : "");
    setFormAbierto(true);
  }

  async function crearRapido(sugerido: { nombre: string; color: string }) {
    await apiFetch("/api/tipos-os", {
      method: "POST",
      body: JSON.stringify({ nombre: sugerido.nombre, color: sugerido.color }),
    });
    cargar();
  }

  async function onGuardar() {
    setErrorForm(null);
    if (!nombre.trim()) {
      setErrorForm("Falta el nombre");
      return;
    }
    setGuardando(true);
    const body = JSON.stringify({
      nombre,
      descripcion,
      color,
      checklist_template_id: checklistId || null,
      tiempo_estimado_minutos: tiempoEstimado.trim() ? Number(tiempoEstimado) : null,
    });
    const res = editandoId
      ? await apiFetch(`/api/tipos-os/${editandoId}`, { method: "PATCH", body })
      : await apiFetch("/api/tipos-os", { method: "POST", body });
    setGuardando(false);
    if (!res.ok) {
      const b = await res.json().catch(() => ({}));
      setErrorForm(b.error ?? "No se pudo guardar");
      return;
    }
    limpiarForm();
    cargar();
  }

  async function onAlternarActivo(t: TipoOsConChecklist) {
    const res = await apiFetch(`/api/tipos-os/${t.id}`, { method: "PATCH", body: JSON.stringify({ activo: !t.activo }) });
    if (res.ok) cargar();
  }

  async function onEliminar(id: string) {
    const res = await apiFetch(`/api/tipos-os/${id}`, { method: "DELETE" });
    if (res.ok) cargar();
  }

  return (
    <div className="flex flex-col gap-ds-6">
      <div className="flex flex-wrap items-center justify-between gap-ds-3">
        <div>
          <p className="ds-heading text-ds-h3 text-ds-text">Tipos de OS</p>
          <p className="mt-ds-1 font-ds-body text-ds-small text-ds-text/70">Categoriza tus órdenes de servicio</p>
        </div>
        <Button iconoIzq={<Plus size={16} strokeWidth={2.75} />} onPress={() => (formAbierto ? limpiarForm() : setFormAbierto(true))}>
          Nuevo Tipo
        </Button>
      </div>

      {tipos !== null && tipos.length === 0 && (
        <Card>
          <p className="mb-ds-3 font-ds-body text-ds-small text-ds-text/70">Tipos sugeridos — clic para crear con un color predefinido:</p>
          <div className="flex flex-wrap gap-ds-2">
            {sugeridosFinal.map((s) => (
              <button
                key={s.nombre}
                type="button"
                onClick={() => crearRapido(s)}
                className="flex items-center gap-1.5 rounded-ds-pill border border-ds-divider px-ds-3 py-1 font-ds-body text-ds-caption font-medium text-ds-text hover:border-ds-brand"
              >
                <span className="h-2.5 w-2.5 rounded-ds-pill" style={{ background: s.color }} />
                {s.nombre}
              </button>
            ))}
          </div>
        </Card>
      )}

      {formAbierto && (
        <Card>
          <p className="mb-ds-4 font-ds-body text-ds-small font-semibold text-ds-text">{editandoId ? "Editar tipo de OS" : "Nuevo tipo de OS"}</p>
          <div className="grid gap-ds-4 sm:grid-cols-2">
            <Input etiqueta="Nombre" valor={nombre} onCambio={setNombre} />
            <div className="flex flex-col gap-ds-1">
              <label className="font-ds-body text-ds-caption font-medium text-ds-text/70">Color</label>
              <div className="flex items-center gap-ds-3">
                <input
                  type="color"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  className="h-10 w-14 cursor-pointer rounded-ds-md border border-ds-divider bg-ds-surface p-1"
                />
                <span className="font-ds-body text-ds-small text-ds-text/70">{color}</span>
              </div>
            </div>
            <div className="sm:col-span-2">
              <Input etiqueta="Descripción" valor={descripcion} onCambio={setDescripcion} />
            </div>
            <div>
              <Select
                etiqueta="Checklist predeterminado"
                valor={checklistId}
                onCambio={setChecklistId}
                placeholder="Sin checklist"
                opciones={checklists.map((c) => ({ valor: c.id, etiqueta: c.nombre }))}
              />
              <a
                href="/dashboard/configuracion/checklists"
                target="_blank"
                rel="noopener noreferrer"
                className="mt-ds-1 inline-block font-ds-body text-ds-caption font-medium text-ds-text/70 transition-colors hover:text-ds-brand"
              >
                {checklists.length === 0 ? "Crear un checklist →" : "Gestionar checklists →"}
              </a>
            </div>
            <Input etiqueta="Tiempo estimado (minutos)" tipo="numero" placeholder="60" valor={tiempoEstimado} onCambio={setTiempoEstimado} />
          </div>
          {errorForm ? <p className="mt-ds-3 font-ds-body text-ds-small text-ds-accent-700">{errorForm}</p> : null}
          <div className="mt-ds-4 flex gap-ds-3">
            <Button onPress={onGuardar} cargando={guardando}>
              Guardar
            </Button>
            <Button variante="ghost" onPress={limpiarForm}>
              Cancelar
            </Button>
          </div>
        </Card>
      )}

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
        loading={tipos === null && !error}
        columns={[
          { header: "", className: "w-8", cell: (t) => <span className="inline-block h-3 w-3 rounded-ds-pill" style={{ background: t.color }} /> },
          { header: "Nombre", cell: (t) => <span className="font-medium text-ds-text">{t.nombre}</span> },
          { header: "Descripción", cell: (t) => <span className="text-ds-text/60">{t.descripcion ?? "—"}</span> },
          { header: "Checklist", cell: (t) => <span className="text-ds-text/60">{t.checklist?.nombre ?? "—"}</span> },
          { header: "Tiempo estimado", cell: (t) => <span className="text-ds-text/60">{t.tiempo_estimado_minutos != null ? `${t.tiempo_estimado_minutos} min` : "—"}</span> },
          { header: "Estado", cell: (t) => <StatusBadge estado={t.activo ? "activo" : "inactivo"} /> },
        ]}
        actions={[
          { label: "Editar", onClick: abrirEdicion, variant: "brand" },
          { label: (t) => (t.activo ? "Desactivar" : "Activar"), onClick: onAlternarActivo, variant: "muted" },
          { label: "Eliminar", onClick: (t) => onEliminar(t.id), variant: "danger" },
        ]}
        emptyState={{ icon: Tag, message: "No hay tipos que coincidan." }}
      />
    </div>
  );
}
