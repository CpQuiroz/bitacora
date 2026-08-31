"use client";

import { useCallback, useEffect, useState } from "react";
import type { AplicaDocumento, SugerenciaRubro, TipoDocumento } from "@bitacora/shared";
import { apiFetch } from "@/lib/api";
import { Badge, Button, Card, ErrorText, Input, Label, PageHeader, Select } from "@/components/ui";
import { DataTable } from "@/components/DataTable";
import { IconPaperclip, IconPlus } from "@/components/icons";

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
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <PageHeader title="Tipos de Documento" subtitle="Licencias, permisos y certificados que se pueden adjuntar en Flota" />
        <Button type="button" onClick={() => (formAbierto ? limpiarForm() : setFormAbierto(true))}>
          <IconPlus className="h-4 w-4" />
          Nuevo Tipo
        </Button>
      </div>

      {tipos !== null && tipos.length === 0 && (
        <Card>
          <p className="mb-3 text-sm text-muted">Sugeridos — clic para crear:</p>
          <div className="flex flex-wrap gap-2">
            {sugeridosFinal.map((s) => (
              <button
                key={s.nombre}
                type="button"
                onClick={() => crearRapido(s)}
                className="flex items-center gap-1 rounded-full border border-border px-3 py-1 text-xs font-medium text-foreground hover:border-brand"
              >
                <IconPlus className="h-3 w-3" />
                {s.nombre}
              </button>
            ))}
          </div>
        </Card>
      )}

      {formAbierto && (
        <Card>
          <h2 className="mb-4 text-sm font-semibold text-foreground">Nuevo tipo de documento</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label>Nombre</Label>
              <Input type="text" value={nombre} onChange={(e) => setNombre(e.target.value)} />
            </div>
            <div>
              <Label>Aplica a</Label>
              <Select value={aplicaA} onChange={(e) => setAplicaA(e.target.value as AplicaDocumento)}>
                {APLICA.map((a) => (
                  <option key={a.valor} value={a.valor}>
                    {a.etiqueta}
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
          <Button type="button" onClick={onGuardar} disabled={guardando} className="mt-4">
            {guardando ? "Guardando…" : "Guardar"}
          </Button>
        </Card>
      )}

      {error && <ErrorText>{error}</ErrorText>}
      <DataTable
        rows={tipos ?? []}
        rowKey={(t) => t.id}
        loading={tipos === null && !error}
        columns={[
          { header: "Nombre", cell: (t) => <span className="font-medium text-foreground">{t.nombre}</span> },
          { header: "Aplica a", cell: (t) => <span className="text-muted">{APLICA.find((a) => a.valor === t.aplica_a)?.etiqueta}</span> },
          { header: "Estado", cell: (t) => <Badge value={t.activo ? "activo" : "inactivo"} /> },
        ]}
        actions={[{ label: (t) => (t.activo ? "Desactivar" : "Activar"), onClick: onAlternarActivo, variant: "muted" }]}
        emptyState={{ icon: IconPaperclip, message: "Todavía no hay tipos de documento — usa los sugeridos de arriba o crea uno nuevo." }}
      />
    </div>
  );
}
