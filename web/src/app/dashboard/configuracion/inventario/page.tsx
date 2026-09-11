"use client";

import { useCallback, useEffect, useState } from "react";
import { Box, Layers } from "lucide-react";
import type { CatalogoItem, EstadoOS, UnidadMedida } from "@bitacora/shared";
import { apiFetch } from "@/lib/api";
import { Button, Card, Input } from "@bitacora/ui/web";
import { DataTable } from "@/components/DataTable";
import { useConfiguracion } from "../ConfiguracionContext";

// Mismos estados reales de EstadoOS (packages/shared/src/types.ts) —
// no se inventan estados nuevos. "en_proceso" y "firmada" son las dos
// opciones con sentido práctico para disparar un descuento (las otras
// 3 quedan igual disponibles, por si a alguien le sirve un flujo
// distinto).
const ESTADOS_DISPARADOR: { valor: EstadoOS; etiqueta: string; recomendado?: boolean }[] = [
  { valor: "en_proceso", etiqueta: "En progreso (el colaborador hizo check-in)" },
  { valor: "completada", etiqueta: "Completada (el colaborador hizo check-out)" },
  { valor: "firmada", etiqueta: "Firmada (el cliente firmó la conformidad)", recomendado: true },
];

const SUGERIDAS: { nombre: string; abreviatura: string }[] = [
  { nombre: "Unidad", abreviatura: "un" },
  { nombre: "Caja", abreviatura: "cj" },
  { nombre: "Litro", abreviatura: "L" },
  { nombre: "Metro", abreviatura: "m" },
  { nombre: "Kilogramo", abreviatura: "kg" },
  { nombre: "Hora", abreviatura: "hr" },
  { nombre: "Par", abreviatura: "par" },
  { nombre: "Rollo", abreviatura: "rollo" },
];

