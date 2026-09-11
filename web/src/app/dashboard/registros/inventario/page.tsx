"use client";

import { Fragment, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Box } from "lucide-react";
import type { CatalogoItem, Empresa, InventarioMovimiento, TipoMovimientoInventario, Usuario } from "@bitacora/shared";
import { supabase } from "@/lib/supabase";
import { apiFetch } from "@/lib/api";
import { estadoStock, ETIQUETA_ESTADO_STOCK } from "@/lib/estadoStock";
import { DashboardShell } from "@/components/DashboardShell";
import { Button, Card, EmptyState, Input, LoadingState, Select, StatusBadge, Table, type TonoEstado } from "@bitacora/ui/web";
import { Stat } from "@/components/Stat";

type UsuarioConEmpresa = Usuario & { empresa: Empresa };
type MovimientoConNombre = InventarioMovimiento & { item_nombre: string | null };

// "en_stock"/"stock_bajo" no están en MAPA_ESTADO_TONO ("sin_stock" sí)
// — mismo criterio que CatalogoSelectorModal.
const TONO_STOCK: Record<string, TonoEstado> = { en_stock: "completado", stock_bajo: "en_progreso", sin_stock: "cancelado" };
const TONO_MOVIMIENTO: Record<TipoMovimientoInventario, TonoEstado> = { entrada: "completado", salida: "en_progreso", ajuste: "cerrado" };

