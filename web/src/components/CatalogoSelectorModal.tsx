"use client";

import { useEffect, useMemo, useState } from "react";
import { Box, Check, Layers, Minus, Plus, Sparkles, Wrench } from "lucide-react";
import type { CatalogoItem, TipoCatalogoItem } from "@bitacora/shared";
import { apiFetch } from "@/lib/api";
import { formatMoneda } from "@/lib/formatMoneda";
import { estadoStock, ETIQUETA_ESTADO_STOCK } from "@/lib/estadoStock";
import { Button, Input, StatusBadge, type TonoEstado } from "@bitacora/ui/web";
import { Modal } from "./Modal";

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
export const ICONO_TIPO: Record<TipoCatalogoItem, typeof Box> = {
  producto: Box,
  servicio: Wrench,
  kit: Layers,
};

// "en_stock"/"stock_bajo" no están en MAPA_ESTADO_TONO ("sin_stock" sí,
// como "cancelado") — se fuerza el tono en vez de dejarlos caer al
// fallback "cerrado".
const TONO_STOCK: Record<string, TonoEstado> = {
  en_stock: "completado",
  stock_bajo: "en_progreso",
  sin_stock: "cancelado",
};

const TAMANO_PAGINA = 60;

// PASO 6 (sistema de diseño) — migrado. Ver docs/design-system.md.
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
      <div className="flex flex-col gap-ds-3">
        {avisaDescuentoStock && (
          <p className="rounded-ds-md bg-ds-brand/[0.06] px-ds-3 py-ds-2 font-ds-body text-ds-caption text-ds-text/70">
            Los productos con stock se descuentan del inventario cuando la OS llega al estado configurado en
            Configuración → Inventario.
          </p>
        )}
        <Input placeholder="Buscar por nombre, SKU o categoría..." valor={busqueda} onCambio={setBusqueda} />

        <div className="flex flex-wrap gap-ds-2">
          {TABS.map((t) => (
            <button
              key={t.valor}
              type="button"
              onClick={() => setTab(t.valor)}
              className={`rounded-ds-pill border px-ds-3 py-1 font-ds-body text-ds-caption font-medium transition-colors ${
                tab === t.valor ? "border-transparent bg-ds-brand text-ds-brand-foreground" : "border-ds-divider text-ds-text/70 hover:bg-ds-brand/[0.08]"
              }`}
            >
              {t.etiqueta}
            </button>
          ))}
        </div>

        {categorias.length > 0 && (
          <div className="flex flex-wrap gap-ds-2 border-t border-ds-divider pt-ds-3">
            <button
              type="button"
              onClick={() => setCategoriaFiltro(null)}
              className={`rounded-ds-pill border px-ds-3 py-1 font-ds-body text-ds-caption font-medium transition-colors ${
                categoriaFiltro === null ? "border-transparent bg-ds-brand/[0.08] text-ds-brand" : "border-ds-divider text-ds-text/70 hover:bg-ds-brand/[0.08]"
              }`}
            >
              Todas las categorías
            </button>
            {categorias.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCategoriaFiltro(categoriaFiltro === c ? null : c)}
                className={`rounded-ds-pill border px-ds-3 py-1 font-ds-body text-ds-caption font-medium transition-colors ${
                  categoriaFiltro === c ? "border-transparent bg-ds-brand/[0.08] text-ds-brand" : "border-ds-divider text-ds-text/70 hover:bg-ds-brand/[0.08]"
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        )}

        {error ? <p className="font-ds-body text-ds-small text-ds-accent-700">{error}</p> : null}
        {catalogo === null && !error && <p className="py-ds-8 text-center font-ds-body text-ds-small text-ds-text/70">Cargando…</p>}

        {catalogo !== null && catalogo.length === 0 && (
          <p className="py-ds-4 font-ds-body text-ds-small text-ds-text/70">No tienes ítems activos en el Catálogo todavía — puedes agregar uno manual.</p>
        )}

        {catalogo !== null && catalogo.length > 0 && filtrados.length === 0 && (
          <p className="py-ds-8 text-center font-ds-body text-ds-small text-ds-text/70">Ningún ítem coincide con la búsqueda o el filtro.</p>
        )}

        {filtrados.length > 0 && (
          <div className="flex flex-col divide-y divide-ds-divider border-t border-ds-divider">
            {filtrados.slice(0, visibles).map((item) => {
              const Icono = ICONO_TIPO[item.tipo];
              const conStock = item.tipo === "producto" && item.stock_actual != null;
              const destacado = Boolean(categoriaEquipoDestacar && item.tipos_equipo?.includes(categoriaEquipoDestacar));
              const marcado = seleccionados.has(item.id);
              const estado = conStock ? estadoStock(item, stockMinimoDefault) : null;
              return (
                <div key={item.id} className={`flex items-center gap-ds-3 py-ds-3 ${marcado ? "bg-ds-brand/[0.06]" : ""}`}>
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-ds-md bg-ds-brand/[0.08] text-ds-brand">
                    <Icono size={18} strokeWidth={2.75} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-1.5 truncate font-ds-body text-ds-small font-medium text-ds-text">
                      {item.nombre}
                      {destacado && (
                        <span title={`Sugerido para ${categoriaEquipoDestacar}`}>
                          <Sparkles size={14} strokeWidth={2.75} className="shrink-0 text-ds-brand" />
                        </span>
                      )}
                    </p>
                    <p className="flex flex-wrap items-center gap-x-ds-2 font-ds-body text-ds-caption text-ds-text/60">
                      {item.categoria && <span>{item.categoria}</span>}
                      <span>{formatMoneda(item.precio_base, moneda)}</span>
                      <span>/ {item.unidad}</span>
                      {conStock && estado && (
                        <span className="flex items-center gap-1">
                          <StatusBadge estado={estado} etiqueta={ETIQUETA_ESTADO_STOCK[estado]} tonoForzado={TONO_STOCK[estado]} />
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
                      className="flex h-8 w-8 items-center justify-center rounded-ds-md border border-ds-divider text-ds-text/60 hover:bg-ds-brand/[0.08] hover:text-ds-brand"
                    >
                      <Minus size={14} strokeWidth={2.75} />
                    </button>
                    <input
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={cantidadDe(item.id)}
                      onChange={(e) => setCantidades((prev) => ({ ...prev, [item.id]: Number(e.target.value) || 1 }))}
                      className="w-14 rounded-ds-md border border-ds-divider bg-ds-surface px-1.5 py-1.5 text-center font-ds-body text-ds-small text-ds-text"
                    />
                    <button
                      type="button"
                      onClick={() => cambiarCantidad(item.id, 1)}
                      aria-label="Sumar"
                      className="flex h-8 w-8 items-center justify-center rounded-ds-md border border-ds-divider text-ds-text/60 hover:bg-ds-brand/[0.08] hover:text-ds-brand"
                    >
                      <Plus size={14} strokeWidth={2.75} />
                    </button>
                  </div>
                  <Button variante={marcado ? "primario" : "secundario"} iconoIzq={<Check size={16} strokeWidth={2.75} />} onPress={() => alternarSeleccion(item.id)}>
                    {marcado ? "Elegido" : "Elegir"}
                  </Button>
                </div>
              );
            })}
            {filtrados.length > visibles && (
              <button
                type="button"
                onClick={() => setVisibles((v) => v + TAMANO_PAGINA)}
                className="py-ds-3 text-center font-ds-body text-ds-small font-medium text-ds-brand hover:underline"
              >
                Cargar más ({filtrados.length - visibles} restantes)
              </button>
            )}
          </div>
        )}

        <div className="flex items-center justify-between border-t border-ds-divider pt-ds-3">
          <Button variante="ghost" iconoIzq={<Plus size={16} strokeWidth={2.75} />} onPress={onAgregarManual}>
            Agregar ítem manual
          </Button>
          <Button onPress={onConfirmarSeleccion} deshabilitado={seleccionados.size === 0}>
            Agregar ({seleccionados.size})
          </Button>
        </div>
      </div>
    </Modal>
  );
}
