"use client";

import { Fragment, useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import type { CatalogoItem, Empresa, InventarioMovimiento, TipoMovimientoInventario, Usuario } from "@bitacora/shared";
import { supabase } from "@/lib/supabase";
import { apiFetch } from "@/lib/api";
import { DashboardShell } from "@/components/DashboardShell";
import { Badge, Button, Card, ErrorText, Input, Label, PageHeader, Select, SuccessText, buttonClass } from "@/components/ui";
import { IconBox } from "@/components/icons";

type UsuarioConEmpresa = Usuario & { empresa: Empresa };
type MovimientoConNombre = InventarioMovimiento & { item_nombre: string | null };

// stock_minimo puede venir null (el ítem no definió el suyo) — en ese
// caso se usa el umbral por defecto de la empresa (Configuración > Inventario).
function estadoStock(item: CatalogoItem, minimoDefault: number): "en_stock" | "stock_bajo" | "sin_stock" {
  const actual = item.stock_actual ?? 0;
  const minimo = item.stock_minimo ?? minimoDefault;
  if (actual <= 0) return "sin_stock";
  if (actual <= minimo) return "stock_bajo";
  return "en_stock";
}

const ETIQUETA_ESTADO: Record<string, string> = {
  en_stock: "En stock",
  stock_bajo: "Stock bajo",
  sin_stock: "Sin stock",
};

export default function InventarioRegistroPage() {
  const router = useRouter();
  const [usuario, setUsuario] = useState<UsuarioConEmpresa | null>(null);
  const [productos, setProductos] = useState<CatalogoItem[] | null>(null);
  const [movimientos, setMovimientos] = useState<MovimientoConNombre[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [ajustandoId, setAjustandoId] = useState<string | null>(null);
  const [tipoMov, setTipoMov] = useState<TipoMovimientoInventario>("entrada");
  const [cantidad, setCantidad] = useState("");
  const [motivo, setMotivo] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  async function cargar() {
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      router.replace("/login");
      return;
    }
    const resMe = await apiFetch("/api/me");
    if (resMe.ok) {
      const { usuario: u } = await resMe.json();
      if (u) setUsuario(u);
      if (!u?.empresa?.inventario_activado) return;
    }
    const resInv = await apiFetch("/api/inventario");
    if (!resInv.ok) {
      setError("No se pudo cargar el inventario");
      return;
    }
    const body = await resInv.json();
    setProductos(body.productos);
    setMovimientos(body.movimientos);
  }

  useEffect(() => {
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function abrirAjuste(id: string) {
    setAjustandoId(id);
    setTipoMov("entrada");
    setCantidad("");
    setMotivo("");
    setFormError(null);
  }

  async function onSubmitAjuste(e: FormEvent) {
    e.preventDefault();
    if (!ajustandoId) return;
    setFormError(null);
    setAviso(null);
    setGuardando(true);
    const res = await apiFetch("/api/inventario/movimientos", {
      method: "POST",
      body: JSON.stringify({ catalogo_item_id: ajustandoId, tipo: tipoMov, cantidad: Number(cantidad), motivo }),
    });
    setGuardando(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setFormError(body.error ?? "No se pudo registrar el movimiento");
      return;
    }
    setAviso("Movimiento registrado.");
    setAjustandoId(null);
    cargar();
  }

  if (!usuario) return null;

  const usuarioShell = {
    nombre: usuario.nombre,
    rol: usuario.rol,
    empresaNombre: usuario.empresa.nombre,
    empresaLogoUrl: usuario.empresa.logo_url,
    colorPrimario: usuario.empresa.color_primario,
    colorPrimarioForeground: usuario.empresa.color_primario_foreground,
    colorSecundario: usuario.empresa.color_secundario,
    fuente: usuario.empresa.fuente,
    moneda: usuario.empresa.moneda,
  };

  return (
    <DashboardShell usuario={usuarioShell}>
      <PageHeader title="Inventario" subtitle="Stock de los productos de tu Catálogo" />

      {!usuario.empresa.inventario_activado ? (
        <Card className="my-6">
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-soft text-brand">
              <IconBox className="h-6 w-6" />
            </div>
            <p className="font-medium text-foreground">Control de Inventario Desactivado</p>
            <p className="max-w-sm text-sm text-muted">
              Activa el control de inventario en la configuración para empezar a rastrear tus productos.
            </p>
            <a href="/dashboard/configuracion/inventario" className={buttonClass("primary")}>
              Configurar Inventario
            </a>
          </div>
        </Card>
      ) : (
        <>
          {error && (
            <div className="my-6">
              <ErrorText>{error}</ErrorText>
            </div>
          )}
          {aviso && (
            <div className="my-4">
              <SuccessText>{aviso}</SuccessText>
            </div>
          )}

          {productos === null && !error && <p className="my-6 text-sm text-muted">Cargando…</p>}

          {productos?.length === 0 && (
            <Card className="my-6">
              <div className="flex flex-col items-center gap-3 py-16 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-soft text-brand">
                  <IconBox className="h-6 w-6" />
                </div>
                <p className="font-medium text-foreground">Ningún producto en el catálogo</p>
                <p className="max-w-sm text-sm text-muted">
                  Agrega ítems de tipo &quot;Producto&quot; en el Catálogo para empezar a controlar su stock acá.
                </p>
                <a href="/dashboard/registros/catalogo" className={buttonClass("primary")}>
                  Ir al Catálogo
                </a>
              </div>
            </Card>
          )}

          {productos && productos.length > 0 && (
            <Card className="my-6 overflow-x-auto p-0">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-border text-xs text-muted">
                    <th className="px-5 py-3 font-medium">Ítem</th>
                    <th className="px-5 py-3 font-medium">SKU</th>
                    <th className="px-5 py-3 font-medium">Categoría</th>
                    <th className="px-5 py-3 font-medium">Stock actual</th>
                    <th className="px-5 py-3 font-medium">Stock mínimo</th>
                    <th className="px-5 py-3 font-medium">Estado</th>
                    <th className="px-5 py-3 font-medium">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {productos.map((p) => (
                    <Fragment key={p.id}>
                      <tr className="border-b border-border last:border-0">
                        <td className="px-5 py-3 font-medium text-foreground">{p.nombre}</td>
                        <td className="px-5 py-3 text-muted">{p.sku || "—"}</td>
                        <td className="px-5 py-3 text-muted">{p.categoria || "—"}</td>
                        <td className="px-5 py-3 text-foreground">
                          {p.stock_actual ?? 0} {p.unidad}
                        </td>
                        <td className="px-5 py-3 text-muted">
                          {p.stock_minimo ?? `${usuario?.empresa.inventario_stock_minimo_default ?? 0} (por defecto)`}
                        </td>
                        <td className="px-5 py-3">
                          <Badge value={estadoStock(p, usuario?.empresa.inventario_stock_minimo_default ?? 0)} />
                        </td>
                        <td className="px-5 py-3">
                          <Button type="button" variant="outline" onClick={() => (ajustandoId === p.id ? setAjustandoId(null) : abrirAjuste(p.id))}>
                            Ajustar
                          </Button>
                        </td>
                      </tr>
                      {ajustandoId === p.id && (
                        <tr className="border-b border-border bg-brand-soft/30 last:border-0">
                          <td colSpan={7} className="px-5 py-4">
                            <form onSubmit={onSubmitAjuste} className="flex flex-wrap items-end gap-3">
                              <div>
                                <Label>Movimiento</Label>
                                <Select value={tipoMov} onChange={(e) => setTipoMov(e.target.value as TipoMovimientoInventario)} className="w-40">
                                  <option value="entrada">Entrada</option>
                                  <option value="salida">Salida</option>
                                  <option value="ajuste">Ajuste (fija el stock)</option>
                                </Select>
                              </div>
                              <div>
                                <Label>Cantidad</Label>
                                <Input type="number" min="0.01" step="0.01" required value={cantidad} onChange={(e) => setCantidad(e.target.value)} className="w-32" />
                              </div>
                              <div className="flex-1 min-w-[200px]">
                                <Label>Motivo (opcional)</Label>
                                <Input type="text" value={motivo} onChange={(e) => setMotivo(e.target.value)} />
                              </div>
                              <Button type="submit" disabled={guardando}>
                                {guardando ? "Guardando…" : "Registrar"}
                              </Button>
                              <Button type="button" variant="ghost" onClick={() => setAjustandoId(null)}>
                                Cancelar
                              </Button>
                              {formError && (
                                <div className="w-full">
                                  <ErrorText>{formError}</ErrorText>
                                </div>
                              )}
                            </form>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </Card>
          )}

          {movimientos.length > 0 && (
            <Card className="my-6">
              <h2 className="mb-4 text-sm font-semibold text-foreground">Movimientos recientes</h2>
              <div className="flex flex-col divide-y divide-border">
                {movimientos.map((m) => (
                  <div key={m.id} className="flex items-center justify-between py-2.5 text-sm">
                    <div>
                      <p className="font-medium text-foreground">{m.item_nombre ?? "Ítem eliminado"}</p>
                      <p className="text-xs text-muted">
                        {m.motivo || "Sin motivo indicado"} · {new Date(m.creado_en).toLocaleString("es-CL")}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 text-right">
                      <Badge value={m.tipo} />
                      <span className="text-muted">
                        {m.tipo === "salida" ? "-" : "+"}
                        {m.cantidad} → {m.stock_resultante}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </>
      )}
    </DashboardShell>
  );
}
