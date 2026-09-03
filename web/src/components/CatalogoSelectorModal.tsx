"use client";

import { useEffect, useMemo, useState } from "react";
import type { CatalogoItem, TipoCatalogoItem } from "@bitacora/shared";
import { apiFetch } from "@/lib/api";
import { formatMoneda } from "@/lib/formatMoneda";
import { estadoStock } from "@/lib/estadoStock";
import { Badge, Button, Input } from "./ui";
import { Modal } from "./Modal";
import { IconBox, IconCheck, IconLayers, IconMinus, IconPlus, IconSparkle, IconWrench } from "./icons";

export type ItemSeleccionadoCatalogo = {
  catalogo_item_id: string | null;
  descripcion: string;
  cantidad: number;
  precio_unitario: number;
};

type Tab = "todos" | TipoCatalogoItem;

const TABS: { valor: Tab; etiqueta: string }[] = [
  { valor: "todos", etiqueta: "Todos" },
  { valor: "producto", etiqueta: "Productos" },
  { valor: "servicio", etiqueta: "Servicios" },
  { valor: "kit", etiqueta: "Kits" },
];

// Exportado para reusar el mismo ícono por tipo en el listado de
// Catálogo (Bloque E) — no duplicar la constante en dos lugares.
export const ICONO_TIPO: Record<TipoCatalogoItem, typeof IconBox> = {
  producto: IconBox,
  servicio: IconWrench,
  kit: IconLayers,
};

const TAMANO_PAGINA = 60;

