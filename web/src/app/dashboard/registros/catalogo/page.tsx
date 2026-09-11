"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { HelpCircle, Layers, Plus } from "lucide-react";
import type { CatalogoItem, SugerenciaRubro, TipoCatalogoItem, UnidadMedida } from "@bitacora/shared";
import { supabase } from "@/lib/supabase";
import { apiFetch } from "@/lib/api";
import { formatMoneda } from "@/lib/formatMoneda";
import { estadoStock, ETIQUETA_ESTADO_STOCK } from "@/lib/estadoStock";
import { DashboardShell, type UsuarioShell } from "@/components/DashboardShell";
import { SelectCrear } from "@/components/SelectCrear";
import { Combobox } from "@/components/Combobox";
import { Button, Card, EmptyState, ErrorState, Input, LoadingState, Select, StatusBadge, Table, Tag, type TonoEstado } from "@bitacora/ui/web";
import { InputMonto } from "@/components/InputMonto";
import { ICONO_TIPO } from "@/components/CatalogoSelectorModal";

// Categorías sugeridas cuando el catálogo todavía no tiene ninguna
// propia — una vez que existan categorías reales usadas, esas se
// muestran primero (ver "categorias" más abajo). Fusiona la lista que
// ya existía con la pedida en el hallazgo de UX más reciente (mismo
// "Mano de obra"/"Mano de Obra" e "Insumos"/"Materiales" ya cubiertos
// no se duplican; "Repuestos"/"Herramientas" se mantienen porque ya
// estaban en uso).
const CATEGORIAS_SUGERIDAS = ["Insumos", "Desplazamiento", "Mano de Obra", "Materiales", "Piezas y Componentes", "Repuestos", "Herramientas"];

// Bloque D — a qué tipo(s) de equipo puede aplicar un ítem (etiquetado
// m2m, texto libre). Mismas categorías sugeridas que Equipos, más
// cualquier tipo_equipo custom ya en uso (ver "tiposEquipoDisponibles").
const TIPOS_EQUIPO_SUGERIDOS = ["Vehículo", "Maquinaria", "Herramienta", "Otro"];

type ItemConKit = CatalogoItem & { items?: { item_id: string; cantidad: number; nombre: string }[] };
type Tab = "todos" | "producto" | "servicio" | "kit";

const TABS: { valor: Tab; etiqueta: string }[] = [
  { valor: "todos", etiqueta: "Todos" },
  { valor: "producto", etiqueta: "Productos" },
  { valor: "servicio", etiqueta: "Servicios" },
  { valor: "kit", etiqueta: "Kits" },
];

const TIPO_ETIQUETA: Record<TipoCatalogoItem, string> = {
  producto: "Producto",
  servicio: "Servicio",
  kit: "Kit",
};

// "en_stock"/"stock_bajo" no están en MAPA_ESTADO_TONO — mismo criterio
// que CatalogoSelectorModal/Inventario.
const TONO_STOCK: Record<string, TonoEstado> = { en_stock: "completado", stock_bajo: "en_progreso", sin_stock: "cancelado" };

