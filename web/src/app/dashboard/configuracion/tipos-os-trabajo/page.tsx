"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { TIPOS_OS_VISIBLES } from "@bitacora/shared";
import { Plus, Wrench } from "lucide-react";
import type { CampoTipoTrabajo, ChecklistTemplate, SugerenciaRubro, TipoOsTrabajo } from "@bitacora/shared";
import { apiFetch } from "@/lib/api";
import { Button, Card, Input, Select, StatusBadge } from "@bitacora/ui/web";
import { DataTable } from "@/components/DataTable";

type TipoConChecklist = TipoOsTrabajo & { checklist: { nombre: string } | null };

const TIPOS_CAMPO: { valor: CampoTipoTrabajo["tipo"]; etiqueta: string }[] = [
  { valor: "texto", etiqueta: "Texto" },
  { valor: "numero", etiqueta: "Número" },
  { valor: "fecha", etiqueta: "Fecha" },
  { valor: "booleano", etiqueta: "Sí/No" },
  // Migración 105 — el técnico sube la foto en el móvil, en el punto
  // exacto del formulario donde quedó este campo (no en la galería
  // general de fotos de la OS).
  { valor: "foto", etiqueta: "Foto" },
  // El técnico elige una de las opciones definidas abajo (ej. "Se
  // cumple con las herramientas" del informe de referencia de
  // 2Workers/Hidroservi, 17-sep-2026).
  { valor: "seleccion", etiqueta: "Selección" },
];

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

