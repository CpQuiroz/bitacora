"use client";

import { useCallback, useEffect, useState } from "react";
import type { CategoriaGasto } from "@bitacora/shared";
import { apiFetch } from "@/lib/api";
import { Button, Card, ErrorText, Input, Label, PageHeader } from "@/components/ui";
import { DataTable } from "@/components/DataTable";
import { IconPlus, IconWallet } from "@/components/icons";

type CategoriaConCantidad = CategoriaGasto & { cantidad_gastos: number };

const SUGERIDAS: { nombre: string; color: string }[] = [
  { nombre: "Alimentación", color: "#d97706" },
  { nombre: "Combustible", color: "#dc2626" },
  { nombre: "Equipos", color: "#2563eb" },
  { nombre: "Estacionamiento", color: "#0891b2" },
  { nombre: "Herramientas", color: "#7c3aed" },
  { nombre: "Mantención de Vehículo", color: "#16a34a" },
  { nombre: "Materiales", color: "#4338ca" },
  { nombre: "Otros", color: "#6b7280" },
  { nombre: "Piezas/Repuestos", color: "#db2777" },
  { nombre: "Peajes", color: "#0d9488" },
  { nombre: "Software/Apps", color: "#9333ea" },
  { nombre: "Teléfono/Internet", color: "#0284c7" },
  { nombre: "Capacitación", color: "#ca8a04" },
  { nombre: "Uniformes/EPP", color: "#65a30d" },
];

export default function CategoriasGastosPage() {
  const [categorias, setCategorias] = useState<CategoriaConCantidad[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [formAbierto, setFormAbierto] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [nombre, setNombre] = useState("");
  const [color, setColor] = useState("#4338ca");
  const [guardando, setGuardando] = useState(false);
  const [errorForm, setErrorForm] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setError(null);
    const res = await apiFetch("/api/categorias-gasto");
    if (!res.ok) {
      setError("No se pudieron cargar las categorías");
      return;
    }
    setCategorias(await res.json());
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  function limpiarForm() {
    setFormAbierto(false);
    setEditandoId(null);
    setNombre("");
    setColor("#4338ca");
    setErrorForm(null);
  }

  function abrirEdicion(c: CategoriaConCantidad) {
    setEditandoId(c.id);
    setNombre(c.nombre);
    setColor(c.color);
    setFormAbierto(true);
  }

  async function crearRapida(s: { nombre: string; color: string }) {
    await apiFetch("/api/categorias-gasto", { method: "POST", body: JSON.stringify(s) });
    cargar();
  }

  async function onGuardar() {
    setErrorForm(null);
    if (!nombre.trim()) {
      setErrorForm("Falta el nombre");
      return;
    }
    setGuardando(true);
    const body = JSON.stringify({ nombre, color });
    const res = editandoId
      ? await apiFetch(`/api/categorias-gasto/${editandoId}`, { method: "PATCH", body })
      : await apiFetch("/api/categorias-gasto", { method: "POST", body });
    setGuardando(false);
    if (!res.ok) {
      const b = await res.json().catch(() => ({}));
      setErrorForm(b.error ?? "No se pudo guardar");
      return;
    }
    limpiarForm();
    cargar();
  }

  async function onEliminar(id: string) {
    const res = await apiFetch(`/api/categorias-gasto/${id}`, { method: "DELETE" });
    if (res.ok) cargar();
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <PageHeader title="Categorías de Gastos" subtitle="Organiza tus gastos por categoría" />
        <Button type="button" onClick={() => (formAbierto ? limpiarForm() : setFormAbierto(true))}>
          <IconPlus className="h-4 w-4" />
          Nueva Categoría
        </Button>
      </div>

      {categorias !== null && categorias.length === 0 && (
        <Card>
          <p className="mb-3 text-sm text-muted">Categorías sugeridas — clic para crear con un color predefinido:</p>
          <div className="flex flex-wrap gap-2">
            {SUGERIDAS.map((s) => (
              <button
                key={s.nombre}
                type="button"
                onClick={() => crearRapida(s)}
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
          <h2 className="mb-4 text-sm font-semibold text-foreground">{editandoId ? "Editar categoría" : "Nueva categoría"}</h2>
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

      {error && <ErrorText>{error}</ErrorText>}
      <DataTable
        rows={categorias ?? []}
        rowKey={(c) => c.id}
        loading={categorias === null && !error}
        columns={[
          { header: "", className: "w-8", cell: (c) => <span className="inline-block h-3 w-3 rounded-full" style={{ background: c.color }} /> },
          { header: "Nombre", cell: (c) => <span className="font-medium text-foreground">{c.nombre}</span> },
          { header: "Gastos asociados", cell: (c) => <span className="text-muted">{c.cantidad_gastos}</span> },
        ]}
        actions={[
          { label: "Editar", onClick: abrirEdicion, variant: "brand" },
          { label: "Eliminar", onClick: (c) => onEliminar(c.id), variant: "danger" },
        ]}
        emptyState={{ icon: IconWallet, message: "Todavía no hay categorías propias — usa las sugeridas de arriba o crea una nueva." }}
      />
    </div>
  );
}
