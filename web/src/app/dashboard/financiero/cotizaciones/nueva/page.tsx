"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import type { Cliente } from "@bitacora/shared";
import { supabase } from "@/lib/supabase";
import { apiFetch } from "@/lib/api";
import { formatMoneda } from "@/lib/formatMoneda";
import { DashboardShell, type UsuarioShell } from "@/components/DashboardShell";
import { Button, Card, ErrorText, Input, Label, PageHeader, Select } from "@/components/ui";
import { IconChevronLeft, IconPlus } from "@/components/icons";
import { CatalogoSelectorModal, type ItemSeleccionadoCatalogo } from "@/components/CatalogoSelectorModal";

type Linea = { catalogo_item_id: string | null; descripcion: string; cantidad: string; precio_unitario: string };

const IVA_TASA = 0.19;

export default function NuevaCotizacionPage() {
  const router = useRouter();
  const [usuario, setUsuario] = useState<UsuarioShell | null>(null);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  const [clienteId, setClienteId] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [fechaVencimiento, setFechaVencimiento] = useState("");
  const [lineas, setLineas] = useState<Linea[]>([]);
  const [selectorAbierto, setSelectorAbierto] = useState(false);

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
            colorPrimarioForeground: u.empresa?.color_primario_foreground ?? null,
            colorSecundario: u.empresa?.color_secundario ?? null,
            fuente: u.empresa?.fuente ?? null,
            moneda: u.empresa?.moneda ?? "CLP",
          });
      }
      if (resClientes.ok) setClientes(await resClientes.json());
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function quitarLinea(idx: number) {
    setLineas((v) => v.filter((_, i) => i !== idx));
  }
  function onAgregarDesdeSelector(item: ItemSeleccionadoCatalogo) {
    setLineas((v) => [
      ...v,
      {
        catalogo_item_id: item.catalogo_item_id,
        descripcion: item.descripcion,
        cantidad: String(item.cantidad),
        precio_unitario: String(item.precio_unitario),
      },
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
        className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-brand hover:underline"
      >
        <IconChevronLeft className="h-4 w-4" />
        Cotizaciones
      </button>
      <PageHeader title="Nueva Cotización" subtitle="Arma la cotización con ítems de tu Catálogo" />

      <form onSubmit={onSubmit} className="mt-6 flex flex-col gap-6">
        <Card>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label>Cliente</Label>
              <Select required value={clienteId} onChange={(e) => setClienteId(e.target.value)}>
                <option value="">Selecciona un cliente…</option>
                {clientes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nombre}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label>Fecha de vencimiento (opcional)</Label>
              <Input type="date" value={fechaVencimiento} onChange={(e) => setFechaVencimiento(e.target.value)} />
            </div>
            <div className="sm:col-span-2">
              <Label>Descripción (opcional)</Label>
              <Input type="text" value={descripcion} onChange={(e) => setDescripcion(e.target.value)} placeholder="Ej: Mantención preventiva trimestral" />
            </div>
          </div>
        </Card>

        <Card>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-foreground">Ítems</h2>
          </div>

          {lineas.length === 0 && <p className="mb-4 text-sm text-muted">Todavía no agregas ítems.</p>}

          <div className="flex flex-col gap-3">
            {lineas.map((l, idx) => (
              <div key={idx} className="grid items-end gap-3 sm:grid-cols-[2fr_1fr_1fr_auto]">
                <div>
                  <Label>Descripción</Label>
                  <Input type="text" required value={l.descripcion} onChange={(e) => cambiarLinea(idx, { descripcion: e.target.value })} />
                </div>
                <div>
                  <Label>Cantidad</Label>
                  <Input type="number" min="0.01" step="0.01" required value={l.cantidad} onChange={(e) => cambiarLinea(idx, { cantidad: e.target.value })} />
                </div>
                <div>
                  <Label>Precio unitario</Label>
                  <Input type="number" min="0" step="1" required value={l.precio_unitario} onChange={(e) => cambiarLinea(idx, { precio_unitario: e.target.value })} />
                </div>
                <Button type="button" variant="ghost" onClick={() => quitarLinea(idx)}>
                  Quitar
                </Button>
              </div>
            ))}
          </div>

          <Button type="button" variant="outline" onClick={() => setSelectorAbierto(true)} className="mt-4">
            <IconPlus className="h-4 w-4" />
            Agregar ítem
          </Button>

          <CatalogoSelectorModal
            open={selectorAbierto}
            onClose={() => setSelectorAbierto(false)}
            onAgregar={onAgregarDesdeSelector}
            moneda={usuario.moneda ?? "CLP"}
          />

          <div className="mt-6 flex flex-col items-end gap-1 border-t border-border pt-4 text-sm">
            <div className="flex w-56 justify-between">
              <span className="text-muted">Subtotal</span>
              <span className="text-foreground">{formatMoneda(subtotal, usuario.moneda)}</span>
            </div>
            <div className="flex w-56 justify-between">
              <span className="text-muted">IVA (19%)</span>
              <span className="text-foreground">{formatMoneda(iva, usuario.moneda)}</span>
            </div>
            <div className="flex w-56 justify-between text-base font-semibold">
              <span className="text-foreground">Total</span>
              <span className="text-foreground">{formatMoneda(total, usuario.moneda)}</span>
            </div>
          </div>
        </Card>

        {error && <ErrorText>{error}</ErrorText>}
        <div className="flex gap-2">
          <Button type="submit" disabled={guardando}>
            {guardando ? "Guardando…" : "Guardar cotización"}
          </Button>
          <Button type="button" variant="ghost" onClick={() => router.push("/dashboard/financiero/cotizaciones")}>
            Cancelar
          </Button>
        </div>
      </form>
    </DashboardShell>
  );
}
