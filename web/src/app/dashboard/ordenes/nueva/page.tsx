"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import type { Cliente, Prioridad, TipoOS, TipoTrabajo, Usuario } from "@bitacora/shared";
import { supabase } from "@/lib/supabase";
import { apiFetch } from "@/lib/api";
import { DashboardShell, type UsuarioShell } from "@/components/DashboardShell";
import {
  Button,
  Card,
  ErrorText,
  Input,
  Label,
  PageHeader,
  Select,
  SuccessText,
  Textarea,
} from "@/components/ui";
import { IconClipboardCheck, IconPlus } from "@/components/icons";
import { MapaRutas, type Parada } from "@/components/MapaRutas";

type ItemOS = { descripcion: string; cantidad: string; precio_unitario: string };

const PRIORIDADES: Prioridad[] = ["alta", "media", "baja"];
const ITEM_VACIO: ItemOS = { descripcion: "", cantidad: "1", precio_unitario: "0" };

export default function NuevaOrdenServicioPage() {
  const router = useRouter();
  const [usuario, setUsuario] = useState<UsuarioShell | null>(null);
  const [equipo, setEquipo] = useState<Usuario[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [tiposTrabajo, setTiposTrabajo] = useState<TipoTrabajo[]>([]);
  const [tiposOs, setTiposOs] = useState<TipoOS[]>([]);

  const [clienteId, setClienteId] = useState("");
  const [nuevoClienteModo, setNuevoClienteModo] = useState(false);
  const [nuevoClienteNombre, setNuevoClienteNombre] = useState("");
  const [nuevoClienteDireccion, setNuevoClienteDireccion] = useState("");
  const [responsableId, setResponsableId] = useState("");
  const [tipoTrabajoId, setTipoTrabajoId] = useState("");
  const [tipoOsId, setTipoOsId] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [fecha, setFecha] = useState(() => new Date().toISOString().slice(0, 10));
  const [horaProgramada, setHoraProgramada] = useState("");
  const [prioridad, setPrioridad] = useState<Prioridad>("media");
  const [items, setItems] = useState<ItemOS[]>([{ ...ITEM_VACIO }]);

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
      const [resMe, resEquipo, resClientes, resTipos, resTiposOs] = await Promise.all([
        apiFetch("/api/me"),
        apiFetch("/api/usuarios"),
        apiFetch("/api/clientes"),
        apiFetch("/api/tipos-trabajo"),
        apiFetch("/api/tipos-os"),
      ]);
      if (resMe.ok) {
        const { usuario: u } = await resMe.json();
        if (u) setUsuario({ nombre: u.nombre, rol: u.rol, empresaNombre: u.empresa?.nombre ?? "", empresaLogoUrl: u.empresa?.logo_url ?? null, colorPrimario: u.empresa?.color_primario ?? null, colorPrimarioForeground: u.empresa?.color_primario_foreground ?? null, colorSecundario: u.empresa?.color_secundario ?? null, fuente: u.empresa?.fuente ?? null, moneda: u.empresa?.moneda ?? "CLP" });
      }
      if (resEquipo.ok) {
        const lista: Usuario[] = await resEquipo.json();
        setEquipo(lista);
        if (lista.length > 0) setResponsableId(lista[0].id);
      }
      if (resClientes.ok) setClientes(await resClientes.json());
      if (resTipos.ok) setTiposTrabajo(await resTipos.json());
      if (resTiposOs.ok) {
        const lista: TipoOS[] = await resTiposOs.json();
        setTiposOs(lista.filter((t) => t.activo));
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onCrearCliente() {
    if (!nuevoClienteNombre.trim() || !nuevoClienteDireccion.trim()) return;
    const res = await apiFetch("/api/clientes", {
      method: "POST",
      body: JSON.stringify({ nombre: nuevoClienteNombre, direccion: nuevoClienteDireccion }),
    });
    if (!res.ok) return;
    const nuevo = await res.json();
    setClientes((prev) => [...prev, nuevo]);
    setClienteId(nuevo.id);
    setNuevoClienteModo(false);
    setNuevoClienteNombre("");
    setNuevoClienteDireccion("");
  }

  function actualizarItem(i: number, campo: keyof ItemOS, valor: string) {
    setItems((prev) => prev.map((it, idx) => (idx === i ? { ...it, [campo]: valor } : it)));
  }
  function agregarItem() {
    setItems((prev) => [...prev, { ...ITEM_VACIO }]);
  }
  function quitarItem(i: number) {
    setItems((prev) => prev.filter((_, idx) => idx !== i));
  }

  const clienteSeleccionado = clientes.find((c) => c.id === clienteId);
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
        responsable_id: responsableId,
        tipo_trabajo_id: tipoTrabajoId || undefined,
        tipo_os_id: tipoOsId || undefined,
        descripcion: descripcion.trim(),
        fecha,
        hora_programada: horaProgramada || undefined,
        ubicacion: clienteSeleccionado?.direccion,
        prioridad,
        monto: totalItems,
        estado: "en_curso",
        items: itemsValidos.length > 0 ? JSON.stringify(
          itemsValidos.map((it) => ({
            descripcion: it.descripcion.trim(),
            cantidad: Number(it.cantidad || 0),
            precio_unitario: Number(it.precio_unitario || 0),
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
    setCreada({ folio: nueva.folio ?? null });
  }

  if (!usuario) return null;

  const paradaPreview: Parada[] =
    clienteSeleccionado && clienteSeleccionado.lat != null && clienteSeleccionado.lng != null
      ? [
          {
            trabajo_id: "preview",
            cliente_nombre: clienteSeleccionado.nombre,
            direccion: clienteSeleccionado.direccion,
            lat: clienteSeleccionado.lat,
            lng: clienteSeleccionado.lng,
          },
        ]
      : [];

  return (
    <DashboardShell usuario={usuario}>
      <PageHeader
        title="Nueva Orden de Servicio"
        subtitle="Se envía al celular del colaborador asignado apenas la guardas"
      />

      {creada ? (
        <Card className="my-6">
          <div className="flex flex-col items-center gap-3 py-8 text-center">
            <IconClipboardCheck className="h-10 w-10 text-brand" />
            <SuccessText>
              {creada.folio != null
                ? `OS N° ${creada.folio} creada y enviada al celular del colaborador.`
                : "Orden de servicio creada."}
            </SuccessText>
            <div className="flex gap-2">
              <Button type="button" onClick={() => router.push("/dashboard/ordenes")}>
                Ver todas las OS
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setCreada(null);
                  setDescripcion("");
                  setItems([{ ...ITEM_VACIO }]);
                }}
              >
                Crear otra
              </Button>
            </div>
          </div>
        </Card>
      ) : (
        <form onSubmit={onSubmit} className="my-6 flex flex-col gap-6">
          <Card>
            <h2 className="mb-4 text-sm font-semibold text-foreground">Cliente y colaborador</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Label>Cliente</Label>
                {!nuevoClienteModo ? (
                  <div className="flex gap-2">
                    <Select value={clienteId} onChange={(e) => setClienteId(e.target.value)} className="flex-1">
                      <option value="">Selecciona un cliente</option>
                      {clientes.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.nombre}
                        </option>
                      ))}
                    </Select>
                    <Button type="button" variant="outline" onClick={() => setNuevoClienteModo(true)}>
                      + Nuevo
                    </Button>
                  </div>
                ) : (
                  <div className="flex flex-col gap-2 rounded-lg border border-border p-3">
                    <Input
                      type="text"
                      placeholder="Nombre del cliente"
                      value={nuevoClienteNombre}
                      onChange={(e) => setNuevoClienteNombre(e.target.value)}
                    />
                    <Input
                      type="text"
                      placeholder="Dirección"
                      value={nuevoClienteDireccion}
                      onChange={(e) => setNuevoClienteDireccion(e.target.value)}
                    />
                    <div className="flex gap-2">
                      <Button type="button" onClick={onCrearCliente}>
                        Guardar cliente
                      </Button>
                      <Button type="button" variant="outline" onClick={() => setNuevoClienteModo(false)}>
                        Cancelar
                      </Button>
                    </div>
                  </div>
                )}
                {clienteSeleccionado && (
                  <p className="mt-1.5 text-xs text-muted">{clienteSeleccionado.direccion}</p>
                )}
              </div>
              <div>
                <Label>Colaborador</Label>
                <Select value={responsableId} onChange={(e) => setResponsableId(e.target.value)} required>
                  {equipo.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.nombre}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Label>Tipo de servicio</Label>
                <Select value={tipoTrabajoId} onChange={(e) => setTipoTrabajoId(e.target.value)}>
                  <option value="">Sin tipo específico</option>
                  {tiposTrabajo.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.nombre}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Label>Tipo de OS (opcional)</Label>
                <Select value={tipoOsId} onChange={(e) => setTipoOsId(e.target.value)}>
                  <option value="">Sin clasificar</option>
                  {tiposOs.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.nombre}
                    </option>
                  ))}
                </Select>
              </div>
            </div>

            {paradaPreview.length > 0 && (
              <div className="mt-4">
                <MapaRutas paradas={paradaPreview} />
              </div>
            )}
          </Card>

          <Card>
            <h2 className="mb-4 text-sm font-semibold text-foreground">Detalle del servicio</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Label>Descripción</Label>
                <Textarea rows={3} required value={descripcion} onChange={(e) => setDescripcion(e.target.value)} />
              </div>
              <div>
                <Label>Fecha</Label>
                <Input type="date" required value={fecha} onChange={(e) => setFecha(e.target.value)} />
              </div>
              <div>
                <Label>Hora programada (opcional)</Label>
                <Input type="time" value={horaProgramada} onChange={(e) => setHoraProgramada(e.target.value)} />
              </div>
              <div>
                <Label>Prioridad</Label>
                <Select value={prioridad} onChange={(e) => setPrioridad(e.target.value as Prioridad)}>
                  {PRIORIDADES.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </Select>
              </div>
            </div>
          </Card>

          <Card>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-foreground">Ítems / materiales</h2>
              <Button type="button" variant="outline" onClick={agregarItem}>
                <IconPlus className="h-4 w-4" />
                Agregar ítem
              </Button>
            </div>
            <div className="flex flex-col gap-3">
              {items.map((it, i) => (
                <div key={i} className="grid grid-cols-[1fr_5rem_7rem_auto] items-end gap-2">
                  <div>
                    {i === 0 && <Label>Descripción</Label>}
                    <Input
                      type="text"
                      placeholder="Ej: Mano de obra, repuesto…"
                      value={it.descripcion}
                      onChange={(e) => actualizarItem(i, "descripcion", e.target.value)}
                    />
                  </div>
                  <div>
                    {i === 0 && <Label>Cant.</Label>}
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={it.cantidad}
                      onChange={(e) => actualizarItem(i, "cantidad", e.target.value)}
                    />
                  </div>
                  <div>
                    {i === 0 && <Label>P. unitario</Label>}
                    <Input
                      type="number"
                      min="0"
                      step="1"
                      value={it.precio_unitario}
                      onChange={(e) => actualizarItem(i, "precio_unitario", e.target.value)}
                    />
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => quitarItem(i)}
                    disabled={items.length === 1}
                  >
                    Quitar
                  </Button>
                </div>
              ))}
            </div>
            <p className="mt-4 text-right text-sm font-semibold text-foreground">
              Total: ${totalItems.toLocaleString("es-CL")}
            </p>
          </Card>

          {error && <ErrorText>{error}</ErrorText>}
          <Button type="submit" disabled={guardando} className="self-start">
            {guardando ? "Creando…" : "Crear y enviar OS"}
          </Button>
        </form>
      )}
    </DashboardShell>
  );
}
