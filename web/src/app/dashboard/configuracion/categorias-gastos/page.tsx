"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus, Wallet } from "lucide-react";
import type { CategoriaGasto, SugerenciaRubro } from "@bitacora/shared";
import { apiFetch } from "@/lib/api";
import { Button, Card, Input } from "@bitacora/ui/web";
import { DataTable } from "@/components/DataTable";

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

// PASO 6 (sistema de diseño) — migrado. Ver docs/design-system.md.
// Los hex literales de SUGERIDAS son colores de categoría elegibles por la
// usuaria (dato, no chrome de UI) — quedan fuera de los tokens ds-.
export default function CategoriasGastosPage() {
  const [categorias, setCategorias] = useState<CategoriaConCantidad[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Bloque E: sugerencias según el rubro de la empresa.
  const [sugerenciasRubro, setSugerenciasRubro] = useState<SugerenciaRubro[]>([]);

  const [formAbierto, setFormAbierto] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [nombre, setNombre] = useState("");
  const [color, setColor] = useState("#4338ca");
  const [guardando, setGuardando] = useState(false);
  const [errorForm, setErrorForm] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setError(null);
    const [res, resSugerencias] = await Promise.all([apiFetch("/api/categorias-gasto"), apiFetch("/api/sugerencias-rubro")]);
    if (!res.ok) {
      setError("No se pudieron cargar las categorías");
      return;
    }
    setCategorias(await res.json());
    if (resSugerencias.ok) {
      const todas: SugerenciaRubro[] = await resSugerencias.json();
      setSugerenciasRubro(todas.filter((s) => s.tipo_sugerencia === "categoria_gasto"));
    }
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

  const sugeridasFinal = [
    ...sugerenciasRubro.map((s) => ({ nombre: s.valor, color: s.color ?? "#4338ca" })),
    ...SUGERIDAS.filter((s) => !sugerenciasRubro.some((r) => r.valor === s.nombre)),
  ];

  return (
    <div className="flex flex-col gap-ds-6">
      <div className="flex flex-wrap items-center justify-between gap-ds-3">
        <div>
          <p className="ds-heading text-ds-h3 text-ds-text">Categorías de Gastos</p>
          <p className="mt-ds-1 font-ds-body text-ds-small text-ds-text/70">Organiza tus gastos por categoría</p>
        </div>
        <Button iconoIzq={<Plus size={16} strokeWidth={2.75} />} onPress={() => (formAbierto ? limpiarForm() : setFormAbierto(true))}>
          Nueva Categoría
        </Button>
      </div>

      {categorias !== null && categorias.length === 0 && (
        <Card>
          <p className="mb-ds-3 font-ds-body text-ds-small text-ds-text/70">Categorías sugeridas — clic para crear con un color predefinido:</p>
          <div className="flex flex-wrap gap-ds-2">
            {sugeridasFinal.map((s) => (
              <button
                key={s.nombre}
                type="button"
                onClick={() => crearRapida(s)}
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
          <p className="mb-ds-4 font-ds-body text-ds-small font-semibold text-ds-text">{editandoId ? "Editar categoría" : "Nueva categoría"}</p>
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

      {error ? <p className="font-ds-body text-ds-small text-ds-accent-700">{error}</p> : null}
      <DataTable
        rows={categorias ?? []}
        rowKey={(c) => c.id}
        loading={categorias === null && !error}
        columns={[
          { header: "", className: "w-8", cell: (c) => <span className="inline-block h-3 w-3 rounded-ds-pill" style={{ background: c.color }} /> },
          { header: "Nombre", cell: (c) => <span className="font-medium text-ds-text">{c.nombre}</span> },
          { header: "Gastos asociados", cell: (c) => <span className="text-ds-text/60">{c.cantidad_gastos}</span> },
        ]}
        actions={[
          { label: "Editar", onClick: abrirEdicion, variant: "brand" },
          { label: "Eliminar", onClick: (c) => onEliminar(c.id), variant: "danger" },
        ]}
        emptyState={{ icon: Wallet, message: "Todavía no hay categorías propias — usa las sugeridas de arriba o crea una nueva." }}
      />
    </div>
  );
}
