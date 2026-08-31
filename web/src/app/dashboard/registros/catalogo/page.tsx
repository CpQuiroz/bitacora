"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import type { CatalogoItem, SugerenciaRubro, TipoCatalogoItem, UnidadMedida } from "@bitacora/shared";
import { supabase } from "@/lib/supabase";
import { apiFetch } from "@/lib/api";
import { formatMoneda } from "@/lib/formatMoneda";
import { estadoStock } from "@/lib/estadoStock";
import { DashboardShell, type UsuarioShell } from "@/components/DashboardShell";
import { SelectCrear } from "@/components/SelectCrear";
import { Badge, Button, Card, ErrorText, Input, Label, PageHeader, Select, SuccessText } from "@/components/ui";
import { IconHelp, IconLayers, IconPlus } from "@/components/icons";
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
    if (!editandoId) payload.tipo = tipo;
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
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <PageHeader title="Catálogo" subtitle="Productos, servicios y kits reutilizables en cotizaciones y órdenes de servicio" />
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={() => alert("Importar catálogo desde CSV — próximamente.")}>
            Importar Catálogo
          </Button>
          <Button type="button" onClick={() => (formAbierto ? setFormAbierto(false) : abrirNuevo())}>
            <IconPlus className="h-4 w-4" />
            Nuevo Ítem
          </Button>
        </div>
      </div>

      {formAbierto && (
        <Card className="mb-6">
          <h2 className="mb-4 text-sm font-semibold text-foreground">{editandoId ? "Editar ítem" : "Nuevo ítem"}</h2>
          <form onSubmit={onSubmit} className="flex flex-col gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label>Tipo</Label>
                <Select
                  value={tipo}
                  disabled={Boolean(editandoId)}
                  onChange={(e) => setTipo(e.target.value as TipoCatalogoItem)}
                >
                  <option value="producto">Producto</option>
                  <option value="servicio">Servicio</option>
                  <option value="kit">Kit</option>
                </Select>
              </div>
              <div>
                <Label>Nombre</Label>
                <Input type="text" required value={nombre} onChange={(e) => setNombre(e.target.value)} />
              </div>
              <div>
                <Label className="flex items-center gap-1.5">
                  SKU
                  <span title="Código interno para identificar y buscar este ítem rápido — no tiene que ser el mismo del proveedor, es solo tuyo.">
                    <IconHelp className="h-3.5 w-3.5 text-muted" />
                  </span>
                </Label>
                <Input type="text" value={sku} onChange={(e) => setSku(e.target.value)} />
              </div>
              <div>
                <Label>Categoría</Label>
                <Input type="text" value={categoria} onChange={(e) => setCategoria(e.target.value)} />
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {chipsCategoria.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setCategoria(c)}
                      className={`rounded-full border px-2.5 py-0.5 text-[11px] font-medium transition-colors ${
                        categoria === c ? "border-transparent bg-brand-soft text-brand" : "border-border text-muted hover:bg-brand-soft"
                      }`}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <Label>Unidad</Label>
                <SelectCrear
                  value={unidades.find((u) => u.nombre === unidad)?.id ?? ""}
                  onChange={(id) => setUnidad(unidades.find((u) => u.id === id)?.nombre ?? unidad)}
                  opciones={unidades}
                  endpoint="/api/unidades-medida"
                  placeholder={unidad ? unidad : "Selecciona una unidad…"}
                  etiquetaCrear="+ Nueva unidad…"
                  onCreado={(nueva) => {
                    setUnidades((prev) => [...prev, nueva]);
                    setUnidad(nueva.nombre);
                  }}
                />
              </div>
              <div>
                <Label>Precio base (CLP)</Label>
                <Input type="number" min="0" step="1" required value={precioBase} onChange={(e) => setPrecioBase(e.target.value)} />
              </div>
            </div>

            {tipo === "kit" && (
              <div className="rounded-lg border border-border p-4">
                <p className="mb-3 text-sm font-medium text-foreground">Ítems del kit</p>
                <div className="flex flex-col gap-2">
                  {kitItems.map((k, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <div className="min-w-0 flex-1">
                        <Select value={k.item_id} onChange={(e) => cambiarItemKit(idx, { item_id: e.target.value })}>
                          <option value="">Selecciona un ítem…</option>
                          {disponiblesParaKit.map((it) => (
                            <option key={it.id} value={it.id}>
                              {TIPO_ETIQUETA[it.tipo]} — {it.nombre}
                            </option>
                          ))}
                        </Select>
                      </div>
                      <div className="w-24">
                        <Input
                          type="number"
                          min="0.01"
                          step="0.01"
                          value={k.cantidad}
                          onChange={(e) => cambiarItemKit(idx, { cantidad: e.target.value })}
                        />
                      </div>
                      <Button type="button" variant="ghost" onClick={() => quitarItemKit(idx)}>
                        Quitar
                      </Button>
                    </div>
                  ))}
                </div>
                <Button type="button" variant="outline" onClick={agregarItemKit} className="mt-3">
                  <IconPlus className="h-4 w-4" />
                  Agregar ítem al kit
                </Button>
              </div>
            )}

            <div>
              <Label className="flex items-center gap-1.5">
                Aplica a tipo(s) de equipo (opcional)
                <span title="Al armar una OS/Cotización con un equipo asociado, estos ítems se destacan primero — no oculta el resto del catálogo.">
                  <IconHelp className="h-3.5 w-3.5 text-muted" />
                </span>
              </Label>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {tiposEquipoDisponibles.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => alternarTipoEquipo(t)}
                    className={`rounded-full border px-2.5 py-0.5 text-[11px] font-medium transition-colors ${
                      tiposEquipo.includes(t) ? "border-transparent bg-brand-soft text-brand" : "border-border text-muted hover:bg-brand-soft"
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            {formError && <ErrorText>{formError}</ErrorText>}
            <div className="flex gap-2">
              <Button type="submit" disabled={guardando} className="self-start">
                {guardando ? "Guardando…" : editandoId ? "Guardar cambios" : "Agregar ítem"}
              </Button>
              <Button type="button" variant="ghost" onClick={() => setFormAbierto(false)}>
                Cancelar
              </Button>
            </div>
          </form>
        </Card>
      )}
      {aviso && (
        <div className="mb-6">
          <SuccessText>{aviso}</SuccessText>
        </div>
      )}

      <div className="mb-4 flex flex-col gap-3">
        <Input type="text" placeholder="Buscar en el catálogo..." value={busqueda} onChange={(e) => setBusqueda(e.target.value)} className="max-w-sm" />
        <div className="flex gap-1 border-b border-border">
          {TABS.map((t) => (
            <button
              key={t.valor}
              type="button"
              onClick={() => setTab(t.valor)}
              className={`px-4 py-2.5 text-sm font-medium transition-colors ${
                tab === t.valor ? "border-b-2 border-brand text-brand" : "text-muted hover:text-foreground"
              }`}
            >
              {t.etiqueta} ({contadores[t.valor]})
            </button>
          ))}
        </div>
        {categorias.length > 0 && (
          <div className="flex flex-wrap gap-2">
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
      </div>

      {error && <ErrorText>{error}</ErrorText>}
      {items === null && !error && <p className="text-sm text-muted">Cargando…</p>}

      {items?.length === 0 && (
        <Card>
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-soft text-brand">
              <IconLayers className="h-6 w-6" />
            </div>
            <p className="font-medium text-foreground">Ningún ítem en el catálogo</p>
            <p className="text-sm text-muted">Agrega tu primer producto, servicio o kit.</p>
            <Button type="button" onClick={abrirNuevo}>
              <IconPlus className="h-4 w-4" />
              Nuevo Ítem
            </Button>
          </div>
        </Card>
      )}

      {items && items.length > 0 && filtrados.length === 0 && (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border py-16 text-center">
          <IconLayers className="h-8 w-8 text-muted" />
          <p className="text-sm text-muted">Ningún ítem coincide con la búsqueda o el filtro.</p>
        </div>
      )}

      {filtrados.length > 0 && (
        <Card className="overflow-x-auto p-0">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border text-xs text-muted">
                <th className="px-5 py-3 font-medium">Tipo</th>
                <th className="px-5 py-3 font-medium">Ítem</th>
                <th className="px-5 py-3 font-medium">SKU</th>
                <th className="px-5 py-3 font-medium">Categoría</th>
                <th className="px-5 py-3 font-medium">Unidad</th>
                <th className="px-5 py-3 font-medium">Precio Base</th>
                <th className="px-5 py-3 font-medium">Stock</th>
                <th className="px-5 py-3 font-medium">Estado</th>
                <th className="px-5 py-3 font-medium">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filtrados.map((i) => (
                <tr key={i.id} className="border-b border-border last:border-0 hover:bg-brand-soft/40">
                  <td className="px-5 py-3">
                    <span className="flex items-center gap-1.5">
                      {(() => {
                        const Icono = ICONO_TIPO[i.tipo];
                        return <Icono className="h-4 w-4 text-muted" />;
                      })()}
                      <Badge value={i.tipo} />
                    </span>
                  </td>
                  <td className="px-5 py-3 font-medium text-foreground">
                    {i.nombre}
                    {i.tipo === "kit" && i.items && i.items.length > 0 && (
                      <p className="mt-0.5 text-xs font-normal text-muted">
                        {i.items.map((k) => `${k.cantidad}× ${k.nombre}`).join(", ")}
                      </p>
                    )}
                  </td>
                  <td className="px-5 py-3 text-muted">{i.sku || "—"}</td>
                  <td className="px-5 py-3 text-muted">{i.categoria || "—"}</td>
                  <td className="px-5 py-3 text-muted">{i.unidad}</td>
                  <td className="px-5 py-3 text-foreground">{formatMoneda(i.precio_base, usuario.moneda)}</td>
                  <td className="px-5 py-3">
                    {i.tipo === "producto" && i.stock_actual != null ? (
                      <span className="flex items-center gap-1.5">
                        <Badge value={estadoStock(i, stockMinimoDefault)} />
                        <span className="text-xs text-muted">{i.stock_actual}</span>
                      </span>
                    ) : (
                      <span className="text-muted">—</span>
                    )}
                  </td>
                  <td className="px-5 py-3">
                    <Badge value={i.activo ? "activo" : "inactivo"} />
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex gap-2">
                      <Button type="button" variant="outline" onClick={() => abrirEdicion(i)}>
                        Editar
                      </Button>
                      <Button type="button" variant="ghost" onClick={() => onAlternarActivo(i)}>
                        {i.activo ? "Desactivar" : "Activar"}
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </DashboardShell>
  );
}
