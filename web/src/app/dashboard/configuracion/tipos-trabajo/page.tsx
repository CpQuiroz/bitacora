"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus, Wrench } from "lucide-react";
import type { CampoTipoTrabajo, TipoTrabajo } from "@bitacora/shared";
import { apiFetch } from "@/lib/api";
import { Button, Card, Input, Select, StatusBadge, Table } from "@bitacora/ui/web";

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

// PASO 6 (sistema de diseño) — migrado. Ver docs/design-system.md.
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
    <div className="flex flex-col gap-ds-6">
      <div className="flex flex-wrap items-center justify-between gap-ds-3">
        <div>
          <p className="ds-heading text-ds-h3 text-ds-text">Tipos de Trabajo</p>
          <p className="mt-ds-1 font-ds-body text-ds-small text-ds-text/70">
            Define qué datos se piden en terreno según el tipo de servicio (ej. pH y cloro para mantención de agua)
          </p>
        </div>
        <Button iconoIzq={<Plus size={16} strokeWidth={2.75} />} onPress={() => (formAbierto ? limpiarForm() : setFormAbierto(true))}>
          Nuevo Tipo
        </Button>
      </div>

      {formAbierto && (
        <Card>
          <p className="mb-ds-4 font-ds-body text-ds-small font-semibold text-ds-text">
            {editandoId ? "Editar tipo de trabajo" : "Nuevo tipo de trabajo"}
          </p>
          <Input etiqueta="Nombre" placeholder="ej: Mantención de Tratamiento de Agua" valor={nombre} onCambio={setNombre} />

          <div className="mt-ds-5">
            <div className="mb-ds-2 flex items-center justify-between">
              <label className="font-ds-body text-ds-caption font-medium text-ds-text/70">Campos personalizados</label>
              <Button variante="secundario" tamano="sm" onPress={agregarCampo} iconoIzq={<Plus size={14} strokeWidth={2.75} />}>
                Agregar campo
              </Button>
            </div>
            <p className="mb-ds-3 font-ds-body text-ds-caption text-ds-text/60">
              Estos campos aparecen en la app móvil y en el detalle de la OS al cerrar un trabajo de este tipo.
            </p>
            <div className="flex flex-col gap-ds-3">
              {campos.map((c, i) => (
                <div key={i} className="grid grid-cols-[1fr_1fr_8rem_auto] items-end gap-ds-2 rounded-ds-md border border-ds-divider p-ds-3">
                  <Input
                    etiqueta={i === 0 ? "Etiqueta" : undefined}
                    placeholder="ej: pH"
                    valor={c.etiqueta}
                    onCambio={(v) => {
                      const claveAuto = c.clave === slugificar(c.etiqueta) || !c.clave;
                      actualizarCampo(i, { etiqueta: v, clave: claveAuto ? slugificar(v) : c.clave });
                    }}
                  />
                  <Input etiqueta={i === 0 ? "Clave interna" : undefined} placeholder="ph" valor={c.clave} onCambio={(v) => actualizarCampo(i, { clave: slugificar(v) })} />
                  <Select
                    etiqueta={i === 0 ? "Tipo" : undefined}
                    valor={c.tipo}
                    onCambio={(v) => actualizarCampo(i, { tipo: v as CampoTipoTrabajo["tipo"] })}
                    opciones={TIPOS_CAMPO.map((t) => ({ valor: t.valor, etiqueta: t.etiqueta }))}
                  />
                  <Button variante="ghost" onPress={() => quitarCampo(i)} deshabilitado={campos.length === 1}>
                    Quitar
                  </Button>
                </div>
              ))}
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

      <div className="flex flex-wrap items-center gap-ds-3">
        <div className="max-w-xs flex-1">
          <Input placeholder="Buscar por nombre" valor={busqueda} onCambio={setBusqueda} />
        </div>
        <label className="flex items-center gap-ds-2 font-ds-body text-ds-small text-ds-text/70">
          <input type="checkbox" checked={mostrarInactivos} onChange={(e) => setMostrarInactivos(e.target.checked)} className="accent-[var(--ds-brand)]" />
          Mostrar inactivos
        </label>
      </div>

      {error ? <p className="font-ds-body text-ds-small text-ds-accent-700">{error}</p> : null}

      <Table
        filas={filtrados}
        claveFila={(t) => t.id}
        cargando={tipos === null && !error}
        columnas={[
          { encabezado: "Nombre", celda: (t) => <span className="font-medium text-ds-text">{t.nombre}</span> },
          {
            encabezado: "Campos personalizados",
            celda: (t) =>
              t.campos.length > 0 ? (
                <div className="flex flex-wrap gap-1">
                  {t.campos.map((c) => (
                    <span key={c.clave} className="rounded-ds-pill bg-ds-brand/[0.08] px-2 py-0.5 text-[11px] text-ds-brand">
                      {c.etiqueta}
                    </span>
                  ))}
                </div>
              ) : (
                <span className="text-ds-text/60">Sin campos</span>
              ),
          },
          { encabezado: "Estado", celda: (t) => <StatusBadge estado={t.activo ? "activo" : "inactivo"} /> },
        ]}
        acciones={[
          { etiqueta: "Editar", onPress: abrirEdicion, tono: "brand" },
          { etiqueta: (t) => (t.activo ? "Desactivar" : "Activar"), onPress: onAlternarActivo, tono: "muted" },
          { etiqueta: "Eliminar", onPress: (t) => onEliminar(t.id), tono: "peligro" },
        ]}
        vacio={
          tipos !== null && tipos.length === 0
            ? { icono: <Wrench size={28} strokeWidth={2.75} />, titulo: "Ningún tipo de trabajo creado", mensaje: "Crea uno para pedir datos específicos según el servicio" }
            : { icono: <Wrench size={28} strokeWidth={2.75} />, titulo: "No hay tipos que coincidan" }
        }
      />
    </div>
  );
}
