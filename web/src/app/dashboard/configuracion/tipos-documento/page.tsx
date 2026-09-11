"use client";

import { useCallback, useEffect, useState } from "react";
import { Paperclip, Plus } from "lucide-react";
import type { AplicaDocumento, SugerenciaRubro, TipoDocumento } from "@bitacora/shared";
import { apiFetch } from "@/lib/api";
import { Button, Card, Input, Select, StatusBadge } from "@bitacora/ui/web";
import { DataTable } from "@/components/DataTable";

const APLICA: { valor: AplicaDocumento; etiqueta: string }[] = [
  { valor: "colaborador", etiqueta: "Solo colaboradores" },
  { valor: "vehiculo", etiqueta: "Solo vehículos" },
  { valor: "ambos", etiqueta: "Colaboradores y vehículos" },
];

const SUGERIDOS: { nombre: string; aplica_a: AplicaDocumento }[] = [
  { nombre: "Licencia de Conducir", aplica_a: "colaborador" },
  { nombre: "Certificado de Manipulación de Alimentos", aplica_a: "colaborador" },
  { nombre: "Permiso de Circulación", aplica_a: "vehiculo" },
  { nombre: "Revisión Técnica", aplica_a: "vehiculo" },
  { nombre: "Seguro Obligatorio (SOAP)", aplica_a: "vehiculo" },
];

// PASO 6 (sistema de diseño) — migrado. Ver docs/design-system.md.
export default function TiposDocumentoPage() {
  const [tipos, setTipos] = useState<TipoDocumento[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Bloque E: sugerencias según el rubro de la empresa.
  const [sugerenciasRubro, setSugerenciasRubro] = useState<SugerenciaRubro[]>([]);

  const [formAbierto, setFormAbierto] = useState(false);
  const [nombre, setNombre] = useState("");
  const [aplicaA, setAplicaA] = useState<AplicaDocumento>("ambos");
  const [guardando, setGuardando] = useState(false);
  const [errorForm, setErrorForm] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setError(null);
    const [res, resSugerencias] = await Promise.all([apiFetch("/api/tipos-documento"), apiFetch("/api/sugerencias-rubro")]);
    if (!res.ok) {
      setError("No se pudieron cargar los tipos de documento");
      return;
    }
    setTipos(await res.json());
    if (resSugerencias.ok) {
      const todas: SugerenciaRubro[] = await resSugerencias.json();
      setSugerenciasRubro(todas.filter((s) => s.tipo_sugerencia === "tipo_documento"));
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  function limpiarForm() {
    setFormAbierto(false);
    setNombre("");
    setAplicaA("ambos");
    setErrorForm(null);
  }

  async function crearRapido(s: { nombre: string; aplica_a: AplicaDocumento }) {
    await apiFetch("/api/tipos-documento", { method: "POST", body: JSON.stringify(s) });
    cargar();
  }

  async function onGuardar() {
    setErrorForm(null);
    if (!nombre.trim()) {
      setErrorForm("Falta el nombre");
      return;
    }
    setGuardando(true);
    const res = await apiFetch("/api/tipos-documento", { method: "POST", body: JSON.stringify({ nombre, aplica_a: aplicaA }) });
    setGuardando(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setErrorForm(body.error ?? "No se pudo guardar");
      return;
    }
    limpiarForm();
    cargar();
  }

  async function onAlternarActivo(t: TipoDocumento) {
    const res = await apiFetch(`/api/tipos-documento/${t.id}`, { method: "PATCH", body: JSON.stringify({ activo: !t.activo }) });
    if (res.ok) cargar();
  }

  const sugeridosFinal = [
    ...sugerenciasRubro.map((s) => ({ nombre: s.valor, aplica_a: (s.aplica_a as AplicaDocumento) ?? "ambos" })),
    ...SUGERIDOS.filter((s) => !sugerenciasRubro.some((r) => r.valor === s.nombre)),
  ];

  return (
    <div className="flex flex-col gap-ds-6">
      <div className="flex flex-wrap items-center justify-between gap-ds-3">
        <div>
          <p className="ds-heading text-ds-h3 text-ds-text">Tipos de Documento</p>
          <p className="mt-ds-1 font-ds-body text-ds-small text-ds-text/70">Licencias, permisos y certificados que se pueden adjuntar en Flota</p>
        </div>
        <Button iconoIzq={<Plus size={16} strokeWidth={2.75} />} onPress={() => (formAbierto ? limpiarForm() : setFormAbierto(true))}>
          Nuevo Tipo
        </Button>
      </div>

      {tipos !== null && tipos.length === 0 && (
        <Card>
          <p className="mb-ds-3 font-ds-body text-ds-small text-ds-text/70">Sugeridos — clic para crear:</p>
          <div className="flex flex-wrap gap-ds-2">
            {sugeridosFinal.map((s) => (
              <button
                key={s.nombre}
                type="button"
                onClick={() => crearRapido(s)}
                className="flex items-center gap-1 rounded-ds-pill border border-ds-divider px-ds-3 py-1 font-ds-body text-ds-caption font-medium text-ds-text hover:border-ds-brand"
              >
                <Plus size={12} strokeWidth={2.75} />
                {s.nombre}
              </button>
            ))}
          </div>
        </Card>
      )}

      {formAbierto && (
        <Card>
          <p className="mb-ds-4 font-ds-body text-ds-small font-semibold text-ds-text">Nuevo tipo de documento</p>
          <div className="grid gap-ds-4 sm:grid-cols-2">
            <Input etiqueta="Nombre" valor={nombre} onCambio={setNombre} />
            <Select
              etiqueta="Aplica a"
              valor={aplicaA}
              onCambio={(v) => setAplicaA(v as AplicaDocumento)}
              opciones={APLICA.map((a) => ({ valor: a.valor, etiqueta: a.etiqueta }))}
            />
          </div>
          {errorForm ? <p className="mt-ds-3 font-ds-body text-ds-small text-ds-accent-700">{errorForm}</p> : null}
          <div className="mt-ds-4">
            <Button onPress={onGuardar} cargando={guardando}>
              Guardar
            </Button>
          </div>
        </Card>
      )}

      {error ? <p className="font-ds-body text-ds-small text-ds-accent-700">{error}</p> : null}
      <DataTable
        rows={tipos ?? []}
        rowKey={(t) => t.id}
        loading={tipos === null && !error}
        columns={[
          { header: "Nombre", cell: (t) => <span className="font-medium text-ds-text">{t.nombre}</span> },
          { header: "Aplica a", cell: (t) => <span className="text-ds-text/60">{APLICA.find((a) => a.valor === t.aplica_a)?.etiqueta}</span> },
          { header: "Estado", cell: (t) => <StatusBadge estado={t.activo ? "activo" : "inactivo"} /> },
        ]}
        actions={[{ label: (t) => (t.activo ? "Desactivar" : "Activar"), onClick: onAlternarActivo, variant: "muted" }]}
        emptyState={{ icon: Paperclip, message: "Todavía no hay tipos de documento — usa los sugeridos de arriba o crea uno nuevo." }}
      />
    </div>
  );
}
