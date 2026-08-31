"use client";

import { useEffect, useMemo, useState } from "react";
import type { CatalogoItem, TipoCatalogoItem } from "@bitacora/shared";
import { apiFetch } from "@/lib/api";
import { formatMoneda } from "@/lib/formatMoneda";
import { estadoStock } from "@/lib/estadoStock";
import { Badge, Button, Input } from "./ui";
import { Modal } from "./Modal";
import { IconBox, IconLayers, IconPlus, IconWrench } from "./icons";

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
}: {
  open: boolean;
  onClose: () => void;
  onAgregar: (item: ItemSeleccionadoCatalogo) => void;
  moneda: string;
  stockMinimoDefault?: number;
}) {
  const [catalogo, setCatalogo] = useState<CatalogoItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("todos");
  const [categoriaFiltro, setCategoriaFiltro] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState("");
  const [cantidades, setCantidades] = useState<Record<string, number>>({});
  const [visibles, setVisibles] = useState(TAMANO_PAGINA);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setTab("todos");
    setCategoriaFiltro(null);
    setBusqueda("");
    setVisibles(TAMANO_PAGINA);
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
    return (catalogo ?? []).filter((i) => {
      if (tab !== "todos" && i.tipo !== tab) return false;
      if (categoriaFiltro && i.categoria !== categoriaFiltro) return false;
      if (q && !i.nombre.toLowerCase().includes(q) && !(i.sku ?? "").toLowerCase().includes(q) && !(i.categoria ?? "").toLowerCase().includes(q)) {
        return false;
      }
      return true;
    });
  }, [catalogo, tab, categoriaFiltro, busqueda]);

  function cantidadDe(id: string): number {
    return cantidades[id] ?? 1;
  }

  function onAgregarItem(item: CatalogoItem) {
    onAgregar({
      catalogo_item_id: item.id,
      descripcion: item.nombre,
      cantidad: cantidadDe(item.id),
      precio_unitario: item.precio_base,
    });
  }

  function onAgregarManual() {
    onAgregar({ catalogo_item_id: null, descripcion: "", cantidad: 1, precio_unitario: 0 });
    onClose();
  }

  return (
    <Modal open={open} onClose={onClose} title="Agregar ítem del catálogo" wide>
      <div className="flex flex-col gap-3">
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
              return (
                <div key={item.id} className="flex items-center gap-3 py-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-soft text-brand">
                    <Icono className="h-4.5 w-4.5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">{item.nombre}</p>
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
                  <div className="w-20 shrink-0">
                    <Input
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={cantidadDe(item.id)}
                      onChange={(e) => setCantidades((prev) => ({ ...prev, [item.id]: Number(e.target.value) || 1 }))}
                    />
                  </div>
                  <Button type="button" variant="outline" onClick={() => onAgregarItem(item)} className="shrink-0">
                    <IconPlus className="h-4 w-4" />
                    Agregar
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

        <div className="border-t border-border pt-3">
          <Button type="button" variant="ghost" onClick={onAgregarManual}>
            <IconPlus className="h-4 w-4" />
            Agregar ítem manual
          </Button>
        </div>
      </div>
    </Modal>
  );
}
