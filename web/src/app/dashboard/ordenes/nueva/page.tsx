"use client";

import { Suspense, useEffect, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { CatalogoItem, Cliente, Equipo, Prioridad, Usuario } from "@bitacora/shared";
import { supabase } from "@/lib/supabase";
import { apiFetch } from "@/lib/api";
import { EVENTOS } from "@bitacora/shared";
import { registrarEvento } from "@/lib/analytics";
import { DashboardShell, type UsuarioShell } from "@/components/DashboardShell";
import { Aviso, Button, Card, DatePicker, Input, Select, Textarea } from "@bitacora/ui/web";
import { PageHeader } from "@/components/PageHeader";
import { InputMonto } from "@/components/InputMonto";
import { IconClipboardCheck, IconPlus } from "@/components/icons";
import { CatalogoSelectorModal, type ItemSeleccionadoCatalogo } from "@/components/CatalogoSelectorModal";
import { ComboboxCliente } from "@/components/ComboboxCliente";
import { ComboboxResponsable } from "@/components/ComboboxResponsable";
import { ComboboxEquipo } from "@/components/ComboboxEquipo";

type ItemOS = {
  catalogo_item_id: string | null;
  descripcion: string;
  cantidad: string;
  precio_unitario: string;
  // Solo si la empresa tiene precios_avanzados_activado (migración 116).
  costo: string;
  precio_mayorista: string;
  precio_minorista: string;
};
const ITEM_VACIO: ItemOS = { catalogo_item_id: null, descripcion: "", cantidad: "1", precio_unitario: "0", costo: "", precio_mayorista: "", precio_minorista: "" };

const PRIORIDADES: Prioridad[] = ["alta", "media", "baja"];

// Rótulo de campo con el mismo look que `etiqueta` de @bitacora/ui, para
// los controles que no la tienen (Combobox*, InputMonto, cantidad).
const LABEL = "font-ds-body text-ds-caption font-medium text-ds-text/70";

// yyyy-mm-dd ↔ Date en hora local (mismo helper que ordenes/page.tsx).
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

function NuevaOrdenServicioContenido() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [usuario, setUsuario] = useState<UsuarioShell | null>(null);
  const [equipo, setEquipo] = useState<Usuario[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  // Bloque C — activos (maquinaria/vehículos) del cliente, no
  // confundir con "equipo" de arriba (colaboradores).
  const [equipos, setEquipos] = useState<Equipo[]>([]);
  const [equipoIdOS, setEquipoIdOS] = useState("");
  const [catalogo, setCatalogo] = useState<CatalogoItem[]>([]);
  // Costo/mayorista/minorista (migración 116) — opt-in por empresa,
  // ver Configuración > Empresa. UsuarioShell no trae este campo (es
  // una proyección liviana), se guarda aparte igual que el resto de
  // los datos que esta pantalla necesita del /api/me crudo.
  const [preciosAvanzados, setPreciosAvanzados] = useState(false);

  // Preselección desde la Vista 360° del Cliente ("+ Nueva OS" en la
  // ficha ya trae el cliente puesto).
  const [clienteId, setClienteId] = useState(() => searchParams.get("cliente_id") ?? "");
  const [responsableId, setResponsableId] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [ordenCompraCliente, setOrdenCompraCliente] = useState("");
  const [fecha, setFecha] = useState(() => new Date().toISOString().slice(0, 10));
  const [horaProgramada, setHoraProgramada] = useState("");
  const [prioridad, setPrioridad] = useState<Prioridad>("media");
  const [items, setItems] = useState<ItemOS[]>([{ ...ITEM_VACIO }]);
  const [selectorAbierto, setSelectorAbierto] = useState(false);

  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [creada, setCreada] = useState<{ folio: number | null } | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        router.replace("/login");
        return;
      }
      const [resMe, resEquipo, resClientes, resEquipos, resCatalogo] = await Promise.all([
        apiFetch("/api/me"),
        apiFetch("/api/usuarios"),
        apiFetch("/api/clientes"),
        apiFetch("/api/equipos"),
        apiFetch("/api/catalogo"),
      ]);
      if (resMe.ok) {
        const { usuario: u } = await resMe.json();
        if (u) {
          setUsuario({ nombre: u.nombre, rol: u.rol, empresaNombre: u.empresa?.nombre ?? "", empresaLogoUrl: u.empresa?.logo_url ?? null, colorPrimario: u.empresa?.color_primario ?? null, tema: u.empresa?.tema ?? "faena", colorPrimarioForeground: u.empresa?.color_primario_foreground ?? null, colorSecundario: u.empresa?.color_secundario ?? null, fuente: u.empresa?.fuente ?? null, moneda: u.empresa?.moneda ?? "CLP" });
          setPreciosAvanzados(Boolean(u.empresa?.precios_avanzados_activado));
        }
      }
      if (resEquipo.ok) {
        const lista: Usuario[] = await resEquipo.json();
        setEquipo(lista);
        if (lista.length > 0) setResponsableId(lista[0].id);
      }
      if (resClientes.ok) setClientes(await resClientes.json());
      if (resEquipos.ok) setEquipos(await resEquipos.json());
      if (resCatalogo.ok) setCatalogo(await resCatalogo.json());
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function actualizarItem(i: number, campo: keyof ItemOS, valor: string) {
    setItems((prev) => prev.map((it, idx) => (idx === i ? { ...it, [campo]: valor } : it)));
  }
  function quitarItem(i: number) {
    setItems((prev) => prev.filter((_, idx) => idx !== i));
  }
  function onAgregarDesdeSelector(items: ItemSeleccionadoCatalogo[]) {
    setItems((prev) => [
      ...prev,
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

  const clienteSeleccionado = clientes.find((c) => c.id === clienteId);
  // Stock actual de un ítem del catálogo, solo si es un producto con
  // control de stock. null = no aplica (servicio, kit, o ítem manual).
  function stockDe(catalogoItemId: string | null): number | null {
    if (!catalogoItemId) return null;
    const it = catalogo.find((c) => c.id === catalogoItemId);
    return it && it.tipo === "producto" && it.stock_actual != null ? it.stock_actual : null;
  }
  const equiposDelCliente = equipos.filter((e) => e.cliente_id === clienteId);
  const equipoSeleccionadoOS = equipos.find((e) => e.id === equipoIdOS);
  const itemsValidos = items.filter((it) => it.descripcion.trim());
  const totalItems = itemsValidos.reduce(
    (acc, it) => acc + Number(it.cantidad || 0) * Number(it.precio_unitario || 0),
    0
  );

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!clienteId) {
      setError("Selecciona un cliente");
      return;
    }
    if (!responsableId) {
      setError("Selecciona un colaborador");
      return;
    }
    if (!descripcion.trim()) {
      setError("Falta la descripción del servicio");
      return;
    }

    setGuardando(true);
    const res = await apiFetch("/api/trabajos", {
      method: "POST",
      body: JSON.stringify({
        cliente: clienteSeleccionado?.nombre ?? "",
        cliente_id: clienteId,
        equipo_id: equipoIdOS || undefined,
        responsable_id: responsableId,
        descripcion: descripcion.trim(),
        orden_compra_cliente: ordenCompraCliente.trim() || undefined,
        fecha,
        hora_programada: horaProgramada || undefined,
        ubicacion: clienteSeleccionado?.direccion,
        prioridad,
        monto: totalItems,
        estado: "en_curso",
        items: itemsValidos.length > 0 ? JSON.stringify(
          itemsValidos.map((it) => ({
            catalogo_item_id: it.catalogo_item_id,
            descripcion: it.descripcion.trim(),
            cantidad: Number(it.cantidad || 0),
            precio_unitario: Number(it.precio_unitario || 0),
            costo: it.costo.trim() ? Number(it.costo) : null,
            precio_mayorista: it.precio_mayorista.trim() ? Number(it.precio_mayorista) : null,
            precio_minorista: it.precio_minorista.trim() ? Number(it.precio_minorista) : null,
          }))
        ) : undefined,
      }),
    });
    setGuardando(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "No se pudo crear la orden de servicio");
      return;
    }
    const nueva = await res.json();
    registrarEvento(EVENTOS.osCreada, { con_items: itemsValidos.length > 0, origen: "web" });

    // Vino del flujo "Nueva tarea → Crear OS" en Agenda (Parte 2): en vez
    // de mostrar la pantalla de éxito, volver a Agenda para reabrir el
    // borrador de tarea con esta OS ya vinculada.
    if (searchParams.get("volverA") === "agenda") {
      const q = new URLSearchParams({ reabrirTarea: "1", trabajoId: nueva.id });
      if (nueva.folio != null) q.set("folio", String(nueva.folio));
      router.replace(`/dashboard/agenda?${q.toString()}`);
      return;
    }

    setCreada({ folio: nueva.folio ?? null });
  }

  if (!usuario) return null;

  return (
    <DashboardShell usuario={usuario}>
      <PageHeader
        title="Nueva Orden de Servicio"
        subtitle="Se envía al celular del colaborador asignado apenas la guardas"
      />

      {creada ? (
        <div className="my-ds-6">
          <Card>
            <div className="flex flex-col items-center gap-ds-3 py-ds-8 text-center">
              <IconClipboardCheck className="h-10 w-10 text-ds-brand" />
              <Aviso tono="exito">
                {creada.folio != null
                  ? `OS N° ${creada.folio} creada y enviada al celular del colaborador.`
                  : "Orden de servicio creada."}
              </Aviso>
              <div className="flex gap-ds-2">
                <Button onPress={() => router.push("/dashboard/ordenes")}>Ver todas las OS</Button>
                <Button
                  variante="secundario"
                  onPress={() => {
                    setCreada(null);
                    setDescripcion("");
                    setItems([{ ...ITEM_VACIO }]);
                    setEquipoIdOS("");
                  }}
                >
                  Crear otra
                </Button>
              </div>
            </div>
          </Card>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="my-ds-6 flex flex-col gap-ds-6">
          <Card>
            <h2 className="mb-ds-4 font-ds-body text-ds-small font-semibold text-ds-text">Cliente y colaborador</h2>
            <div className="grid gap-ds-4 sm:grid-cols-2">
              <div className="flex flex-col gap-ds-1 sm:col-span-2">
                <label htmlFor="os-nueva-cliente" className={LABEL}>Cliente</label>
                <ComboboxCliente
                  id="os-nueva-cliente"
                  value={clienteId}
                  onChange={(id) => {
                    setClienteId(id);
                    setEquipoIdOS("");
                  }}
                  clientes={clientes}
                  onClienteCreado={(c) => setClientes((prev) => [...prev, c])}
                  placeholder="Selecciona un cliente"
                />
                {clienteSeleccionado && (
                  <p className="font-ds-body text-ds-caption text-ds-text-secondary">{clienteSeleccionado.direccion}</p>
                )}
              </div>
              <div className="flex flex-col gap-ds-1">
                <label htmlFor="os-nueva-colaborador" className={LABEL}>Colaborador</label>
                <ComboboxResponsable
                  id="os-nueva-colaborador"
                  value={responsableId}
                  onChange={setResponsableId}
                  equipo={equipo}
                  placeholder="Selecciona un colaborador"
                />
              </div>
              {clienteId && (
                <div className="flex flex-col gap-ds-1">
                  <label htmlFor="os-nueva-equipo" className={LABEL}>Equipo del cliente (opcional)</label>
                  <ComboboxEquipo
                    id="os-nueva-equipo"
                    value={equipoIdOS}
                    onChange={setEquipoIdOS}
                    equipos={equiposDelCliente}
                    clienteId={clienteId}
                    onEquipoCreado={(nuevo) => setEquipos((prev) => [...prev, nuevo])}
                  />
                </div>
              )}
            </div>

          </Card>

          <Card>
            <h2 className="mb-ds-4 font-ds-body text-ds-small font-semibold text-ds-text">Detalle del servicio</h2>
            <div className="grid gap-ds-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Textarea etiqueta="Descripción" filas={3} requerido valor={descripcion} onCambio={setDescripcion} />
              </div>
              <DatePicker etiqueta="Fecha" requerido valor={aFecha(fecha)} onCambio={(f) => setFecha(aTexto(f))} />
              <Input etiqueta="Hora programada (opcional)" tipo="hora" valor={horaProgramada} onCambio={setHoraProgramada} />
              <Select
                etiqueta="Prioridad"
                valor={prioridad}
                onCambio={(v) => setPrioridad(v as Prioridad)}
                opciones={PRIORIDADES.map((p) => ({ valor: p, etiqueta: p.charAt(0).toUpperCase() + p.slice(1) }))}
              />
              <Input
                etiqueta="Orden de compra del cliente (opcional)"
                valor={ordenCompraCliente}
                onCambio={setOrdenCompraCliente}
                placeholder="N° de OC del cliente"
              />
            </div>
          </Card>

          <Card>
            <div className="mb-ds-4 flex items-center justify-between">
              <h2 className="font-ds-body text-ds-small font-semibold text-ds-text">Ítems / materiales</h2>
              <Button variante="secundario" iconoIzq={<IconPlus className="h-4 w-4" />} onPress={() => setSelectorAbierto(true)}>
                Agregar del catálogo
              </Button>
            </div>
            <div className="flex flex-col gap-ds-3">
              {items.map((it, i) => {
                const stock = stockDe(it.catalogo_item_id);
                const excede = stock != null && Number(it.cantidad || 0) > stock;
                return (
                <div key={i} className="flex flex-col gap-ds-2 border-b border-ds-divider pb-ds-2 last:border-0 last:pb-0">
                <div className="grid grid-cols-[1fr_5rem_7rem_auto] items-start gap-ds-2">
                  <div className="flex flex-col gap-ds-1">
                    <Input
                      etiqueta={i === 0 ? "Descripción" : undefined}
                      etiquetaAccesible={`Descripción del ítem ${i + 1}`}
                      placeholder="Ej: Mano de obra, repuesto…"
                      valor={it.descripcion}
                      onCambio={(v) => actualizarItem(i, "descripcion", v)}
                    />
                    {stock != null && (
                      <p className={`font-ds-body text-ds-caption ${excede ? "text-ds-danger" : "text-ds-text-secondary"}`}>
                        {excede
                          ? `Stock: ${stock} — vas a descontar ${it.cantidad}, quedaría en ${stock - Number(it.cantidad || 0)}`
                          : `Stock: ${stock} — se descontará al llegar la OS al estado disparador`}
                      </p>
                    )}
                  </div>
                  <Input
                    id={`os-item-${i}-cantidad`}
                    tipo="numero"
                    paso={0.01}
                    minimo={0}
                    etiqueta={i === 0 ? "Cant." : undefined}
                    etiquetaAccesible={`Cantidad del ítem ${i + 1}`}
                    valor={it.cantidad}
                    onCambio={(v) => actualizarItem(i, "cantidad", v)}
                  />
                  <div className="flex flex-col gap-ds-1">
                    {i === 0 && <label htmlFor={`os-item-${i}-precio`} className={LABEL}>P. unitario</label>}
                    <InputMonto
                      id={`os-item-${i}-precio`}
                      aria-label={i === 0 ? undefined : `Precio unitario del ítem ${i + 1}`}
                      value={it.precio_unitario}
                      onChange={(v) => actualizarItem(i, "precio_unitario", v)}
                      moneda={usuario.moneda}
                    />
                  </div>
                  <div className={i === 0 ? "mt-6" : ""}>
                    <Button variante="ghost" onPress={() => quitarItem(i)} deshabilitado={items.length === 1}>
                      Quitar
                    </Button>
                  </div>
                </div>
                {preciosAvanzados && (
                  <div className="grid grid-cols-3 gap-ds-2 pl-0 sm:pl-1">
                    <div className="flex flex-col gap-ds-1">
                      {i === 0 && <label htmlFor={`os-item-${i}-costo`} className={LABEL}>Costo (opcional)</label>}
                      <InputMonto
                        id={`os-item-${i}-costo`}
                        aria-label={i === 0 ? undefined : `Costo del ítem ${i + 1}`}
                        value={it.costo}
                        onChange={(v) => actualizarItem(i, "costo", v)}
                        moneda={usuario.moneda}
                      />
                    </div>
                    <div className="flex flex-col gap-ds-1">
                      {i === 0 && <label htmlFor={`os-item-${i}-precio_mayorista`} className={LABEL}>P. mayorista (opcional)</label>}
                      <InputMonto
                        id={`os-item-${i}-precio_mayorista`}
                        aria-label={i === 0 ? undefined : `Precio mayorista del ítem ${i + 1}`}
                        value={it.precio_mayorista}
                        onChange={(v) => actualizarItem(i, "precio_mayorista", v)}
                        moneda={usuario.moneda}
                      />
                    </div>
                    <div className="flex flex-col gap-ds-1">
                      {i === 0 && <label htmlFor={`os-item-${i}-precio_minorista`} className={LABEL}>P. minorista (opcional)</label>}
                      <InputMonto
                        id={`os-item-${i}-precio_minorista`}
                        aria-label={i === 0 ? undefined : `Precio minorista del ítem ${i + 1}`}
                        value={it.precio_minorista}
                        onChange={(v) => actualizarItem(i, "precio_minorista", v)}
                        moneda={usuario.moneda}
                      />
                    </div>
                  </div>
                )}
                </div>
                );
              })}
            </div>
            <p className="mt-ds-4 text-right font-ds-body text-ds-small font-semibold text-ds-text">
              Total: ${totalItems.toLocaleString("es-CL")}
            </p>
          </Card>

          <CatalogoSelectorModal
            open={selectorAbierto}
            onClose={() => setSelectorAbierto(false)}
            onAgregar={onAgregarDesdeSelector}
            moneda={usuario.moneda ?? "CLP"}
            categoriaEquipoDestacar={equipoSeleccionadoOS?.categoria}
            avisaDescuentoStock
          />

          {error && <Aviso tono="error">{error}</Aviso>}
          <div>
            <Button tipo="submit" deshabilitado={guardando}>
              {guardando ? "Creando…" : "Crear y enviar OS"}
            </Button>
          </div>
        </form>
      )}
    </DashboardShell>
  );
}

// useSearchParams() necesita un boundary de Suspense para el build de
// producción (si no, Next aborta con "missing-suspense-with-csr-bailout").
export default function NuevaOrdenServicioPage() {
  return (
    <Suspense fallback={null}>
      <NuevaOrdenServicioContenido />
    </Suspense>
  );
}