// PASO 6 (sistema de diseño) — migrado. Ver docs/design-system.md.
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
      <p className="ds-heading text-ds-h2 text-ds-text">Inventario</p>
      <p className="mt-ds-1 font-ds-body text-ds-small text-ds-text/70">Stock de los productos de tu Catálogo</p>

      {!usuario.empresa.inventario_activado ? (
        <div className="my-ds-6">
          <EmptyState
            icono={<Box size={28} strokeWidth={2.75} />}
            titulo="Control de inventario desactivado"
            mensaje="Actívalo en la configuración para empezar a rastrear el stock de tus productos."
            accion={
              <Link href="/dashboard/configuracion/inventario">
                <Button>Configurar inventario</Button>
              </Link>
            }
          />
        </div>
      ) : (
        <>
          {error ? <p className="my-ds-6 font-ds-body text-ds-small text-ds-accent-700">{error}</p> : null}
          {aviso ? <p className="my-ds-4 font-ds-body text-ds-small font-medium text-ds-accent2-800">{aviso}</p> : null}

          {productos === null && !error ? <LoadingState /> : null}

          {productos?.length === 0 && (
            <div className="my-ds-6">
              <EmptyState
                icono={<Box size={28} strokeWidth={2.75} />}
                titulo="Ningún producto en el catálogo"
                mensaje="Agrega ítems de tipo «Producto» en el Catálogo para empezar a controlar su stock acá."
                accion={
                  <Link href="/dashboard/registros/catalogo">
                    <Button>Ir al Catálogo</Button>
                  </Link>
                }
              />
            </div>
          )}

          {productos && productos.length > 0 && (() => {
            const bajo = productos.filter((p) => estadoStock(p, usuario.empresa.inventario_stock_minimo_default) === "stock_bajo").length;
            const sin = productos.filter((p) => estadoStock(p, usuario.empresa.inventario_stock_minimo_default) === "sin_stock").length;
            return (
              <div className="my-ds-6 grid gap-ds-4 sm:grid-cols-2 lg:grid-cols-4">
                <Stat etiqueta="SKUs con stock" valor={productos.length} />
                <Stat etiqueta="Cantidad total" valor={productos.reduce((acc, p) => acc + (p.stock_actual ?? 0), 0)} />
                <Stat etiqueta="Stock bajo" valor={bajo} nota={bajo > 0 ? "revisar reposición" : undefined} tono="alerta" />
                <Stat etiqueta="Sin stock" valor={sin} nota={sin > 0 ? "sin unidades" : undefined} tono="riesgo" />
              </div>
            );
          })()}

          {productos && productos.length > 0 && (
            <div className="my-ds-6">
              <Card sinRelleno elevacion="sm">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-ds-body">
                    <thead>
                      <tr className="border-b border-ds-divider text-[11px] font-medium uppercase tracking-[0.08em] text-ds-text/60">
                        <th className="px-ds-4 py-ds-3">Ítem</th>
                        <th className="px-ds-4 py-ds-3">SKU</th>
                        <th className="px-ds-4 py-ds-3">Categoría</th>
                        <th className="px-ds-4 py-ds-3">Stock actual</th>
                        <th className="px-ds-4 py-ds-3">Stock mínimo</th>
                        <th className="px-ds-4 py-ds-3">Estado</th>
                        <th className="px-ds-4 py-ds-3">Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {productos.map((p) => {
                        const estado = estadoStock(p, usuario?.empresa.inventario_stock_minimo_default ?? 0);
                        return (
                          <Fragment key={p.id}>
                            <tr className="border-b border-ds-text/[0.08] last:border-0">
                              <td className="px-ds-4 py-ds-3 font-medium text-ds-text">{p.nombre}</td>
                              <td className="px-ds-4 py-ds-3 text-ds-text/70">{p.sku || "—"}</td>
                              <td className="px-ds-4 py-ds-3 text-ds-text/70">{p.categoria || "—"}</td>
                              <td className="px-ds-4 py-ds-3 text-ds-text">
                                {p.stock_actual ?? 0} {p.unidad}
                              </td>
                              <td className="px-ds-4 py-ds-3 text-ds-text/70">
                                {p.stock_minimo ?? `${usuario?.empresa.inventario_stock_minimo_default ?? 0} (por defecto)`}
                              </td>
                              <td className="px-ds-4 py-ds-3">
                                <StatusBadge estado={estado} etiqueta={ETIQUETA_ESTADO_STOCK[estado]} tonoForzado={TONO_STOCK[estado]} />
                              </td>
                              <td className="px-ds-4 py-ds-3">
                                <Button variante="secundario" onPress={() => (ajustandoId === p.id ? setAjustandoId(null) : abrirAjuste(p.id))}>
                                  Ajustar
                                </Button>
                              </td>
                            </tr>
                            {ajustandoId === p.id && (
                              <tr className="border-b border-ds-divider bg-ds-brand/[0.06] last:border-0">
                                <td colSpan={7} className="px-ds-4 py-ds-4">
                                  <form onSubmit={onSubmitAjuste} className="flex flex-wrap items-end gap-ds-3">
                                    <Select
                                      etiqueta="Movimiento"
                                      valor={tipoMov}
                                      onCambio={(v) => setTipoMov(v as TipoMovimientoInventario)}
                                      opciones={[
                                        { valor: "entrada", etiqueta: "Entrada" },
                                        { valor: "salida", etiqueta: "Salida" },
                                        { valor: "ajuste", etiqueta: "Ajuste (fija el stock)" },
                                      ]}
                                    />
                                    <div className="w-32">
                                      <Input etiqueta="Cantidad" tipo="numero" requerido valor={cantidad} onCambio={setCantidad} />
                                    </div>
                                    <div className="min-w-[200px] flex-1">
                                      <Input etiqueta="Motivo (opcional)" valor={motivo} onCambio={setMotivo} />
                                    </div>
                                    <Button tipo="submit" cargando={guardando}>
                                      Registrar
                                    </Button>
                                    <Button variante="ghost" onPress={() => setAjustandoId(null)}>
                                      Cancelar
                                    </Button>
                                    {formError ? <p className="w-full font-ds-body text-ds-small text-ds-accent-700">{formError}</p> : null}
                                  </form>
                                </td>
                              </tr>
                            )}
                          </Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </Card>
            </div>
          )}

          {movimientos.length > 0 && (
            <div className="my-ds-6">
              <Card>
                <p className="mb-ds-4 font-ds-body text-ds-small font-semibold text-ds-text">Movimientos recientes</p>
                <div className="flex flex-col divide-y divide-ds-divider">
                  {movimientos.map((m) => (
                    <div key={m.id} className="flex items-center justify-between py-2.5 font-ds-body text-ds-small">
                      <div>
                        <p className="flex items-center gap-1.5 font-medium text-ds-text">
                          {m.item_nombre ?? "Ítem eliminado"}
                          {m.origen === "automatico" && (
                            <span className="rounded-ds-pill bg-ds-brand/[0.08] px-1.5 py-0.5 text-[10px] font-medium text-ds-brand">automático</span>
                          )}
                        </p>
                        <p className="font-ds-body text-ds-caption text-ds-text/60">
                          {m.motivo || "Sin motivo indicado"} · {new Date(m.creado_en).toLocaleString("es-CL")}
                        </p>
                      </div>
                      <div className="flex items-center gap-ds-2 text-right">
                        <StatusBadge estado={m.tipo} tonoForzado={TONO_MOVIMIENTO[m.tipo]} />
                        <span className="text-ds-text/70">
                          {m.tipo === "salida" ? "-" : "+"}
                          {m.cantidad} → {m.stock_resultante}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          )}
        </>
      )}
    </DashboardShell>
  );
}