function slugificar(texto: string) {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

const CAMPO_VACIO: CampoTipoTrabajo = { clave: "", etiqueta: "", tipo: "texto" };

// Unifica lo que antes eran 2 pantallas — Tipos de Trabajo (campos
// dinámicos del formulario) y Tipos de OS (color/checklist/tiempo
// estimado) — en un solo catálogo (migración 115, 21-sep-2026): en
// Nueva OS aparecían 2 selectores casi idénticos uno debajo del otro.
// PASO 6 (sistema de diseño) — migrado. Ver docs/design-system.md.
// Tarea 145 (opción B): sección oculta (TIPOS_OS_VISIBLES = false); quien
// entre por la URL vuelve a Configuración. El contenido queda por si vuelve.
export default function TiposOsTrabajoPage() {
  const router = useRouter();
  useEffect(() => {
    if (!TIPOS_OS_VISIBLES) router.replace("/dashboard/configuracion/cuenta");
  }, [router]);
  return TIPOS_OS_VISIBLES ? <TiposOsTrabajoContenido /> : null;
}

function TiposOsTrabajoContenido() {
  const [tipos, setTipos] = useState<TipoConChecklist[] | null>(null);
  const [checklists, setChecklists] = useState<ChecklistTemplate[]>([]);
  // Bloque E: sugerencias según el rubro de la empresa — se anteponen
  // a las genéricas de siempre, sin ocultarlas.
  const [sugerenciasRubro, setSugerenciasRubro] = useState<SugerenciaRubro[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState("");
  const [mostrarInactivos, setMostrarInactivos] = useState(false);

  const [formAbierto, setFormAbierto] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [nombre, setNombre] = useState("");
  const [campos, setCampos] = useState<CampoTipoTrabajo[]>([{ ...CAMPO_VACIO }]);
  const [descripcion, setDescripcion] = useState("");
  const [color, setColor] = useState("#4338ca");
  const [checklistId, setChecklistId] = useState("");
  const [tiempoEstimado, setTiempoEstimado] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [errorForm, setErrorForm] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setError(null);
    const [resTipos, resChecklists, resSugerencias] = await Promise.all([
      apiFetch("/api/tipos-os-trabajo"),
      apiFetch("/api/checklists"),
      apiFetch("/api/sugerencias-rubro"),
    ]);
    if (!resTipos.ok) {
      setError("No se pudieron cargar los tipos de OS/Trabajo");
      return;
    }
    setTipos(await resTipos.json());
    if (resChecklists.ok) setChecklists(await resChecklists.json());
    if (resSugerencias.ok) {
      const todas: SugerenciaRubro[] = await resSugerencias.json();
      setSugerenciasRubro(todas.filter((s) => s.tipo_sugerencia === "tipo_os"));
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const sugeridosFinal = [
    ...sugerenciasRubro.map((s) => ({ nombre: s.valor, color: s.color ?? "#4338ca" })),
    ...SUGERIDOS.filter((s) => !sugerenciasRubro.some((r) => r.valor === s.nombre)),
  ];
  // Mostrar mientras queden sugerencias sin usar, no solo cuando la
  // lista está totalmente vacía (mismo criterio que tipos-documento/
  // categorias-gastos, 21-sep-2026).
  const sugeridosPendientes = sugeridosFinal.filter(
    (s) => !(tipos ?? []).some((t) => t.nombre.trim().toLowerCase() === s.nombre.trim().toLowerCase())
  );

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
    setCampos([{ ...CAMPO_VACIO }]);
    setDescripcion("");
    setColor("#4338ca");
    setChecklistId("");
    setTiempoEstimado("");
    setErrorForm(null);
  }

  function abrirEdicion(t: TipoConChecklist) {
    setEditandoId(t.id);
    setNombre(t.nombre);
    setCampos(t.campos.length > 0 ? t.campos : [{ ...CAMPO_VACIO }]);
    setDescripcion(t.descripcion ?? "");
    setColor(t.color);
    setChecklistId(t.checklist_template_id ?? "");
    setTiempoEstimado(t.tiempo_estimado_minutos != null ? String(t.tiempo_estimado_minutos) : "");
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

  async function crearRapido(s: { nombre: string; color: string }) {
    await apiFetch("/api/tipos-os-trabajo", { method: "POST", body: JSON.stringify(s) });
    cargar();
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
    // Los campos "seleccion" guardan las opciones tal como se tipearon
    // (separadas por coma) — se limpian recién al guardar.
    const camposLimpios = camposValidos.map((c) =>
      c.tipo === "seleccion" ? { ...c, opciones: (c.opciones ?? []).map((o) => o.trim()).filter(Boolean) } : c
    );
    if (camposLimpios.some((c) => c.tipo === "seleccion" && (c.opciones?.length ?? 0) === 0)) {
      setErrorForm("Los campos de tipo Selección necesitan al menos una opción");
      return;
    }
    setGuardando(true);
    const body = JSON.stringify({
      nombre,
      campos: camposLimpios,
      descripcion,
      color,
      checklist_template_id: checklistId || null,
      tiempo_estimado_minutos: tiempoEstimado.trim() ? Number(tiempoEstimado) : null,
    });
    const res = editandoId
      ? await apiFetch(`/api/tipos-os-trabajo/${editandoId}`, { method: "PATCH", body })
      : await apiFetch("/api/tipos-os-trabajo", { method: "POST", body });
    setGuardando(false);
    if (!res.ok) {
      const b = await res.json().catch(() => ({}));
      setErrorForm(b.error ?? "No se pudo guardar");
      return;
    }
    limpiarForm();
    cargar();
  }

  async function onAlternarActivo(t: TipoConChecklist) {
    const res = await apiFetch(`/api/tipos-os-trabajo/${t.id}`, { method: "PATCH", body: JSON.stringify({ activo: !t.activo }) });
    if (res.ok) cargar();
  }

  async function onEliminar(t: TipoConChecklist) {
    setError(null);
    const res = await apiFetch(`/api/tipos-os-trabajo/${t.id}`, { method: "DELETE" });
    if (res.ok) {
      cargar();
      return;
    }
    const body = await res.json().catch(() => ({}));
    setError(body.error ?? "No se pudo eliminar");
  }

  return (
    <div className="flex flex-col gap-ds-6">
      <div className="flex flex-wrap items-center justify-between gap-ds-3">
        <div>
          <p className="ds-heading text-ds-h3 text-ds-text">Tipos de OS/Trabajo</p>
          <p className="mt-ds-1 font-ds-body text-ds-small text-ds-text/70">
            Clasifica tus órdenes de servicio (color, checklist, tiempo estimado) y define qué datos se piden en terreno según el tipo de servicio
          </p>
        </div>
        <Button iconoIzq={<Plus size={16} strokeWidth={2.75} />} onPress={() => (formAbierto ? limpiarForm() : setFormAbierto(true))}>
          Nuevo Tipo
        </Button>
      </div>

      {tipos !== null && sugeridosPendientes.length > 0 && (
        <Card>
          <p className="mb-ds-3 font-ds-body text-ds-small text-ds-text/70">Sugeridos — clic para crear con un color predefinido:</p>
          <div className="flex flex-wrap gap-ds-2">
            {sugeridosPendientes.map((s) => (
              <button
                key={s.nombre}
                type="button"
                onClick={() => crearRapido(s)}
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
          <p className="mb-ds-4 font-ds-body text-ds-small font-semibold text-ds-text">{editandoId ? "Editar tipo de OS/Trabajo" : "Nuevo tipo de OS/Trabajo"}</p>
          <div className="grid gap-ds-4 sm:grid-cols-2">
            <Input etiqueta="Nombre" placeholder="ej: Mantención Preventiva" valor={nombre} onCambio={setNombre} />
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
            <div className="sm:col-span-2">
              <Input etiqueta="Descripción" valor={descripcion} onCambio={setDescripcion} />
            </div>
            <div>
              <Select
                etiqueta="Checklist predeterminado"
                valor={checklistId}
                onCambio={setChecklistId}
                placeholder="Sin checklist"
                opciones={checklists.map((c) => ({ valor: c.id, etiqueta: c.nombre }))}
              />
              <a
                href="/dashboard/configuracion/checklists"
                target="_blank"
                rel="noopener noreferrer"
                className="mt-ds-1 inline-block font-ds-body text-ds-caption font-medium text-ds-text/70 transition-colors hover:text-ds-brand"
              >
                {checklists.length === 0 ? "Crear un checklist →" : "Gestionar checklists →"}
              </a>
            </div>
            <Input etiqueta="Tiempo estimado (minutos)" tipo="numero" placeholder="60" valor={tiempoEstimado} onCambio={setTiempoEstimado} />
          </div>

          <div className="mt-ds-5">
            <div className="mb-ds-2 flex items-center justify-between">
              <label className="font-ds-body text-ds-caption font-medium text-ds-text/70">Campos personalizados</label>
              <Button variante="secundario" tamano="sm" onPress={agregarCampo} iconoIzq={<Plus size={14} strokeWidth={2.75} />}>
                Agregar campo
              </Button>
            </div>
            <p className="mb-ds-3 font-ds-body text-ds-caption text-ds-text-secondary">
              Estos campos aparecen en la app móvil y en el detalle de la OS al cerrar un trabajo de este tipo.
            </p>
            <div className="flex flex-col gap-ds-3">
              {campos.map((c, i) => (
                <div key={i} className="flex flex-col gap-ds-2 rounded-ds-md border border-ds-divider p-ds-3">
                  <div className="grid grid-cols-[1fr_1fr_8rem_auto] items-end gap-ds-2">
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
                  {c.tipo === "seleccion" ? (
                    <Input
                      etiqueta="Opciones (separadas por coma)"
                      placeholder="ej: Sí, No, Parcial"
                      valor={(c.opciones ?? []).join(",")}
                      onCambio={(v) => actualizarCampo(i, { opciones: v.split(",") })}
                    />
                  ) : null}
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
          <Input placeholder="Buscar por nombre o descripción" valor={busqueda} onCambio={setBusqueda} />
        </div>
        <label className="flex items-center gap-ds-2 font-ds-body text-ds-small text-ds-text/70">
          <input type="checkbox" checked={mostrarInactivos} onChange={(e) => setMostrarInactivos(e.target.checked)} className="accent-[var(--ds-brand)]" />
          Mostrar inactivos
        </label>
      </div>

      {error ? <p className="font-ds-body text-ds-small text-ds-accent-700">{error}</p> : null}
      <DataTable
        rows={filtrados}
        rowKey={(t) => t.id}
        loading={tipos === null && !error}
        columns={[
          { header: "", className: "w-8", cell: (t) => <span className="inline-block h-3 w-3 rounded-ds-pill" style={{ background: t.color }} /> },
          { header: "Nombre", cell: (t) => <span className="font-medium text-ds-text">{t.nombre}</span> },
          {
            header: "Campos personalizados",
            cell: (t) =>
              t.campos.length > 0 ? (
                <div className="flex flex-wrap gap-1">
                  {t.campos.map((c) => (
                    <span key={c.clave} className="rounded-ds-pill bg-ds-brand/[0.08] px-2 py-0.5 text-[11px] text-ds-brand">
                      {c.etiqueta}
                    </span>
                  ))}
                </div>
              ) : (
                <span className="text-ds-text-secondary">—</span>
              ),
          },
          { header: "Checklist", cell: (t) => <span className="text-ds-text-secondary">{t.checklist?.nombre ?? "—"}</span> },
          { header: "Tiempo estimado", cell: (t) => <span className="text-ds-text-secondary">{t.tiempo_estimado_minutos != null ? `${t.tiempo_estimado_minutos} min` : "—"}</span> },
          { header: "Estado", cell: (t) => <StatusBadge estado={t.activo ? "activo" : "inactivo"} /> },
        ]}
        actions={[
          { label: "Editar", onClick: abrirEdicion, variant: "brand" },
          { label: (t) => (t.activo ? "Desactivar" : "Activar"), onClick: onAlternarActivo, variant: "muted" },
          { label: "Eliminar", onClick: onEliminar, variant: "danger" },
        ]}
        emptyState={{ icon: Wrench, message: "Todavía no hay tipos — usa los sugeridos de arriba o crea uno nuevo." }}
      />
    </div>
  );
}