// PASO 6 (sistema de diseño) — migrado. Ver docs/design-system.md.
export default function InventarioPage() {
  const { usuario, recargar } = useConfiguracion();
  const [activado, setActivado] = useState(usuario.empresa.inventario_activado);
  const [stockMinimoDefault, setStockMinimoDefault] = useState(String(usuario.empresa.inventario_stock_minimo_default));
  const [descontarEnEstado, setDescontarEnEstado] = useState<EstadoOS>(usuario.empresa.inventario_descontar_en_estado);
  const [permitirNegativo, setPermitirNegativo] = useState(usuario.empresa.inventario_permitir_negativo);
  const [descontarUnaVez, setDescontarUnaVez] = useState(usuario.empresa.inventario_descontar_una_vez);
  const [guardando, setGuardando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [hayProductos, setHayProductos] = useState<boolean | null>(null);

  const [unidades, setUnidades] = useState<UnidadMedida[] | null>(null);
  const [errorUnidades, setErrorUnidades] = useState<string | null>(null);
  const [nombreUnidad, setNombreUnidad] = useState("");
  const [abreviaturaUnidad, setAbreviaturaUnidad] = useState("");
  const [formUnidadAbierto, setFormUnidadAbierto] = useState(false);
  const [errorFormUnidad, setErrorFormUnidad] = useState<string | null>(null);
  const [guardandoUnidad, setGuardandoUnidad] = useState(false);

  const cargarUnidades = useCallback(async () => {
    setErrorUnidades(null);
    const res = await apiFetch("/api/unidades-medida");
    if (!res.ok) {
      setErrorUnidades("No se pudieron cargar las unidades de medida");
      return;
    }
    setUnidades(await res.json());
  }, []);

  useEffect(() => {
    cargarUnidades();
    apiFetch("/api/catalogo?tipo=producto")
      .then((res) => (res.ok ? (res.json() as Promise<CatalogoItem[]>) : []))
      .then((items) => setHayProductos(items.length > 0))
      .catch(() => setHayProductos(true)); // si falla la carga, no bloquear el toggle sin necesidad
  }, [cargarUnidades]);

  async function onGuardar() {
    setError(null);
    setAviso(null);
    const minimo = Number(stockMinimoDefault);
    if (!Number.isInteger(minimo) || minimo < 0) {
      setError("El umbral de stock mínimo debe ser un entero positivo");
      return;
    }
    setGuardando(true);
    const res = await apiFetch("/api/empresa", {
      method: "PATCH",
      body: JSON.stringify({
        inventario_activado: activado,
        inventario_stock_minimo_default: minimo,
        inventario_descontar_en_estado: descontarEnEstado,
        inventario_permitir_negativo: permitirNegativo,
        inventario_descontar_una_vez: descontarUnaVez,
      }),
    });
    setGuardando(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "No se pudo guardar");
      return;
    }
    await recargar();
    setAviso("Configuración guardada");
  }

  async function crearUnidadRapida(s: { nombre: string; abreviatura: string }) {
    await apiFetch("/api/unidades-medida", { method: "POST", body: JSON.stringify(s) });
    cargarUnidades();
  }

  async function onGuardarUnidad() {
    setErrorFormUnidad(null);
    if (!nombreUnidad.trim()) {
      setErrorFormUnidad("Falta el nombre");
      return;
    }
    setGuardandoUnidad(true);
    const res = await apiFetch("/api/unidades-medida", {
      method: "POST",
      body: JSON.stringify({ nombre: nombreUnidad, abreviatura: abreviaturaUnidad }),
    });
    setGuardandoUnidad(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setErrorFormUnidad(body.error ?? "No se pudo guardar");
      return;
    }
    setFormUnidadAbierto(false);
    setNombreUnidad("");
    setAbreviaturaUnidad("");
    cargarUnidades();
  }

  async function onEliminarUnidad(id: string) {
    const res = await apiFetch(`/api/unidades-medida/${id}`, { method: "DELETE" });
    if (res.ok) cargarUnidades();
  }

  return (
    <div className="flex flex-col gap-ds-6">
      <div>
        <p className="ds-heading text-ds-h3 text-ds-text">Inventario</p>
        <p className="mt-ds-1 font-ds-body text-ds-small text-ds-text/70">Control de stock de productos</p>
      </div>
      <p className="max-w-2xl font-ds-body text-ds-small text-ds-text/70">
        Estas reglas (umbral de stock, unidades de medida) solo aplican a los ítems tipo <strong className="text-ds-text">Producto</strong>{" "}
        que crees en Catálogo — no afectan a los ítems tipo Servicio ni Kit.
      </p>
      <Card>
        <div className="flex items-start justify-between gap-ds-4">
          <div className="flex items-start gap-ds-3">
            <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-ds-lg bg-ds-brand/[0.08] text-ds-brand">
              <Box size={18} strokeWidth={2.75} />
            </div>
            <div>
              <p className="font-medium text-ds-text">Control de inventario</p>
              <p className="mt-ds-1 max-w-md font-ds-body text-ds-small text-ds-text/70">
                Al activarlo, el sistema empieza a rastrear el saldo de tus productos — cada venta o uso descuenta stock,
                y puedes ver cuándo un producto está por agotarse.
              </p>
              {hayProductos === false && !activado && (
                <p className="mt-ds-1.5 max-w-md font-ds-body text-ds-caption text-ds-text/60">
                  Todavía no tienes productos en Catálogo — crea al menos uno antes de activar el control de inventario.
                </p>
              )}
            </div>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={activado}
            disabled={hayProductos === false && !activado}
            onClick={() => setActivado((v) => !v)}
            className={`relative h-6 w-11 shrink-0 rounded-ds-pill transition-colors ${activado ? "bg-ds-brand" : "bg-ds-divider"} ${
              hayProductos === false && !activado ? "cursor-not-allowed opacity-50" : ""
            }`}
          >
            <span
              className={`absolute top-0.5 h-5 w-5 rounded-ds-pill bg-white shadow transition-transform ${
                activado ? "translate-x-5" : "translate-x-0.5"
              }`}
            />
          </button>
        </div>

        <div className="mt-ds-5 max-w-xs border-t border-ds-divider pt-ds-5">
          <Input
            etiqueta="Umbral de stock mínimo por defecto"
            tipo="numero"
            valor={stockMinimoDefault}
            onCambio={setStockMinimoDefault}
            ayuda='Se usa para los productos que no tienen su propio umbral definido — decide cuándo se muestran como "stock bajo".'
          />
        </div>

        <div className="mt-ds-5 border-t border-ds-divider pt-ds-5">
          <label className="font-ds-body text-ds-caption font-medium text-ds-text/70">Descontar stock cuando la OS alcance el estado</label>
          <div className="mt-ds-2 flex flex-col gap-ds-2">
            {ESTADOS_DISPARADOR.map((e) => (
              <label key={e.valor} className="flex cursor-pointer items-center gap-2.5 font-ds-body text-ds-small text-ds-text">
                <input
                  type="radio"
                  name="descontar-en-estado"
                  checked={descontarEnEstado === e.valor}
                  onChange={() => setDescontarEnEstado(e.valor)}
                  className="accent-[var(--ds-brand)]"
                />
                {e.etiqueta}
                {e.recomendado && <span className="font-ds-body text-ds-caption font-medium text-ds-brand">(recomendado)</span>}
              </label>
            ))}
          </div>
        </div>

        <div className="mt-ds-5 flex items-start justify-between gap-ds-4 border-t border-ds-divider pt-ds-5">
          <div>
            <p className="font-ds-body text-ds-small font-medium text-ds-text">Permitir stock negativo</p>
            <p className="mt-ds-1 max-w-md font-ds-body text-ds-caption text-ds-text/60">
              Si lo desactivás, el sistema igual descuenta el stock (no bloquea la OS) pero te avisa cuando no había
              suficiente.
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={permitirNegativo}
            onClick={() => setPermitirNegativo((v) => !v)}
            className={`relative h-6 w-11 shrink-0 rounded-ds-pill transition-colors ${permitirNegativo ? "bg-ds-brand" : "bg-ds-divider"}`}
          >
            <span
              className={`absolute top-0.5 h-5 w-5 rounded-ds-pill bg-white shadow transition-transform ${
                permitirNegativo ? "translate-x-5" : "translate-x-0.5"
              }`}
            />
          </button>
        </div>

        <div className="mt-ds-5 flex items-start justify-between gap-ds-4 border-t border-ds-divider pt-ds-5">
          <div>
            <p className="font-ds-body text-ds-small font-medium text-ds-text">Descontar solo una vez por OS</p>
            <p className="mt-ds-1 max-w-md font-ds-body text-ds-caption text-ds-text/60">
              Evita que una OS descuente stock dos veces si vuelve a pasar por el estado configurado (ej. se edita y se
              vuelve a guardar). Recomendado dejarlo activado.
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={descontarUnaVez}
            onClick={() => setDescontarUnaVez((v) => !v)}
            className={`relative h-6 w-11 shrink-0 rounded-ds-pill transition-colors ${descontarUnaVez ? "bg-ds-brand" : "bg-ds-divider"}`}
          >
            <span
              className={`absolute top-0.5 h-5 w-5 rounded-ds-pill bg-white shadow transition-transform ${
                descontarUnaVez ? "translate-x-5" : "translate-x-0.5"
              }`}
            />
          </button>
        </div>

        {error ? <p className="mt-ds-4 font-ds-body text-ds-small text-ds-accent-700">{error}</p> : null}
        {aviso ? <p className="mt-ds-4 font-ds-body text-ds-small font-medium text-ds-accent2-800">{aviso}</p> : null}
        <div className="mt-ds-4">
          <Button onPress={onGuardar} cargando={guardando}>
            Guardar configuración
          </Button>
        </div>
      </Card>

      <Card>
        <div className="mb-ds-4 flex flex-wrap items-center justify-between gap-ds-3">
          <p className="font-ds-body text-ds-small font-semibold text-ds-text">Unidades de medida</p>
          <Button variante="secundario" onPress={() => setFormUnidadAbierto((v) => !v)}>
            {formUnidadAbierto ? "Cancelar" : "Nueva unidad"}
          </Button>
        </div>

        {unidades !== null && unidades.length === 0 && !formUnidadAbierto && (
          <div className="mb-ds-4">
            <p className="mb-ds-3 font-ds-body text-ds-small text-ds-text/70">Sugeridas — clic para crear:</p>
            <div className="flex flex-wrap gap-ds-2">
              {SUGERIDAS.map((s) => (
                <button
                  key={s.nombre}
                  type="button"
                  onClick={() => crearUnidadRapida(s)}
                  className="rounded-ds-pill border border-ds-divider px-ds-3 py-1 font-ds-body text-ds-caption font-medium text-ds-text hover:border-ds-brand"
                >
                  {s.nombre} ({s.abreviatura})
                </button>
              ))}
            </div>
          </div>
        )}

        {formUnidadAbierto && (
          <div className="mb-ds-4 rounded-ds-lg border border-ds-divider p-ds-4">
            <div className="grid gap-ds-4 sm:grid-cols-2">
              <Input etiqueta="Nombre" valor={nombreUnidad} onCambio={setNombreUnidad} />
              <Input etiqueta="Abreviatura" placeholder="kg, L, un…" valor={abreviaturaUnidad} onCambio={setAbreviaturaUnidad} />
            </div>
            {errorFormUnidad ? <p className="mt-ds-3 font-ds-body text-ds-small text-ds-accent-700">{errorFormUnidad}</p> : null}
            <div className="mt-ds-4">
              <Button onPress={onGuardarUnidad} cargando={guardandoUnidad}>
                Guardar
              </Button>
            </div>
          </div>
        )}

        <DataTable
          rows={unidades ?? []}
          rowKey={(u) => u.id}
          loading={unidades === null && !errorUnidades}
          error={errorUnidades}
          columns={[
            { header: "Nombre", cell: (u) => <span className="font-medium text-ds-text">{u.nombre}</span> },
            { header: "Abreviatura", cell: (u) => <span className="text-ds-text/60">{u.abreviatura ?? "—"}</span> },
          ]}
          actions={[{ label: "Eliminar", onClick: (u) => onEliminarUnidad(u.id), variant: "danger" }]}
          emptyState={{ icon: Layers, message: "Todavía no hay unidades — usa las sugeridas de arriba o crea una nueva." }}
        />
      </Card>
    </div>
  );
}
