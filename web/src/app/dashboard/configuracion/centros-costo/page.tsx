"use client";

import { useCallback, useEffect, useState } from "react";
import { Layers, Plus } from "lucide-react";
import type { CategoriaGasto } from "@bitacora/shared";
import { apiFetch } from "@/lib/api";
import { Button, Card, Input } from "@bitacora/ui/web";
import { DataTable } from "@/components/DataTable";

type CentroConCategorias = { id: string; nombre: string; categoria_gasto_ids: string[]; categorias: string[]; creado_en: string };

// PASO 6 (sistema de diseño) — migrado. Ver docs/design-system.md.
export default function CentrosCostoPage() {
  const [centros, setCentros] = useState<CentroConCategorias[] | null>(null);
  const [categorias, setCategorias] = useState<CategoriaGasto[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [formAbierto, setFormAbierto] = useState(false);
  const [nombre, setNombre] = useState("");
  const [seleccionadas, setSeleccionadas] = useState<Set<string>>(new Set());
  const [guardando, setGuardando] = useState(false);
  const [errorForm, setErrorForm] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setError(null);
    const [resCentros, resCategorias] = await Promise.all([apiFetch("/api/centros-costo"), apiFetch("/api/categorias-gasto")]);
    if (!resCentros.ok) {
      setError("No se pudieron cargar los centros de costo");
      return;
    }
    setCentros(await resCentros.json());
    if (resCategorias.ok) setCategorias(await resCategorias.json());
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  function toggleCategoria(id: string) {
    setSeleccionadas((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function onGuardar() {
    setErrorForm(null);
    if (!nombre.trim()) {
      setErrorForm("Falta el nombre");
      return;
    }
    setGuardando(true);
    const res = await apiFetch("/api/centros-costo", {
      method: "POST",
      body: JSON.stringify({ nombre, categoria_gasto_ids: Array.from(seleccionadas) }),
    });
    setGuardando(false);
    if (!res.ok) {
      const b = await res.json().catch(() => ({}));
      setErrorForm(b.error ?? "No se pudo guardar");
      return;
    }
    setFormAbierto(false);
    setNombre("");
    setSeleccionadas(new Set());
    cargar();
  }

  async function onEliminar(id: string) {
    const res = await apiFetch(`/api/centros-costo/${id}`, { method: "DELETE" });
    if (res.ok) cargar();
  }

  const formulario = (
    <Card>
      <p className="mb-ds-4 font-ds-body text-ds-small font-semibold text-ds-text">Nuevo centro de costo</p>
      <Input etiqueta="Nombre" valor={nombre} onCambio={setNombre} />
      {categorias.length > 0 && (
        <div className="mt-ds-4 flex flex-col gap-ds-1">
          <label className="font-ds-body text-ds-caption font-medium text-ds-text/70">Categorías de gasto asociadas</label>
          <div className="flex flex-wrap gap-ds-2">
            {categorias.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => toggleCategoria(c.id)}
                className={`flex items-center gap-1.5 rounded-ds-pill border px-ds-3 py-1 font-ds-body text-ds-caption font-medium transition-colors ${
                  seleccionadas.has(c.id) ? "border-ds-brand bg-ds-brand/[0.08] text-ds-brand" : "border-ds-divider text-ds-text/70 hover:border-ds-text/30"
                }`}
              >
                <span className="h-2 w-2 rounded-ds-pill" style={{ background: c.color }} />
                {c.nombre}
              </button>
            ))}
          </div>
        </div>
      )}
      {errorForm ? <p className="mt-ds-3 font-ds-body text-ds-small text-ds-accent-700">{errorForm}</p> : null}
      <div className="mt-ds-4 flex gap-ds-3">
        <Button onPress={onGuardar} cargando={guardando}>
          Guardar
        </Button>
        <Button variante="ghost" onPress={() => setFormAbierto(false)}>
          Cancelar
        </Button>
      </div>
    </Card>
  );

  return (
    <div className="flex flex-col gap-ds-6">
      <div className="flex flex-wrap items-center justify-between gap-ds-3">
        <div>
          <p className="ds-heading text-ds-h3 text-ds-text">Centros de Costo</p>
          <p className="mt-ds-1 font-ds-body text-ds-small text-ds-text/70">Agrupa gastos por área o proyecto</p>
        </div>
        {!formAbierto && (
          <Button iconoIzq={<Plus size={16} strokeWidth={2.75} />} onPress={() => setFormAbierto(true)}>
            Nuevo Centro de Costo
          </Button>
        )}
      </div>

      {formAbierto && formulario}

      {error ? <p className="font-ds-body text-ds-small text-ds-accent-700">{error}</p> : null}
      {centros !== null && centros.length === 0 && !formAbierto && (
        <Card>
          <div className="flex flex-col items-center gap-ds-3 py-16 text-center">
            <Layers size={28} strokeWidth={2.75} className="text-ds-text/60" />
            <p className="font-ds-body text-ds-small text-ds-text/70">Ningún centro de costo registrado.</p>
            <Button iconoIzq={<Plus size={16} strokeWidth={2.75} />} onPress={() => setFormAbierto(true)}>
              Nuevo Centro de Costo
            </Button>
          </div>
        </Card>
      )}
      {centros && centros.length > 0 && (
        <DataTable
          rows={centros}
          rowKey={(c) => c.id}
          columns={[
            { header: "Nombre", cell: (c) => <span className="font-medium text-ds-text">{c.nombre}</span> },
            { header: "Categorías", cell: (c) => <span className="text-ds-text/60">{c.categorias.length > 0 ? c.categorias.join(", ") : "—"}</span> },
          ]}
          actions={[{ label: "Eliminar", onClick: (c) => onEliminar(c.id), variant: "danger" }]}
          emptyState={{ icon: Layers, message: "Ningún centro de costo registrado." }}
        />
      )}
    </div>
  );
}
