"use client";

import { useCallback, useEffect, useState } from "react";
import { Flag, Plus } from "lucide-react";
import type { CotizacionEtapa } from "@bitacora/shared";
import { apiFetch } from "@/lib/api";
import { Button, Card, Input } from "@bitacora/ui/web";
import { DataTable } from "@/components/DataTable";

// Etapa de seguimiento interno a medida de la empresa (migración 107)
// — capa cosmética en paralelo a `estado`, sin ninguna lógica propia
// (el aprobar/rechazar del Portal del Cliente y el paso a OS siguen
// dependiendo solo de `estado`, sin tocar). Pedido inspirado en el
// "Estatus de cotización" de 2Workers.
export default function CotizacionEtapasPage() {
  const [etapas, setEtapas] = useState<CotizacionEtapa[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [formAbierto, setFormAbierto] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [nombre, setNombre] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [errorForm, setErrorForm] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setError(null);
    const res = await apiFetch("/api/cotizacion-etapas");
    if (!res.ok) {
      setError("No se pudieron cargar las etapas");
      return;
    }
    setEtapas(await res.json());
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  function limpiarForm() {
    setFormAbierto(false);
    setEditandoId(null);
    setNombre("");
    setErrorForm(null);
  }

  function abrirEdicion(e: CotizacionEtapa) {
    setEditandoId(e.id);
    setNombre(e.nombre);
    setFormAbierto(true);
  }

  async function onGuardar() {
    setErrorForm(null);
    if (!nombre.trim()) {
      setErrorForm("Falta el nombre");
      return;
    }
    setGuardando(true);
    const res = editandoId
      ? await apiFetch(`/api/cotizacion-etapas/${editandoId}`, { method: "PATCH", body: JSON.stringify({ nombre }) })
      : await apiFetch("/api/cotizacion-etapas", { method: "POST", body: JSON.stringify({ nombre }) });
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
    const res = await apiFetch(`/api/cotizacion-etapas/${id}`, { method: "DELETE" });
    if (res.ok) cargar();
  }

  const formulario = (
    <Card>
      <p className="mb-ds-4 font-ds-body text-ds-small font-semibold text-ds-text">{editandoId ? "Editar etapa" : "Nueva etapa"}</p>
      <Input etiqueta="Nombre" placeholder="ej: Vendidos" valor={nombre} onCambio={setNombre} />
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
  );

  return (
    <div className="flex flex-col gap-ds-6">
      <div className="flex flex-wrap items-center justify-between gap-ds-3">
        <div>
          <p className="ds-heading text-ds-h3 text-ds-text">Etapas de Cotización</p>
          <p className="mt-ds-1 font-ds-body text-ds-small text-ds-text/70">
            Tu propio seguimiento interno (ej. Abiertos, Aprobados, Vendidos, Entregados, Cancelados) — no afecta el estado real de la cotización.
          </p>
        </div>
        {!formAbierto && (
          <Button iconoIzq={<Plus size={16} strokeWidth={2.75} />} onPress={() => setFormAbierto(true)}>
            Nueva Etapa
          </Button>
        )}
      </div>

      {formAbierto && formulario}

      <DataTable
        rows={etapas ?? []}
        rowKey={(e) => e.id}
        loading={etapas === null && !error}
        error={error}
        columns={[{ header: "Nombre", cell: (e) => <span className="font-medium text-ds-text">{e.nombre}</span> }]}
        actions={[
          { label: "Editar", onClick: abrirEdicion, variant: "brand" },
          { label: "Eliminar", onClick: (e) => onEliminar(e.id), variant: "danger" },
        ]}
        emptyState={{ icon: Flag, message: "Ninguna etapa creada todavía." }}
      />
    </div>
  );
}
