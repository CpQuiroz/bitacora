"use client";

import { useCallback, useEffect, useState } from "react";
import type { ChecklistTemplate, TipoOS } from "@bitacora/shared";
import { apiFetch } from "@/lib/api";
import { Badge, Button, Card, ErrorText, Input, Label, PageHeader, Select } from "@/components/ui";
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
  const [error, setError] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState("");
  const [mostrarInactivos, setMostrarInactivos] = useState(false);

  const [formAbierto, setFormAbierto] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [nombre, setNombre] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [color, setColor] = useState("#4338ca");
  const [checklistId, setChecklistId] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [errorForm, setErrorForm] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setError(null);
    const [resTipos, resChecklists] = await Promise.all([apiFetch("/api/tipos-os"), apiFetch("/api/checklists")]);
    if (!resTipos.ok) {
      setError("No se pudieron cargar los tipos de OS");
      return;
    }
    setTipos(await resTipos.json());
    if (resChecklists.ok) setChecklists(await resChecklists.json());
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

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
    setErrorForm(null);
  }

  function abrirEdicion(t: TipoOsConChecklist) {
    setEditandoId(t.id);
    setNombre(t.nombre);
    setDescripcion(t.descripcion ?? "");
    setColor(t.color);
    setChecklistId(t.checklist_template_id ?? "");
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
            {SUGERIDOS.map((s) => (
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
      {filtrados.length === 0 && tipos !== null && tipos.length > 0 && (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border py-16 text-center">
          <IconTag className="h-8 w-8 text-muted" />
          <p className="text-sm text-muted">No hay tipos que coincidan.</p>
        </div>
      )}
      {filtrados.length > 0 && (
        <Card className="overflow-x-auto p-0">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border text-xs text-muted">
                <th className="px-5 py-3 font-medium"></th>
                <th className="px-5 py-3 font-medium">Nombre</th>
                <th className="px-5 py-3 font-medium">Descripción</th>
                <th className="px-5 py-3 font-medium">Checklist</th>
                <th className="px-5 py-3 font-medium">Estado</th>
                <th className="px-5 py-3 font-medium">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filtrados.map((t) => (
                <tr key={t.id} className="border-b border-border last:border-0">
                  <td className="px-5 py-3">
                    <span className="inline-block h-3 w-3 rounded-full" style={{ background: t.color }} />
                  </td>
                  <td className="px-5 py-3 font-medium text-foreground">{t.nombre}</td>
                  <td className="px-5 py-3 text-muted">{t.descripcion ?? "—"}</td>
                  <td className="px-5 py-3 text-muted">{t.checklist?.nombre ?? "—"}</td>
                  <td className="px-5 py-3">
                    <Badge value={t.activo ? "activo" : "inactivo"} />
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex flex-wrap gap-3 text-xs font-medium">
                      <button type="button" onClick={() => abrirEdicion(t)} className="text-brand hover:underline">
                        Editar
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
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
