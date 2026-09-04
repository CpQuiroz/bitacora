"use client";

import { useCallback, useEffect, useState } from "react";
import type { CategoriaGasto } from "@bitacora/shared";
import { apiFetch } from "@/lib/api";
import { Button, Card, ErrorText, Input, Label, PageHeader } from "@/components/ui";
import { DataTable } from "@/components/DataTable";
import { IconLayers, IconPlus } from "@/components/icons";

type CentroConCategorias = { id: string; nombre: string; categoria_gasto_ids: string[]; categorias: string[]; creado_en: string };

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
      <h2 className="mb-4 text-sm font-semibold text-foreground">Nuevo centro de costo</h2>
      <div>
        <Label>Nombre</Label>
        <Input type="text" value={nombre} onChange={(e) => setNombre(e.target.value)} />
      </div>
      {categorias.length > 0 && (
        <div className="mt-4">
          <Label>Categorías de gasto asociadas</Label>
          <div className="flex flex-wrap gap-2">
            {categorias.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => toggleCategoria(c.id)}
                className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                  seleccionadas.has(c.id) ? "border-brand bg-brand-soft text-brand" : "border-border text-muted hover:border-muted-soft"
                }`}
              >
                <span className="h-2 w-2 rounded-full" style={{ background: c.color }} />
                {c.nombre}
              </button>
            ))}
          </div>
        </div>
      )}
      {errorForm && (
        <div className="mt-3">
          <ErrorText>{errorForm}</ErrorText>
        </div>
      )}
      <div className="mt-4 flex gap-3">
        <Button type="button" onClick={onGuardar} disabled={guardando}>
          {guardando ? "Guardando…" : "Guardar"}
        </Button>
        <Button type="button" variant="ghost" onClick={() => setFormAbierto(false)}>
          Cancelar
        </Button>
      </div>
    </Card>
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <PageHeader title="Centros de Costo" subtitle="Agrupa gastos por área o proyecto" />
        {!formAbierto && (
          <Button type="button" onClick={() => setFormAbierto(true)}>
            <IconPlus className="h-4 w-4" />
            Nuevo Centro de Costo
          </Button>
        )}
      </div>

      {formAbierto && formulario}

      {error && <ErrorText>{error}</ErrorText>}
      {centros !== null && centros.length === 0 && !formAbierto && (
        <Card>
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <IconLayers className="h-8 w-8 text-muted" />
            <p className="text-sm text-muted">Ningún centro de costo registrado.</p>
            <Button type="button" onClick={() => setFormAbierto(true)}>
              <IconPlus className="h-4 w-4" />
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
            { header: "Nombre", cell: (c) => <span className="font-medium text-foreground">{c.nombre}</span> },
            { header: "Categorías", cell: (c) => <span className="text-muted">{c.categorias.length > 0 ? c.categorias.join(", ") : "—"}</span> },
          ]}
          actions={[{ label: "Eliminar", onClick: (c) => onEliminar(c.id), variant: "danger" }]}
          emptyState={{ icon: IconLayers, message: "Ningún centro de costo registrado." }}
        />
      )}
    </div>
  );
}
