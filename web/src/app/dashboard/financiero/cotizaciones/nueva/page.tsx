"use client";

import { Suspense, useEffect, useMemo, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, Plus } from "lucide-react";
import { CIUDADES_CHILE, ROLES_SUPERVISION, type Cliente, type ModoPrecioViaje } from "@bitacora/shared";
import { supabase } from "@/lib/supabase";
import { apiFetch } from "@/lib/api";
import { formatMoneda } from "@/lib/formatMoneda";
import { DashboardShell, type UsuarioShell } from "@/components/DashboardShell";
import { Button, Card, DatePicker, Input } from "@bitacora/ui/web";
import { InputMonto } from "@/components/InputMonto";
import { CatalogoSelectorModal, type ItemSeleccionadoCatalogo } from "@/components/CatalogoSelectorModal";
import { ComboboxCliente } from "@/components/ComboboxCliente";
import { Combobox } from "@/components/Combobox";
import { PrecioViaje } from "@/components/PrecioViaje";

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
  // Cotización de viaje (tarea 135): solo Admin/Supervisor con el módulo Viajes.
  const [puedeViaje, setPuedeViaje] = useState(false);
  const [tipo, setTipo] = useState<"servicio" | "viaje">(() => (searchParams.get("tipo") === "viaje" ? "viaje" : "servicio"));
  const [fechaViaje, setFechaViaje] = useState("");
  const [origen, setOrigen] = useState("");
  const [destino, setDestino] = useState("");
  const [paradas, setParadas] = useState<string[]>([]);
  const [modoPrecio, setModoPrecio] = useState<ModoPrecioViaje>("fijo");
  const [distanciaKm, setDistanciaKm] = useState("");
  const [montoViaje, setMontoViaje] = useState("");
  const [ciudadesLibres, setCiudadesLibres] = useState<string[]>([]);
  const opcionesCiudad = useMemo(() => [...CIUDADES_CHILE, ...ciudadesLibres].map((c) => ({ id: c, label: c })), [ciudadesLibres]);
  // Sin permiso de precios de viajes, ?tipo=viaje no abre el formulario de viaje.
  useEffect(() => {
    if (usuario && !puedeViaje) setTipo("servicio");
  }, [usuario, puedeViaje]);
  function agregarCiudadLibre(texto: string) {
    if (texto && !CIUDADES_CHILE.includes(texto)) setCiudadesLibres((prev) => (prev.includes(texto) ? prev : [...prev, texto]));
  }

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        router.replace("/login");
        return;
      }
      const [resMe, resClientes] = await Promise.all([apiFetch("/api/me"), apiFetch("/api/clientes")]);
      if (resMe.ok) {
        const cuerpoMe = await resMe.json();
        const u = cuerpoMe.usuario;
        setPuedeViaje(Boolean(u) && ROLES_SUPERVISION.includes(u.rol) && Array.isArray(cuerpoMe.modulos_visibles) && cuerpoMe.modulos_visibles.includes("viajes"));
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
    const sub = tipo === "viaje" ? Number(montoViaje) || 0 : lineas.reduce((acc, l) => acc + (Number(l.cantidad) || 0) * (Number(l.precio_unitario) || 0), 0);
    const ivaCalc = Math.round(sub * IVA_TASA);
    return { subtotal: Math.round(sub), iva: ivaCalc, total: Math.round(sub) + ivaCalc };
  }, [lineas, tipo, montoViaje]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!clienteId) {
      setError("Selecciona un cliente");
      return;
    }
    const esViaje = tipo === "viaje";
    if (esViaje && (!origen || !destino)) {
      setError("Indica origen y destino del viaje");
      return;
    }
    if (esViaje && !montoViaje) {
      setError("Indica el monto del viaje (o calcúlalo)");
      return;
    }
    if (!esViaje && lineas.length === 0) {
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
        ...(esViaje
          ? {
              tipo: "viaje",
              viaje: { fecha: fechaViaje || null, origen, destino, paradas: paradas.filter((p) => p.trim()), modo_precio: modoPrecio, distancia_km: distanciaKm || null, monto: montoViaje },
            }
          : {}),
        items: esViaje ? [] : lineas.map((l) => ({
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

        {puedeViaje ? (
          <div className="flex gap-ds-2" role="radiogroup" aria-label="Tipo de cotización">
            {(["servicio", "viaje"] as const).map((t) => (
              <button
                key={t}
                type="button"
                role="radio"
                aria-checked={tipo === t}
                onClick={() => setTipo(t)}
                className={`rounded-ds-pill border px-ds-4 py-ds-2 font-ds-body text-ds-small font-medium ${
                  tipo === t ? "border-transparent bg-ds-brand text-ds-brand-foreground" : "border-ds-divider text-ds-text/70 hover:bg-ds-brand/[0.08]"
                }`}
              >
                {t === "servicio" ? "Cotización de servicio" : "Cotización de viaje"}
              </button>
            ))}
          </div>
        ) : null}

        {tipo === "viaje" ? (
          <Card>
            <p className="mb-ds-4 font-ds-body text-ds-small font-semibold text-ds-text">Viaje a cotizar</p>
            <div className="grid gap-ds-4 sm:grid-cols-2 lg:grid-cols-3">
              <DatePicker etiqueta="Fecha del viaje (opcional)" valor={aFecha(fechaViaje)} onCambio={(f) => setFechaViaje(aTexto(f))} />
              <div className="flex flex-col gap-ds-1">
                <label className="font-ds-body text-ds-caption font-medium text-ds-text/70">Origen</label>
                <Combobox value={origen} onChange={setOrigen} opciones={opcionesCiudad} placeholder="Ciudad de origen" etiquetaCrear={(t) => `Usar "${t}"`} onCrear={(t) => { agregarCiudadLibre(t); setOrigen(t); }} />
              </div>
              <div className="flex flex-col gap-ds-1">
                <label className="font-ds-body text-ds-caption font-medium text-ds-text/70">Destino</label>
                <Combobox value={destino} onChange={setDestino} opciones={opcionesCiudad} placeholder="Ciudad de destino" etiquetaCrear={(t) => `Usar "${t}"`} onCrear={(t) => { agregarCiudadLibre(t); setDestino(t); }} />
              </div>
              <PrecioViaje
                modo={modoPrecio}
                onModo={setModoPrecio}
                origen={origen}
                destino={destino}
                paradas={paradas}
                onParadas={setParadas}
                km={distanciaKm}
                onKm={setDistanciaKm}
                clienteId={clienteId}
                onMontoPropuesto={setMontoViaje}
                opcionesCiudad={opcionesCiudad}
                onCiudadLibre={agregarCiudadLibre}
                moneda={usuario.moneda}
              />
              <div className="flex flex-col gap-ds-1">
                <label className="font-ds-body text-ds-caption font-medium text-ds-text/70">Monto del viaje (neto)</label>
                <InputMonto required value={montoViaje} onChange={setMontoViaje} moneda={usuario.moneda} />
              </div>
            </div>
            <div className="mt-ds-6 flex flex-col items-end gap-ds-1 border-t border-ds-divider pt-ds-4 font-ds-body text-ds-small">
              <div className="flex w-56 justify-between"><span className="text-ds-text-secondary">Subtotal</span><span className="text-ds-text">{formatMoneda(subtotal, usuario.moneda)}</span></div>
              <div className="flex w-56 justify-between"><span className="text-ds-text-secondary">IVA (19%)</span><span className="text-ds-text">{formatMoneda(iva, usuario.moneda)}</span></div>
              <div className="flex w-56 justify-between text-ds-body font-semibold"><span className="text-ds-text">Total</span><span className="text-ds-text">{formatMoneda(total, usuario.moneda)}</span></div>
            </div>
          </Card>
        ) : (
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
              <span className="text-ds-text-secondary">Subtotal</span>
              <span className="text-ds-text">{formatMoneda(subtotal, usuario.moneda)}</span>
            </div>
            <div className="flex w-56 justify-between">
              <span className="text-ds-text-secondary">IVA (19%)</span>
              <span className="text-ds-text">{formatMoneda(iva, usuario.moneda)}</span>
            </div>
            <div className="flex w-56 justify-between text-ds-body font-semibold">
              <span className="text-ds-text">Total</span>
              <span className="text-ds-text">{formatMoneda(total, usuario.moneda)}</span>
            </div>
          </div>
        </Card>
        )}

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