export function CatalogoSelectorModal({
  open,
  onClose,
  onAgregar,
  moneda,
  stockMinimoDefault = 5,
  categoriaEquipoDestacar,
  avisaDescuentoStock = false,
}: {
  open: boolean;
  onClose: () => void;
  // Confirma la selección en lote — se llama UNA vez con todos los
  // ítems marcados (Bloque F). El ítem manual también pasa por acá,
  // como un arreglo de un solo elemento.
  onAgregar: (items: ItemSeleccionadoCatalogo[]) => void;
  moneda: string;
  stockMinimoDefault?: number;
  // Bloque D: categoría del Equipo asociado al documento (si hay) —
  // los ítems etiquetados con ese tipo se muestran primero, con una
  // marca visual. No oculta el resto del catálogo.
  categoriaEquipoDestacar?: string | null;
  // true en OS (los productos con stock se descuentan del inventario),
  // false en Cotización (es solo una lista de precios).
  avisaDescuentoStock?: boolean;
}) {
  const [catalogo, setCatalogo] = useState<CatalogoItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("todos");
  const [categoriaFiltro, setCategoriaFiltro] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState("");
  const [cantidades, setCantidades] = useState<Record<string, number>>({});
  const [seleccionados, setSeleccionados] = useState<Set<string>>(new Set());
  const [visibles, setVisibles] = useState(TAMANO_PAGINA);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setTab("todos");
    setCategoriaFiltro(null);
    setBusqueda("");
    setVisibles(TAMANO_PAGINA);
    setCantidades({});
    setSeleccionados(new Set());
    (async () => {
      const res = await apiFetch("/api/catalogo");
      if (!res.ok) {
        setError("No se pudo cargar el catálogo");
        return;
      }
      const items: CatalogoItem[] = await res.json();
      setCatalogo(items.filter((i) => i.activo));
    })();
  }, [open]);

  const categorias = useMemo(
    () => [...new Set((catalogo ?? []).map((i) => i.categoria).filter((c): c is string => Boolean(c)))].sort(),
    [catalogo]
  );

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    const base = (catalogo ?? []).filter((i) => {
      if (tab !== "todos" && i.tipo !== tab) return false;
      if (categoriaFiltro && i.categoria !== categoriaFiltro) return false;
      if (q && !i.nombre.toLowerCase().includes(q) && !(i.sku ?? "").toLowerCase().includes(q) && !(i.categoria ?? "").toLowerCase().includes(q)) {
        return false;
      }
      return true;
    });
    if (!categoriaEquipoDestacar) return base;
    // Destacados primero, sin ocultar el resto — sort estable.
    const destacados = base.filter((i) => i.tipos_equipo?.includes(categoriaEquipoDestacar));
    const resto = base.filter((i) => !i.tipos_equipo?.includes(categoriaEquipoDestacar));
    return [...destacados, ...resto];
  }, [catalogo, tab, categoriaFiltro, busqueda, categoriaEquipoDestacar]);

  function cantidadDe(id: string): number {
    return cantidades[id] ?? 1;
  }
  function cambiarCantidad(id: string, delta: number) {
    setCantidades((prev) => {
      const actual = prev[id] ?? 1;
      const nueva = Math.max(0.01, Math.round((actual + delta) * 100) / 100);
      return { ...prev, [id]: nueva };
    });
  }

  function alternarSeleccion(id: string) {
    setSeleccionados((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function onConfirmarSeleccion() {
    const items = (catalogo ?? [])
      .filter((item) => seleccionados.has(item.id))
      .map((item) => ({
        catalogo_item_id: item.id,
        descripcion: item.nombre,
        cantidad: cantidadDe(item.id),
        precio_unitario: item.precio_base,
      }));
    if (items.length === 0) return;
    onAgregar(items);
    onClose();
  }

  function onAgregarManual() {
    onAgregar([{ catalogo_item_id: null, descripcion: "", cantidad: 1, precio_unitario: 0 }]);
    onClose();
  }

  return (
    <Modal open={open} onClose={onClose} title="Agregar del catálogo / inventario" wide>
      <div className="flex flex-col gap-3">
        {avisaDescuentoStock && (
          <p className="rounded-lg bg-brand-soft/60 px-3 py-2 text-xs text-muted">
            Los productos con stock se descuentan del inventario cuando la OS llega al estado configurado en
            Configuración → Inventario.
          </p>
        )}
        <Input type="text" placeholder="Buscar por nombre, SKU o categoría..." value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />

        <div className="flex flex-wrap gap-2">
          {TABS.map((t) => (
            <button
              key={t.valor}
              type="button"
              onClick={() => setTab(t.valor)}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                tab === t.valor ? "border-transparent bg-brand text-brand-foreground" : "border-border text-muted hover:bg-brand-soft"
              }`}
            >
              {t.etiqueta}
            </button>
          ))}
        </div>

        {categorias.length > 0 && (
          <div className="flex flex-wrap gap-2 border-t border-border pt-3">
            <button
              type="button"
              onClick={() => setCategoriaFiltro(null)}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                categoriaFiltro === null ? "border-transparent bg-brand-soft text-brand" : "border-border text-muted hover:bg-brand-soft"
              }`}
            >
              Todas las categorías
            </button>
            {categorias.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCategoriaFiltro(categoriaFiltro === c ? null : c)}
                className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                  categoriaFiltro === c ? "border-transparent bg-brand-soft text-brand" : "border-border text-muted hover:bg-brand-soft"
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        )}

        {error && <p className="text-sm text-danger">{error}</p>}
        {catalogo === null && !error && <p className="py-8 text-center text-sm text-muted">Cargando…</p>}

        {catalogo !== null && catalogo.length === 0 && (
          <p className="py-4 text-sm text-muted">No tienes ítems activos en el Catálogo todavía — puedes agregar uno manual.</p>
        )}

        {catalogo !== null && catalogo.length > 0 && filtrados.length === 0 && (
          <p className="py-8 text-center text-sm text-muted">Ningún ítem coincide con la búsqueda o el filtro.</p>
        )}

        {filtrados.length > 0 && (
          <div className="flex flex-col divide-y divide-border border-t border-border">
            {filtrados.slice(0, visibles).map((item) => {
              const Icono = ICONO_TIPO[item.tipo];
              const conStock = item.tipo === "producto" && item.stock_actual != null;
              const destacado = Boolean(categoriaEquipoDestacar && item.tipos_equipo?.includes(categoriaEquipoDestacar));
              const marcado = seleccionados.has(item.id);
              return (
                <div key={item.id} className={`flex items-center gap-3 py-3 ${marcado ? "bg-brand-soft/40" : ""}`}>
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-soft text-brand">
                    <Icono className="h-4.5 w-4.5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-1.5 truncate text-sm font-medium text-foreground">
                      {item.nombre}
                      {destacado && (
                        <span title={`Sugerido para ${categoriaEquipoDestacar}`}>
                          <IconSparkle className="h-3.5 w-3.5 shrink-0 text-brand" />
                        </span>
                      )}
                    </p>
                    <p className="flex flex-wrap items-center gap-x-2 text-xs text-muted">
                      {item.categoria && <span>{item.categoria}</span>}
                      <span>{formatMoneda(item.precio_base, moneda)}</span>
                      <span>/ {item.unidad}</span>
                      {conStock && (
                        <span className="flex items-center gap-1">
                          <Badge value={estadoStock(item, stockMinimoDefault)} />
                          <span>{item.stock_actual} disp.</span>
                        </span>
                      )}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      onClick={() => cambiarCantidad(item.id, -1)}
                      aria-label="Restar"
                      className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted hover:bg-brand-soft hover:text-brand"
                    >
                      <IconMinus className="h-3.5 w-3.5" />
                    </button>
                    <input
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={cantidadDe(item.id)}
                      onChange={(e) => setCantidades((prev) => ({ ...prev, [item.id]: Number(e.target.value) || 1 }))}
                      className="w-14 rounded-lg border border-border bg-surface px-1.5 py-1.5 text-center text-sm text-foreground"
                    />
                    <button
                      type="button"
                      onClick={() => cambiarCantidad(item.id, 1)}
                      aria-label="Sumar"
                      className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted hover:bg-brand-soft hover:text-brand"
                    >
                      <IconPlus className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <Button type="button" variant={marcado ? "primary" : "outline"} onClick={() => alternarSeleccion(item.id)} className="shrink-0">
                    <IconCheck className="h-4 w-4" />
                    {marcado ? "Elegido" : "Elegir"}
                  </Button>
                </div>
              );
            })}
            {filtrados.length > visibles && (
              <button
                type="button"
                onClick={() => setVisibles((v) => v + TAMANO_PAGINA)}
                className="py-3 text-center text-sm font-medium text-brand hover:underline"
              >
                Cargar más ({filtrados.length - visibles} restantes)
              </button>
            )}
          </div>
        )}

        <div className="flex items-center justify-between border-t border-border pt-3">
          <Button type="button" variant="ghost" onClick={onAgregarManual}>
            <IconPlus className="h-4 w-4" />
            Agregar ítem manual
          </Button>
          <Button type="button" onClick={onConfirmarSeleccion} disabled={seleccionados.size === 0}>
            Agregar ({seleccionados.size})
          </Button>
        </div>
      </div>
    </Modal>
  );
}
