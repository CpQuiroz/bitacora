"use client";

import { useCallback, useEffect, useState } from "react";
import type { ChecklistTemplate, SugerenciaRubro, TipoOS } from "@bitacora/shared";
import { apiFetch } from "@/lib/api";
import { Badge, Button, Card, ErrorText, Input, Label, PageHeader, Select } from "@/components/ui";
import { DataTable } from "@/components/DataTable";
import { IconPlus, IconTag } from "@/components/icons";

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
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <PageHeader title="Tipos de OS" subtitle="Categoriza tus órdenes de servicio" />
        <Button type="button" onClick={() => (formAbierto ? limpiarForm() : setFormAbierto(true))}>
          <IconPlus className="h-4 w-4" />
          Nuevo Tipo
        </Button>
      </div>

      {tipos !== null && tipos.length === 0 && (
        <Card>
          <p className="mb-3 text-sm text-muted">Tipos sugeridos — clic para crear con un color predefinido:</p>
          <div className="flex flex-wrap gap-2">
            {sugeridosFinal.map((s) => (
              <button
                key={s.nombre}
                type="button"
                onClick={() => crearRapido(s)}
                className="flex items-center gap-1.5 rounded-full border border-border px-3 py-1 text-xs font-medium text-foreground hover:border-brand"
              >
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: s.color }} />
                {s.nombre}
              </button>
            ))}
          </div>
        </Card>
      )}

      {formAbierto && (
        <Card>
          <h2 className="mb-4 text-sm font-semibold text-foreground">{editandoId ? "Editar tipo de OS" : "Nuevo tipo de OS"}</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label>Nombre</Label>
              <Input type="text" value={nombre} onChange={(e) => setNombre(e.target.value)} />
            </div>
            <div>
              <Label>Color</Label>
              <div className="flex items-center gap-3">
                <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-10 w-14 cursor-pointer rounded-lg border border-border bg-surface p-1" />
                <span className="text-sm text-muted">{color}</span>
              </div>
            </div>
            <div className="sm:col-span-2">
              <Label>Descripción</Label>
              <Input type="text" value={descripcion} onChange={(e) => setDescripcion(e.target.value)} />
            </div>
            <div>
              <Label>Checklist predeterminado</Label>
              <Select value={checklistId} onChange={(e) => setChecklistId(e.target.value)}>
                <option value="">Sin checklist</option>
                {checklists.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nombre}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label>Tiempo estimado (minutos)</Label>
              <Input type="number" min={0} placeholder="60" value={tiempoEstimado} onChange={(e) => setTiempoEstimado(e.target.value)} />
            </div>
          </div>
          {errorForm && (
            <div className="mt-3">
              <ErrorText>{errorForm}</ErrorText>
            </div>
          )}
          <div className="mt-4 flex gap-3">
            <Button type="button" onClick={onGuardar} disabled={guardando}>
              {guardando ? "Guardando…" : "Guardar"}
            </Button>
            <Button type="button" variant="ghost" onClick={limpiarForm}>
              Cancelar
            </Button>
          </div>
        </Card>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <Input type="text" placeholder="Buscar por nombre o descripción" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} className="max-w-xs" />
        <label className="flex items-center gap-2 text-sm text-muted">
          <input type="checkbox" checked={mostrarInactivos} onChange={(e) => setMostrarInactivos(e.target.checked)} className="accent-brand" />
          Mostrar inactivos
        </label>
      </div>

      {error && <ErrorText>{error}</ErrorText>}
      <DataTable
        rows={filtrados}
        rowKey={(t) => t.id}
        loading={tipos === null && !error}
        columns={[
          { header: "", className: "w-8", cell: (t) => <span className="inline-block h-3 w-3 rounded-full" style={{ background: t.color }} /> },
          { header: "Nombre", cell: (t) => <span className="font-medium text-foreground">{t.nombre}</span> },
          { header: "Descripción", cell: (t) => <span className="text-muted">{t.descripcion ?? "—"}</span> },
          { header: "Checklist", cell: (t) => <span className="text-muted">{t.checklist?.nombre ?? "—"}</span> },
          { header: "Tiempo estimado", cell: (t) => <span className="text-muted">{t.tiempo_estimado_minutos != null ? `${t.tiempo_estimado_minutos} min` : "—"}</span> },
          { header: "Estado", cell: (t) => <Badge value={t.activo ? "activo" : "inactivo"} /> },
        ]}
        actions={[
          { label: "Editar", onClick: abrirEdicion, variant: "brand" },
          { label: (t) => (t.activo ? "Desactivar" : "Activar"), onClick: onAlternarActivo, variant: "muted" },
          { label: "Eliminar", onClick: (t) => onEliminar(t.id), variant: "danger" },
        ]}
        emptyState={{ icon: IconTag, message: "No hay tipos que coincidan." }}
      />
    </div>
  );
}
