"use client";

import { useCallback, useEffect, useState } from "react";
import type { CatalogoItem, EstadoOS, UnidadMedida } from "@bitacora/shared";
import { apiFetch } from "@/lib/api";
import { Button, Card, ErrorText, Input, Label, PageHeader, SuccessText } from "@/components/ui";
import { DataTable } from "@/components/DataTable";
import { IconBox, IconLayers } from "@/components/icons";
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
    <div className="flex flex-col gap-6">
      <PageHeader title="Inventario" subtitle="Control de stock de productos" />
      <p className="-mt-2 max-w-2xl text-sm text-muted">
        Estas reglas (umbral de stock, unidades de medida) solo aplican a los ítems tipo <strong className="text-foreground">Producto</strong>{" "}
        que crees en Catálogo — no afectan a los ítems tipo Servicio ni Kit.
      </p>
      <Card>
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-soft text-brand">
              <IconBox className="h-4.5 w-4.5" />
            </div>
            <div>
              <p className="font-medium text-foreground">Control de inventario</p>
              <p className="mt-1 max-w-md text-sm text-muted">
                Al activarlo, el sistema empieza a rastrear el saldo de tus productos — cada venta o uso descuenta stock,
                y puedes ver cuándo un producto está por agotarse.
              </p>
              {hayProductos === false && !activado && (
                <p className="mt-1.5 max-w-md text-xs text-muted">
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
            className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${activado ? "bg-brand" : "bg-border"} ${
              hayProductos === false && !activado ? "cursor-not-allowed opacity-50" : ""
            }`}
          >
            <span
              className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                activado ? "translate-x-5" : "translate-x-0.5"
              }`}
            />
          </button>
        </div>

        <div className="mt-5 max-w-xs border-t border-border pt-5">
          <Label>Umbral de stock mínimo por defecto</Label>
          <Input type="number" min={0} value={stockMinimoDefault} onChange={(e) => setStockMinimoDefault(e.target.value)} />
          <p className="mt-1.5 text-xs text-muted">
            Se usa para los productos que no tienen su propio umbral definido — decide cuándo se muestran como &ldquo;stock bajo&rdquo;.
          </p>
        </div>

        <div className="mt-5 border-t border-border pt-5">
          <Label>Descontar stock cuando la OS alcance el estado</Label>
          <div className="mt-2 flex flex-col gap-2">
            {ESTADOS_DISPARADOR.map((e) => (
              <label key={e.valor} className="flex cursor-pointer items-center gap-2.5 text-sm text-foreground">
                <input
                  type="radio"
                  name="descontar-en-estado"
                  checked={descontarEnEstado === e.valor}
                  onChange={() => setDescontarEnEstado(e.valor)}
                  className="accent-brand"
                />
                {e.etiqueta}
                {e.recomendado && <span className="text-xs font-medium text-brand">(recomendado)</span>}
              </label>
            ))}
          </div>
        </div>

        <div className="mt-5 flex items-start justify-between gap-4 border-t border-border pt-5">
          <div>
            <p className="text-sm font-medium text-foreground">Permitir stock negativo</p>
            <p className="mt-1 max-w-md text-xs text-muted">
              Si lo desactivás, el sistema igual descuenta el stock (no bloquea la OS) pero te avisa cuando no había
              suficiente.
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={permitirNegativo}
            onClick={() => setPermitirNegativo((v) => !v)}
            className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${permitirNegativo ? "bg-brand" : "bg-border"}`}
          >
            <span
              className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                permitirNegativo ? "translate-x-5" : "translate-x-0.5"
              }`}
            />
          </button>
        </div>

        <div className="mt-5 flex items-start justify-between gap-4 border-t border-border pt-5">
          <div>
            <p className="text-sm font-medium text-foreground">Descontar solo una vez por OS</p>
            <p className="mt-1 max-w-md text-xs text-muted">
              Evita que una OS descuente stock dos veces si vuelve a pasar por el estado configurado (ej. se edita y se
              vuelve a guardar). Recomendado dejarlo activado.
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={descontarUnaVez}
            onClick={() => setDescontarUnaVez((v) => !v)}
            className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${descontarUnaVez ? "bg-brand" : "bg-border"}`}
          >
            <span
              className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                descontarUnaVez ? "translate-x-5" : "translate-x-0.5"
              }`}
            />
          </button>
        </div>

        {error && (
          <div className="mt-4">
            <ErrorText>{error}</ErrorText>
          </div>
        )}
        {aviso && (
          <div className="mt-4">
            <SuccessText>{aviso}</SuccessText>
          </div>
        )}
        <Button type="button" onClick={onGuardar} disabled={guardando} className="mt-4">
          {guardando ? "Guardando…" : "Guardar configuración"}
        </Button>
      </Card>

      <Card>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-foreground">Unidades de medida</h2>
          <Button type="button" variant="outline" onClick={() => setFormUnidadAbierto((v) => !v)}>
            {formUnidadAbierto ? "Cancelar" : "Nueva unidad"}
          </Button>
        </div>

        {unidades !== null && unidades.length === 0 && !formUnidadAbierto && (
          <div className="mb-4">
            <p className="mb-3 text-sm text-muted">Sugeridas — clic para crear:</p>
            <div className="flex flex-wrap gap-2">
              {SUGERIDAS.map((s) => (
                <button
                  key={s.nombre}
                  type="button"
                  onClick={() => crearUnidadRapida(s)}
                  className="rounded-full border border-border px-3 py-1 text-xs font-medium text-foreground hover:border-brand"
                >
                  {s.nombre} ({s.abreviatura})
                </button>
              ))}
            </div>
          </div>
        )}

        {formUnidadAbierto && (
          <div className="mb-4 rounded-xl border border-border p-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label>Nombre</Label>
                <Input type="text" value={nombreUnidad} onChange={(e) => setNombreUnidad(e.target.value)} />
              </div>
              <div>
                <Label>Abreviatura</Label>
                <Input type="text" placeholder="kg, L, un…" value={abreviaturaUnidad} onChange={(e) => setAbreviaturaUnidad(e.target.value)} />
              </div>
            </div>
            {errorFormUnidad && (
              <div className="mt-3">
                <ErrorText>{errorFormUnidad}</ErrorText>
              </div>
            )}
            <Button type="button" onClick={onGuardarUnidad} disabled={guardandoUnidad} className="mt-4">
              {guardandoUnidad ? "Guardando…" : "Guardar"}
            </Button>
          </div>
        )}

        <DataTable
          rows={unidades ?? []}
          rowKey={(u) => u.id}
          loading={unidades === null && !errorUnidades}
          error={errorUnidades}
          columns={[
            { header: "Nombre", cell: (u) => <span className="font-medium text-foreground">{u.nombre}</span> },
            { header: "Abreviatura", cell: (u) => <span className="text-muted">{u.abreviatura ?? "—"}</span> },
          ]}
          actions={[{ label: "Eliminar", onClick: (u) => onEliminarUnidad(u.id), variant: "danger" }]}
          emptyState={{ icon: IconLayers, message: "Todavía no hay unidades — usa las sugeridas de arriba o crea una nueva." }}
        />
      </Card>
    </div>
  );
}
