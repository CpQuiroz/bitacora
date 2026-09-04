"use client";

import { useCallback, useEffect, useState } from "react";
import type { CampoTipoTrabajo, TipoTrabajo } from "@bitacora/shared";
import { apiFetch } from "@/lib/api";
import { Badge, Button, Card, ErrorText, Input, Label, PageHeader, Select } from "@/components/ui";
import { IconPlus, IconWrench } from "@/components/icons";
import { EstadoVacio } from "@/components/estados";

const TIPOS_CAMPO: { valor: CampoTipoTrabajo["tipo"]; etiqueta: string }[] = [
  { valor: "texto", etiqueta: "Texto" },
  { valor: "numero", etiqueta: "Número" },
  { valor: "fecha", etiqueta: "Fecha" },
  { valor: "booleano", etiqueta: "Sí/No" },
];

function slugificar(texto: string) {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

const CAMPO_VACIO: CampoTipoTrabajo = { clave: "", etiqueta: "", tipo: "texto" };

export default function TiposTrabajoPage() {
  const [tipos, setTipos] = useState<TipoTrabajo[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState("");
  const [mostrarInactivos, setMostrarInactivos] = useState(false);

  const [formAbierto, setFormAbierto] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [nombre, setNombre] = useState("");
  const [campos, setCampos] = useState<CampoTipoTrabajo[]>([{ ...CAMPO_VACIO }]);
  const [guardando, setGuardando] = useState(false);
  const [errorForm, setErrorForm] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setError(null);
    const res = await apiFetch("/api/tipos-trabajo");
    if (!res.ok) {
      setError("No se pudieron cargar los tipos de trabajo");
      return;
    }
    setTipos(await res.json());
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const filtrados = (tipos ?? []).filter((t) => {
    if (!mostrarInactivos && !t.activo) return false;
    const q = busqueda.trim().toLowerCase();
    if (!q) return true;
    return t.nombre.toLowerCase().includes(q);
  });

  function limpiarForm() {
    setFormAbierto(false);
    setEditandoId(null);
    setNombre("");
    setCampos([{ ...CAMPO_VACIO }]);
    setErrorForm(null);
  }

  function abrirEdicion(t: TipoTrabajo) {
    setEditandoId(t.id);
    setNombre(t.nombre);
    setCampos(t.campos.length > 0 ? t.campos : [{ ...CAMPO_VACIO }]);
    setFormAbierto(true);
  }

  function actualizarCampo(i: number, cambios: Partial<CampoTipoTrabajo>) {
    setCampos((prev) => prev.map((c, idx) => (idx === i ? { ...c, ...cambios } : c)));
  }
  function agregarCampo() {
    setCampos((prev) => [...prev, { ...CAMPO_VACIO }]);
  }
  function quitarCampo(i: number) {
    setCampos((prev) => prev.filter((_, idx) => idx !== i));
  }

  async function onGuardar() {
    setErrorForm(null);
    if (!nombre.trim()) {
      setErrorForm("Falta el nombre");
      return;
    }
    const camposValidos = campos.filter((c) => c.etiqueta.trim());
    if (camposValidos.some((c) => !c.clave.trim())) {
      setErrorForm("Cada campo necesita una clave (se genera sola desde la etiqueta)");
      return;
    }
    setGuardando(true);
    const body = JSON.stringify({ nombre, campos: camposValidos });
    const res = editandoId
      ? await apiFetch(`/api/tipos-trabajo/${editandoId}`, { method: "PATCH", body })
      : await apiFetch("/api/tipos-trabajo", { method: "POST", body });
    setGuardando(false);
    if (!res.ok) {
      const b = await res.json().catch(() => ({}));
      setErrorForm(b.error ?? "No se pudo guardar");
      return;
    }
    limpiarForm();
    cargar();
  }

  async function onAlternarActivo(t: TipoTrabajo) {
    const res = await apiFetch(`/api/tipos-trabajo/${t.id}`, { method: "PATCH", body: JSON.stringify({ activo: !t.activo }) });
    if (res.ok) cargar();
  }

  async function onEliminar(id: string) {
    if (!window.confirm("¿Eliminar este tipo de trabajo?")) return;
    const res = await apiFetch(`/api/tipos-trabajo/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const b = await res.json().catch(() => ({}));
      setError(b.error ?? "No se pudo eliminar");
      return;
    }
    cargar();
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <PageHeader
          title="Tipos de Trabajo"
          subtitle="Define qué datos se piden en terreno según el tipo de servicio (ej. pH y cloro para mantención de agua)"
        />
        <Button type="button" onClick={() => (formAbierto ? limpiarForm() : setFormAbierto(true))}>
          <IconPlus className="h-4 w-4" />
          Nuevo Tipo
        </Button>
      </div>

      {formAbierto && (
        <Card>
          <h2 className="mb-4 text-sm font-semibold text-foreground">
            {editandoId ? "Editar tipo de trabajo" : "Nuevo tipo de trabajo"}
          </h2>
          <div>
            <Label>Nombre</Label>
            <Input
              type="text"
              placeholder="ej: Mantención de Tratamiento de Agua"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
            />
          </div>

          <div className="mt-5">
            <div className="mb-2 flex items-center justify-between">
              <Label>Campos personalizados</Label>
              <Button type="button" variant="outline" onClick={agregarCampo}>
                <IconPlus className="h-3.5 w-3.5" />
                Agregar campo
              </Button>
            </div>
            <p className="mb-3 text-xs text-muted">
              Estos campos aparecen en la app móvil y en el detalle de la OS al cerrar un trabajo de este tipo.
            </p>
            <div className="flex flex-col gap-3">
              {campos.map((c, i) => (
                <div key={i} className="grid grid-cols-[1fr_1fr_8rem_auto] items-end gap-2 rounded-lg border border-border p-3">
                  <div>
                    {i === 0 && <Label>Etiqueta</Label>}
                    <Input
                      type="text"
                      placeholder="ej: pH"
                      value={c.etiqueta}
                      onChange={(e) => {
                        const etiqueta = e.target.value;
                        const claveAuto = c.clave === slugificar(c.etiqueta) || !c.clave;
                        actualizarCampo(i, { etiqueta, clave: claveAuto ? slugificar(etiqueta) : c.clave });
                      }}
                    />
                  </div>
                  <div>
                    {i === 0 && <Label>Clave interna</Label>}
                    <Input
                      type="text"
                      placeholder="ph"
                      value={c.clave}
                      onChange={(e) => actualizarCampo(i, { clave: slugificar(e.target.value) })}
                    />
                  </div>
                  <div>
                    {i === 0 && <Label>Tipo</Label>}
                    <Select value={c.tipo} onChange={(e) => actualizarCampo(i, { tipo: e.target.value as CampoTipoTrabajo["tipo"] })}>
                      {TIPOS_CAMPO.map((t) => (
                        <option key={t.valor} value={t.valor}>
                          {t.etiqueta}
                        </option>
                      ))}
                    </Select>
                  </div>
                  <Button type="button" variant="ghost" onClick={() => quitarCampo(i)} disabled={campos.length === 1}>
                    Quitar
                  </Button>
                </div>
              ))}
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
        <Input type="text" placeholder="Buscar por nombre" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} className="max-w-xs" />
        <label className="flex items-center gap-2 text-sm text-muted">
          <input type="checkbox" checked={mostrarInactivos} onChange={(e) => setMostrarInactivos(e.target.checked)} className="accent-brand" />
          Mostrar inactivos
        </label>
      </div>

      {error && <ErrorText>{error}</ErrorText>}

      {tipos !== null && tipos.length === 0 && (
        <Card>
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-soft text-brand">
              <IconWrench className="h-6 w-6" />
            </div>
            <p className="font-medium text-foreground">Ningún tipo de trabajo creado</p>
            <p className="text-sm text-muted">Crea uno para pedir datos específicos según el servicio</p>
          </div>
        </Card>
      )}

      {filtrados.length === 0 && tipos !== null && tipos.length > 0 && (
        <EstadoVacio icono={IconWrench} titulo="No hay tipos que coincidan" />
      )}

      {filtrados.length > 0 && (
        <Card className="overflow-x-auto p-0">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border text-xs text-muted">
                <th className="px-5 py-3 font-medium">Nombre</th>
                <th className="px-5 py-3 font-medium">Campos personalizados</th>
                <th className="px-5 py-3 font-medium">Estado</th>
                <th className="px-5 py-3 font-medium">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filtrados.map((t) => (
                <tr key={t.id} className="border-b border-border last:border-0">
                  <td className="px-5 py-3 font-medium text-foreground">{t.nombre}</td>
                  <td className="px-5 py-3">
                    {t.campos.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {t.campos.map((c) => (
                          <span key={c.clave} className="rounded-full bg-brand-soft px-2 py-0.5 text-[11px] text-brand">
                            {c.etiqueta}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-muted">Sin campos</span>
                    )}
                  </td>
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