// PASO 6 (sistema de diseño) — migrado. Ver docs/design-system.md.
export default function CatalogoPage() {
  const router = useRouter();
  const [usuario, setUsuario] = useState<UsuarioShell | null>(null);
  const [items, setItems] = useState<ItemConKit[] | null>(null);
  const [unidades, setUnidades] = useState<UnidadMedida[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("todos");
  const [categoriaFiltro, setCategoriaFiltro] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState("");
  const [stockMinimoDefault, setStockMinimoDefault] = useState(5);

  const [formAbierto, setFormAbierto] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [tipo, setTipo] = useState<TipoCatalogoItem>("producto");
  const [nombre, setNombre] = useState("");
  const [sku, setSku] = useState("");
  const [categoria, setCategoria] = useState("");
  const [unidad, setUnidad] = useState("unidad");
  const [precioBase, setPrecioBase] = useState("");
  // Solo para "Nuevo ítem" tipo Producto. Editar el stock después va por
  // el flujo de ajuste de Inventario (para no romper la trazabilidad).
  const [stockInicial, setStockInicial] = useState("0");
  // Umbral de "stock bajo" de ESTE producto. "" = usa el default de la
  // empresa. Editable en alta y edición.
  const [stockMinimo, setStockMinimo] = useState("");
  const [kitItems, setKitItems] = useState<{ item_id: string; cantidad: string }[]>([]);
  const [tiposEquipo, setTiposEquipo] = useState<string[]>([]);
  // Bloque E: sugerencias según el rubro de la empresa.
  const [sugerenciasRubro, setSugerenciasRubro] = useState<SugerenciaRubro[]>([]);

  async function cargar() {
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      router.replace("/login");
      return;
    }
    const [resMe, resItems, resUnidades, resSugerencias] = await Promise.all([
      apiFetch("/api/me"),
      apiFetch("/api/catalogo"),
      apiFetch("/api/unidades-medida"),
      apiFetch("/api/sugerencias-rubro"),
    ]);
    if (resSugerencias.ok) {
      const todas: SugerenciaRubro[] = await resSugerencias.json();
      setSugerenciasRubro(todas.filter((s) => s.tipo_sugerencia === "categoria_catalogo"));
    }
    if (resUnidades.ok) setUnidades((await resUnidades.json()).filter((u: UnidadMedida) => u.activo));
    if (resMe.ok) {
      const { usuario: u } = await resMe.json();
      if (u)
        setUsuario({
          nombre: u.nombre,
          rol: u.rol,
          empresaNombre: u.empresa?.nombre ?? "",
          empresaLogoUrl: u.empresa?.logo_url ?? null,
          colorPrimario: u.empresa?.color_primario ?? null,
          colorPrimarioForeground: u.empresa?.color_primario_foreground ?? null,
          colorSecundario: u.empresa?.color_secundario ?? null,
          fuente: u.empresa?.fuente ?? null,
          moneda: u.empresa?.moneda ?? "CLP",
        });
      if (u?.empresa?.inventario_stock_minimo_default != null) setStockMinimoDefault(u.empresa.inventario_stock_minimo_default);
    }
    if (!resItems.ok) {
      setError("No se pudo cargar el catálogo");
      return;
    }
    setItems(await resItems.json());
  }

  useEffect(() => {
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const disponiblesParaKit = useMemo(() => (items ?? []).filter((i) => i.tipo !== "kit"), [items]);

  function abrirNuevo() {
    setEditandoId(null);
    setTipo("producto");
    setNombre("");
    setSku("");
    setCategoria("");
    setUnidad("");
    setPrecioBase("");
    setStockInicial("0");
    setStockMinimo("");
    setKitItems([]);
    setTiposEquipo([]);
    setFormError(null);
    setFormAbierto(true);
  }

  function abrirEdicion(i: ItemConKit) {
    setEditandoId(i.id);
    setTipo(i.tipo);
    setNombre(i.nombre);
    setSku(i.sku ?? "");
    setCategoria(i.categoria ?? "");
    setUnidad(i.unidad);
    setPrecioBase(String(i.precio_base));
    setStockMinimo(i.stock_minimo != null ? String(i.stock_minimo) : "");
    setKitItems((i.items ?? []).map((k) => ({ item_id: k.item_id, cantidad: String(k.cantidad) })));
    setTiposEquipo(i.tipos_equipo ?? []);
    setFormError(null);
    setFormAbierto(true);
  }

  function alternarTipoEquipo(tipoEquipo: string) {
    setTiposEquipo((prev) => (prev.includes(tipoEquipo) ? prev.filter((t) => t !== tipoEquipo) : [...prev, tipoEquipo]));
  }

  async function onAlternarActivo(i: ItemConKit) {
    const res = await apiFetch(`/api/catalogo/${i.id}`, { method: "PATCH", body: JSON.stringify({ activo: !i.activo }) });
    if (res.ok) cargar();
  }

  function agregarItemKit() {
    setKitItems((v) => [...v, { item_id: "", cantidad: "1" }]);
  }
  function quitarItemKit(idx: number) {
    setKitItems((v) => v.filter((_, i) => i !== idx));
  }
  function cambiarItemKit(idx: number, cambios: Partial<{ item_id: string; cantidad: string }>) {
    setKitItems((v) => v.map((k, i) => (i === idx ? { ...k, ...cambios } : k)));
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    setAviso(null);
    setGuardando(true);
    const payload: Record<string, unknown> = { nombre, sku, categoria, unidad, precio_base: Number(precioBase), tipos_equipo: tiposEquipo };
    if (!editandoId) {
      payload.tipo = tipo;
      if (tipo === "producto") payload.stock_inicial = Number(stockInicial) || 0;
    }
    if (tipo === "producto") payload.stock_minimo = stockMinimo.trim() === "" ? null : Number(stockMinimo);
    if (tipo === "kit") {
      payload.items = kitItems
        .filter((k) => k.item_id)
        .map((k) => ({ item_id: k.item_id, cantidad: Number(k.cantidad) || 1 }));
    }
    const res = editandoId
      ? await apiFetch(`/api/catalogo/${editandoId}`, { method: "PATCH", body: JSON.stringify(payload) })
      : await apiFetch("/api/catalogo", { method: "POST", body: JSON.stringify(payload) });
    setGuardando(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setFormError(body.error ?? "No se pudo guardar el ítem");
      return;
    }
    setAviso(editandoId ? "Ítem actualizado." : "Ítem creado.");
    setFormAbierto(false);
    setEditandoId(null);
    cargar();
  }

  if (!usuario) return null;

  const lista = items ?? [];
  const contadores = {
    todos: lista.length,
    producto: lista.filter((i) => i.tipo === "producto").length,
    servicio: lista.filter((i) => i.tipo === "servicio").length,
    kit: lista.filter((i) => i.tipo === "kit").length,
  };

  // Categorías reales configuradas, nunca hardcodeadas.
  const categorias = [...new Set(lista.map((i) => i.categoria).filter((c): c is string => Boolean(c)))].sort();
  // Chips de sugerencia en el formulario: las categorías ya usadas por
  // esta empresa si existen, o una lista genérica por defecto la
  // primera vez que se usa el catálogo (todavía vacío).
  const sugeridasRubroNombres = sugerenciasRubro.map((s) => s.valor);
  const chipsCategoria =
    categorias.length > 0 ? categorias : [...sugeridasRubroNombres, ...CATEGORIAS_SUGERIDAS.filter((c) => !sugeridasRubroNombres.includes(c))];

  // Bloque D: tipos de equipo ya usados en algún ítem, además de los
  // sugeridos — así un tipo_equipo escrito a mano en otro ítem sigue
  // apareciendo como opción acá.
  const tiposEquipoDisponibles = [
    ...new Set([...TIPOS_EQUIPO_SUGERIDOS, ...lista.flatMap((i) => i.tipos_equipo ?? [])]),
  ];

  const filtrados = lista.filter((i) => {
    if (tab !== "todos" && i.tipo !== tab) return false;
    if (categoriaFiltro && i.categoria !== categoriaFiltro) return false;
    const q = busqueda.trim().toLowerCase();
    if (q && !i.nombre.toLowerCase().includes(q) && !(i.sku ?? "").toLowerCase().includes(q) && !(i.categoria ?? "").toLowerCase().includes(q)) {
      return false;
    }
    return true;
  });

  return (
    <DashboardShell usuario={usuario}>
      <div className="mb-ds-6 flex flex-wrap items-center justify-between gap-ds-3">
        <div>
          <p className="ds-heading text-ds-h2 text-ds-text">Catálogo</p>
          <p className="mt-ds-1 font-ds-body text-ds-small text-ds-text/70">Productos, servicios y kits reutilizables en cotizaciones y órdenes de servicio</p>
        </div>
        <div className="flex gap-ds-2">
          <Button variante="secundario" onPress={() => alert("Importar catálogo desde CSV — próximamente.")}>
            Importar Catálogo
          </Button>
          <Button iconoIzq={<Plus size={16} strokeWidth={2.75} />} onPress={() => (formAbierto ? setFormAbierto(false) : abrirNuevo())}>
            Nuevo Ítem
          </Button>
        </div>
      </div>

      {formAbierto && (
        <div className="mb-ds-6">
          <Card>
            <p className="mb-ds-4 font-ds-body text-ds-small font-semibold text-ds-text">{editandoId ? "Editar ítem" : "Nuevo ítem"}</p>
            <form onSubmit={onSubmit} className="flex flex-col gap-ds-4">
              <div className="grid gap-ds-4 sm:grid-cols-2">
                <Select
                  etiqueta="Tipo"
                  deshabilitado={Boolean(editandoId)}
                  valor={tipo}
                  onCambio={(v) => setTipo(v as TipoCatalogoItem)}
                  opciones={[
                    { valor: "producto", etiqueta: "Producto" },
                    { valor: "servicio", etiqueta: "Servicio" },
                    { valor: "kit", etiqueta: "Kit" },
                  ]}
                />
                <Input etiqueta="Nombre" requerido valor={nombre} onCambio={setNombre} />
                <div className="flex flex-col gap-ds-1">
                  <label className="flex items-center gap-1.5 font-ds-body text-ds-caption font-medium text-ds-text/70">
                    SKU
                    <span title="Código interno para identificar y buscar este ítem rápido — no tiene que ser el mismo del proveedor, es solo tuyo.">
                      <HelpCircle size={14} strokeWidth={2.75} className="text-ds-text/40" />
                    </span>
                  </label>
                  <Input valor={sku} onCambio={setSku} />
                </div>
                <div className="flex flex-col gap-ds-1">
                  <label className="font-ds-body text-ds-caption font-medium text-ds-text/70">Categoría</label>
                  <Input valor={categoria} onCambio={setCategoria} />
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {chipsCategoria.map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setCategoria(c)}
                        className={`rounded-ds-pill border px-2.5 py-0.5 text-[11px] font-medium transition-colors ${
                          categoria === c ? "border-ds-brand bg-ds-brand/[0.08] text-ds-brand" : "border-ds-divider text-ds-text/70 hover:border-ds-text/30"
                        }`}
                      >
                        {c}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex flex-col gap-ds-1">
                  <label className="font-ds-body text-ds-caption font-medium text-ds-text/70">Unidad</label>
                  <SelectCrear
                    value={unidades.find((u) => u.nombre === unidad)?.id ?? ""}
                    onChange={(id) => setUnidad(unidades.find((u) => u.id === id)?.nombre ?? unidad)}
                    opciones={unidades}
                    endpoint="/api/unidades-medida"
                    placeholder={unidad ? unidad : "Selecciona una unidad…"}
                    etiquetaCrear="+ Crear unidad"
                    onCreado={(nueva) => {
                      setUnidades((prev) => [...prev, nueva]);
                      setUnidad(nueva.nombre);
                    }}
                  />
                </div>
                <div className="flex flex-col gap-ds-1">
                  <label className="font-ds-body text-ds-caption font-medium text-ds-text/70">Precio base (CLP)</label>
                  <InputMonto required value={precioBase} onChange={setPrecioBase} moneda={usuario.moneda} />
                </div>
                {tipo === "producto" && !editandoId && (
                  <div className="flex flex-col gap-ds-1">
                    <label className="flex items-center gap-1.5 font-ds-body text-ds-caption font-medium text-ds-text/70">
                      Stock inicial (opcional)
                      <span title="Cantidad con la que arranca este producto. Después, ajustá el stock desde Inventario para mantener el historial de movimientos.">
                        <HelpCircle size={14} strokeWidth={2.75} className="text-ds-text/40" />
                      </span>
                    </label>
                    <Input tipo="numero" valor={stockInicial} onCambio={setStockInicial} />
                  </div>
                )}
                {tipo === "producto" && (
                  <div className="flex flex-col gap-ds-1">
                    <label className="flex items-center gap-1.5 font-ds-body text-ds-caption font-medium text-ds-text/70">
                      Stock mínimo (opcional)
                      <span title="Cuando el stock baja de este número, el producto se marca como 'Stock bajo'. Vacío = usa el mínimo por defecto de la empresa (Configuración → Inventario).">
                        <HelpCircle size={14} strokeWidth={2.75} className="text-ds-text/40" />
                      </span>
                    </label>
                    <Input tipo="numero" placeholder={`Por defecto: ${stockMinimoDefault}`} valor={stockMinimo} onCambio={setStockMinimo} />
                  </div>
                )}
              </div>

              {tipo === "kit" && (
                <div className="rounded-ds-md border border-ds-divider p-ds-4">
                  <p className="mb-ds-3 font-ds-body text-ds-small font-medium text-ds-text">Ítems del kit</p>
                  <div className="flex flex-col gap-ds-2">
                    {kitItems.map((k, idx) => (
                      <div key={idx} className="flex items-center gap-ds-2">
                        <div className="min-w-0 flex-1">
                          <Combobox
                            value={k.item_id}
                            onChange={(id) => cambiarItemKit(idx, { item_id: id })}
                            opciones={disponiblesParaKit.map((it) => ({
                              id: it.id,
                              label: `${TIPO_ETIQUETA[it.tipo]} — ${it.nombre}`,
                            }))}
                            placeholder="Buscar ítem del catálogo…"
                          />
                        </div>
                        <div className="w-24">
                          <Input tipo="numero" valor={k.cantidad} onCambio={(v) => cambiarItemKit(idx, { cantidad: v })} />
                        </div>
                        <Button variante="ghost" onPress={() => quitarItemKit(idx)}>
                          Quitar
                        </Button>
                      </div>
                    ))}
                  </div>
                  <div className="mt-ds-3">
                    <Button variante="secundario" iconoIzq={<Plus size={16} strokeWidth={2.75} />} onPress={agregarItemKit}>
                      Agregar ítem al kit
                    </Button>
                  </div>
                </div>
              )}

              <div className="flex flex-col gap-ds-1">
                <label className="flex items-center gap-1.5 font-ds-body text-ds-caption font-medium text-ds-text/70">
                  Aplica a tipo(s) de equipo (opcional)
                  <span title="Al armar una OS/Cotización con un equipo asociado, estos ítems se destacan primero — no oculta el resto del catálogo.">
                    <HelpCircle size={14} strokeWidth={2.75} className="text-ds-text/40" />
                  </span>
                </label>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {tiposEquipoDisponibles.map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => alternarTipoEquipo(t)}
                      className={`rounded-ds-pill border px-2.5 py-0.5 text-[11px] font-medium transition-colors ${
                        tiposEquipo.includes(t) ? "border-ds-brand bg-ds-brand/[0.08] text-ds-brand" : "border-ds-divider text-ds-text/70 hover:border-ds-text/30"
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              {formError ? <p className="font-ds-body text-ds-small text-ds-accent-700">{formError}</p> : null}
              <div className="flex gap-ds-2">
                <Button tipo="submit" cargando={guardando}>
                  {editandoId ? "Guardar cambios" : "Agregar ítem"}
                </Button>
                <Button variante="ghost" onPress={() => setFormAbierto(false)}>
                  Cancelar
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}
      {aviso ? <p className="mb-ds-6 font-ds-body text-ds-small font-medium text-ds-accent2-800">{aviso}</p> : null}

      <div className="mb-ds-4 flex flex-col gap-ds-3">
        <div className="max-w-sm">
          <Input placeholder="Buscar en el catálogo..." valor={busqueda} onCambio={setBusqueda} />
        </div>
        <div className="flex gap-ds-1 border-b border-ds-divider">
          {TABS.map((t) => (
            <button
              key={t.valor}
              type="button"
              onClick={() => setTab(t.valor)}
              className={`px-ds-4 py-2.5 font-ds-body text-ds-small font-medium transition-colors ${
                tab === t.valor ? "border-b-2 border-ds-brand text-ds-brand" : "text-ds-text/60 hover:text-ds-text"
              }`}
            >
              {t.etiqueta} ({contadores[t.valor]})
            </button>
          ))}
        </div>
        {categorias.length > 0 && (
          <div className="flex flex-wrap gap-ds-2">
            <button
              type="button"
              onClick={() => setCategoriaFiltro(null)}
              className={`rounded-ds-pill border px-ds-3 py-1 font-ds-body text-ds-caption font-medium transition-colors ${
                categoriaFiltro === null ? "border-ds-brand bg-ds-brand/[0.08] text-ds-brand" : "border-ds-divider text-ds-text/70 hover:border-ds-text/30"
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
                  categoriaFiltro === c ? "border-ds-brand bg-ds-brand/[0.08] text-ds-brand" : "border-ds-divider text-ds-text/70 hover:border-ds-text/30"
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        )}
      </div>

      {error ? <ErrorState mensaje={error} /> : null}
      {items === null && !error ? <LoadingState /> : null}

      {items?.length === 0 && (
        <EmptyState
          icono={<Layers size={28} strokeWidth={2.75} />}
          titulo="Ningún ítem en el catálogo"
          mensaje="Agrega tu primer producto, servicio o kit"
          accion={
            <Button iconoIzq={<Plus size={16} strokeWidth={2.75} />} onPress={abrirNuevo}>
              Nuevo Ítem
            </Button>
          }
        />
      )}

      {items && items.length > 0 && filtrados.length === 0 && (
        <EmptyState icono={<Layers size={28} strokeWidth={2.75} />} titulo="Ningún ítem coincide con la búsqueda o el filtro" />
      )}

      {filtrados.length > 0 && (
        <Table<ItemConKit>
          filas={filtrados}
          claveFila={(i) => i.id}
          vacio={{ titulo: "Ningún ítem coincide con la búsqueda o el filtro" }}
          columnas={[
            {
              encabezado: "Tipo",
              celda: (i) => {
                const Icono = ICONO_TIPO[i.tipo];
                return (
                  <span className="flex items-center gap-1.5">
                    <Icono size={16} strokeWidth={2.75} className="text-ds-text/60" />
                    <Tag>{TIPO_ETIQUETA[i.tipo]}</Tag>
                  </span>
                );
              },
            },
            {
              encabezado: "Ítem",
              celda: (i) => (
                <>
                  {i.nombre}
                  {i.tipo === "kit" && i.items && i.items.length > 0 && (
                    <p className="mt-0.5 font-ds-body text-ds-caption font-normal text-ds-text/60">
                      {i.items.map((k) => `${k.cantidad}× ${k.nombre}`).join(", ")}
                    </p>
                  )}
                </>
              ),
            },
            { encabezado: "SKU", celda: (i) => i.sku || "—" },
            { encabezado: "Categoría", celda: (i) => i.categoria || "—" },
            { encabezado: "Unidad", celda: (i) => i.unidad },
            { encabezado: "Precio Base", celda: (i) => formatMoneda(i.precio_base, usuario.moneda) },
            {
              encabezado: "Stock",
              celda: (i) => {
                if (i.tipo !== "producto" || i.stock_actual == null) return <span className="text-ds-text/60">—</span>;
                const estado = estadoStock(i, stockMinimoDefault);
                return (
                  <span className="flex items-center gap-1.5">
                    <StatusBadge estado={estado} etiqueta={ETIQUETA_ESTADO_STOCK[estado]} tonoForzado={TONO_STOCK[estado]} />
                    <span className="font-ds-body text-ds-caption text-ds-text/60">{i.stock_actual}</span>
                  </span>
                );
              },
            },
            { encabezado: "Estado", celda: (i) => <StatusBadge estado={i.activo ? "activo" : "inactivo"} /> },
            {
              encabezado: "Acciones",
              celda: (i) => (
                <div className="flex gap-ds-2">
                  <Button variante="secundario" onPress={() => abrirEdicion(i)}>
                    Editar
                  </Button>
                  <Button variante="ghost" onPress={() => onAlternarActivo(i)}>
                    {i.activo ? "Desactivar" : "Activar"}
                  </Button>
                </div>
              ),
            },
          ]}
        />
      )}
    </DashboardShell>
  );
}
