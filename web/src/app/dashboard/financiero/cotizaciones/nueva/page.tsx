"use client";

import { Suspense, useEffect, useMemo, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, Plus } from "lucide-react";
import type { Cliente } from "@bitacora/shared";
import { supabase } from "@/lib/supabase";
import { apiFetch } from "@/lib/api";
import { formatMoneda } from "@/lib/formatMoneda";
import { DashboardShell, type UsuarioShell } from "@/components/DashboardShell";
import { Button, Card, DatePicker, Input } from "@bitacora/ui/web";
import { InputMonto } from "@/components/InputMonto";
import { CatalogoSelectorModal, type ItemSeleccionadoCatalogo } from "@/components/CatalogoSelectorModal";
import { ComboboxCliente } from "@/components/ComboboxCliente";

type Linea = {
  catalogo_item_id: string | null;
  descripcion: string;
  cantidad: string;
  precio_unitario: string;
  // Solo si la empresa tiene precios_avanzados_activado (migración 116).
  costo: string;
  precio_mayorista: string;
  precio_minorista: string;
};

const IVA_TASA = 0.19;

// PASO 6 (sistema de diseño) — migrado. Ver docs/design-system.md.
function NuevaCotizacionContenido() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [usuario, setUsuario] = useState<UsuarioShell | null>(null);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  // Preselección desde la Vista 360° del Cliente ("+ Nueva Cotización"
  // en la ficha ya trae el cliente puesto, sin tener que buscarlo de nuevo).
  const [clienteId, setClienteId] = useState(() => searchParams.get("cliente_id") ?? "");
  const [descripcion, setDescripcion] = useState("");
  const [fechaVencimiento, setFechaVencimiento] = useState("");
  const [lineas, setLineas] = useState<Linea[]>([]);
  const [selectorAbierto, setSelectorAbierto] = useState(false);
  // Migración 116 — ver nota en ordenes/nueva/page.tsx.
  const [preciosAvanzados, setPreciosAvanzados] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        router.replace("/login");
        return;
      }
      const [resMe, resClientes] = await Promise.all([apiFetch("/api/me"), apiFetch("/api/clientes")]);
      if (resMe.ok) {
        const { usuario: u } = await resMe.json();
        if (u)
          setUsuario({
            nombre: u.nombre,
            rol: u.rol,
            empresaNombre: u.empresa?.nombre ?? "",
            empresaLogoUrl: u.empresa?.logo_url ?? null,
            colorPrimario: u.empresa?.color_primario ?? null,
            tema: u.empresa?.tema ?? "faena",
            colorPrimarioForeground: u.empresa?.color_primario_foreground ?? null,
            colorSecundario: u.empresa?.color_secundario ?? null,
            fuente: u.empresa?.fuente ?? null,
            moneda: u.empresa?.moneda ?? "CLP",
          });
        setPreciosAvanzados(Boolean(u?.empresa?.precios_avanzados_activado));
      }
      if (resClientes.ok) setClientes(await resClientes.json());
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function quitarLinea(idx: number) {
    setLineas((v) => v.filter((_, i) => i !== idx));
  }
  function onAgregarDesdeSelector(items: ItemSeleccionadoCatalogo[]) {
    setLineas((v) => [
      ...v,
      ...items.map((item) => ({
        catalogo_item_id: item.catalogo_item_id,
        descripcion: item.descripcion,
        cantidad: String(item.cantidad),
        precio_unitario: String(item.precio_unitario),
        costo: item.costo != null ? String(item.costo) : "",
        precio_mayorista: item.precio_mayorista != null ? String(item.precio_mayorista) : "",
        precio_minorista: item.precio_minorista != null ? String(item.precio_minorista) : "",
      })),
    ]);
  }
  function cambiarLinea(idx: number, cambios: Partial<Linea>) {
    setLineas((v) => v.map((l, i) => (i === idx ? { ...l, ...cambios } : l)));
  }

  const { subtotal, iva, total } = useMemo(() => {
    const sub = lineas.reduce((acc, l) => acc + (Number(l.cantidad) || 0) * (Number(l.precio_unitario) || 0), 0);
    const ivaCalc = Math.round(sub * IVA_TASA);
    return { subtotal: Math.round(sub), iva: ivaCalc, total: Math.round(sub) + ivaCalc };
  }, [lineas]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!clienteId) {
      setError("Selecciona un cliente");
      return;
    }
    if (lineas.length === 0) {
      setError("Agrega al menos un ítem");
      return;
    }
    setGuardando(true);
    const res = await apiFetch("/api/cotizaciones", {
      method: "POST",
      body: JSON.stringify({
        cliente_id: clienteId,
        descripcion,
        fecha_vencimiento: fechaVencimiento || null,
        items: lineas.map((l) => ({
          catalogo_item_id: l.catalogo_item_id,
          descripcion: l.descripcion,
          cantidad: Number(l.cantidad),
          precio_unitario: Number(l.precio_unitario),
          costo: l.costo.trim() ? Number(l.costo) : null,
          precio_mayorista: l.precio_mayorista.trim() ? Number(l.precio_mayorista) : null,
          precio_minorista: l.precio_minorista.trim() ? Number(l.precio_minorista) : null,
        })),
      }),
    });
    setGuardando(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "No se pudo crear la cotización");
      return;
    }
    const nueva = await res.json();
    router.push(`/dashboard/financiero/cotizaciones/${nueva.id}`);
  }

  if (!usuario) return null;

  return (
    <DashboardShell usuario={usuario}>
      <button
        type="button"
        onClick={() => router.push("/dashboard/financiero/cotizaciones")}
        className="mb-ds-4 inline-flex items-center gap-ds-1 font-ds-body text-ds-small font-medium text-ds-brand hover:underline"
      >
        <ChevronLeft size={16} strokeWidth={2.75} />
        Cotizaciones
      </button>
      <p className="ds-heading text-ds-h2 text-ds-text">Nueva Cotización</p>
      <p className="mt-ds-1 font-ds-body text-ds-small text-ds-text/70">Arma la cotización con ítems de tu Catálogo</p>

      <form onSubmit={onSubmit} className="mt-ds-6 flex flex-col gap-ds-6">
        <Card>
          <div className="grid gap-ds-4 sm:grid-cols-2">
            <div className="flex flex-col gap-ds-1">
              <label className="font-ds-body text-ds-caption font-medium text-ds-text/70">Cliente</label>
              <ComboboxCliente
                value={clienteId}
                onChange={setClienteId}
                clientes={clientes}
                onClienteCreado={(c) => setClientes((prev) => [...prev, c])}
                placeholder="Selecciona un cliente…"
              />
            </div>
            <DatePicker etiqueta="Fecha de vencimiento (opcional)" valor={aFecha(fechaVencimiento)} onCambio={(f) => setFechaVencimiento(aTexto(f))} />
            <div className="sm:col-span-2">
              <Input etiqueta="Descripción (opcional)" valor={descripcion} onCambio={setDescripcion} placeholder="Ej: Mantención preventiva trimestral" />
            </div>
          </div>
        </Card>

        <Card>
          <p className="mb-ds-4 font-ds-body text-ds-small font-semibold text-ds-text">Ítems</p>

          {lineas.length === 0 && <p className="mb-ds-4 font-ds-body text-ds-small text-ds-text/70">Todavía no agregas ítems.</p>}

          <div className="flex flex-col gap-ds-3">
            {lineas.map((l, idx) => (
              <div key={idx} className="flex flex-col gap-ds-2 border-b border-ds-divider pb-ds-3 last:border-0 last:pb-0">
              <div className="grid items-end gap-ds-3 sm:grid-cols-[2fr_1fr_1fr_auto]">
                <Input etiqueta="Descripción" requerido valor={l.descripcion} onCambio={(v) => cambiarLinea(idx, { descripcion: v })} />
                <Input etiqueta="Cantidad" tipo="numero" requerido valor={l.cantidad} onCambio={(v) => cambiarLinea(idx, { cantidad: v })} />
                <div className="flex flex-col gap-ds-1">
                  <label className="font-ds-body text-ds-caption font-medium text-ds-text/70">Precio unitario</label>
                  <InputMonto required value={l.precio_unitario} onChange={(v) => cambiarLinea(idx, { precio_unitario: v })} moneda={usuario.moneda} />
                </div>
                <Button variante="ghost" onPress={() => quitarLinea(idx)}>
                  Quitar
                </Button>
              </div>
              {preciosAvanzados && (
                <div className="grid gap-ds-3 sm:grid-cols-3">
                  <div className="flex flex-col gap-ds-1">
                    <label className="font-ds-body text-ds-caption font-medium text-ds-text/70">Costo (opcional)</label>
                    <InputMonto value={l.costo} onChange={(v) => cambiarLinea(idx, { costo: v })} moneda={usuario.moneda} />
                  </div>
                  <div className="flex flex-col gap-ds-1">
                    <label className="font-ds-body text-ds-caption font-medium text-ds-text/70">P. mayorista (opcional)</label>
                    <InputMonto value={l.precio_mayorista} onChange={(v) => cambiarLinea(idx, { precio_mayorista: v })} moneda={usuario.moneda} />
                  </div>
                  <div className="flex flex-col gap-ds-1">
                    <label className="font-ds-body text-ds-caption font-medium text-ds-text/70">P. minorista (opcional)</label>
                    <InputMonto value={l.precio_minorista} onChange={(v) => cambiarLinea(idx, { precio_minorista: v })} moneda={usuario.moneda} />
                  </div>
                </div>
              )}
              </div>
            ))}
          </div>

          <div className="mt-ds-4">
            <Button variante="secundario" iconoIzq={<Plus size={16} strokeWidth={2.75} />} onPress={() => setSelectorAbierto(true)}>
              Agregar del catálogo
            </Button>
          </div>

          <CatalogoSelectorModal open={selectorAbierto} onClose={() => setSelectorAbierto(false)} onAgregar={onAgregarDesdeSelector} moneda={usuario.moneda ?? "CLP"} />

          <div className="mt-ds-6 flex flex-col items-end gap-ds-1 border-t border-ds-divider pt-ds-4 font-ds-body text-ds-small">
            <div className="flex w-56 justify-between">
              <span className="text-ds-text/60">Subtotal</span>
              <span className="text-ds-text">{formatMoneda(subtotal, usuario.moneda)}</span>
            </div>
            <div className="flex w-56 justify-between">
              <span className="text-ds-text/60">IVA (19%)</span>
              <span className="text-ds-text">{formatMoneda(iva, usuario.moneda)}</span>
            </div>
            <div className="flex w-56 justify-between text-ds-body font-semibold">
              <span className="text-ds-text">Total</span>
              <span className="text-ds-text">{formatMoneda(total, usuario.moneda)}</span>
            </div>
          </div>
        </Card>

        {error ? <p className="font-ds-body text-ds-small text-ds-accent-700">{error}</p> : null}
        <div className="flex gap-ds-2">
          <Button tipo="submit" cargando={guardando}>
            Guardar cotización
          </Button>
          <Button variante="ghost" onPress={() => router.push("/dashboard/financiero/cotizaciones")}>
            Cancelar
          </Button>
        </div>
      </form>
    </DashboardShell>
  );
}

// DatePicker (packages/ui) trabaja con Date, el estado de este archivo
// con texto ISO — mismo par de helpers que ya usa ordenes/page.tsx.
function aFecha(texto: string): Date | null {
  if (!texto) return null;
  const [y, m, d] = texto.split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}
function aTexto(fecha: Date | null): string {
  if (!fecha) return "";
  const y = fecha.getFullYear();
  const m = String(fecha.getMonth() + 1).padStart(2, "0");
  const d = String(fecha.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

// useSearchParams() necesita un boundary de Suspense para el build de
// producción (si no, Next aborta con "missing-suspense-with-csr-bailout").
export default function NuevaCotizacionPage() {
  return (
    <Suspense fallback={null}>
      <NuevaCotizacionContenido />
    </Suspense>
  );
}
