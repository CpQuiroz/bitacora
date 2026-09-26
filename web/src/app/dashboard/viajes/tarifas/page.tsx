"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { CIUDADES_CHILE, ROLES_SUPERVISION, type Cliente, type TarifaKm, type TarifaTramo } from "@bitacora/shared";
import { supabase } from "@/lib/supabase";
import { apiFetch } from "@/lib/api";
import { formatMoneda } from "@/lib/formatMoneda";
import { DashboardShell, type UsuarioShell } from "@/components/DashboardShell";
import { Button, Card, ErrorState, LoadingState, StatusBadge, Table } from "@bitacora/ui/web";
import { InputMonto } from "@/components/InputMonto";
import { Combobox } from "@/components/Combobox";
import { ComboboxCliente } from "@/components/ComboboxCliente";

// Viajes › Tarifas (tarea 135): precio por tramo (vale en ambos sentidos) y
// precio por km, generales o por cliente. Solo Admin y Supervisor (el
// backend lo exige); con esto el viaje propone su monto por tramos o km.
type ConCliente<T> = T & { cliente: Pick<Cliente, "id" | "nombre"> | null };

export default function TarifasViajesPage() {
  const router = useRouter();
  const [usuario, setUsuario] = useState<UsuarioShell | null>(null);
  const [tramos, setTramos] = useState<ConCliente<TarifaTramo>[] | null>(null);
  const [km, setKm] = useState<ConCliente<TarifaKm>[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  const [origen, setOrigen] = useState("");
  const [destino, setDestino] = useState("");
  const [clienteTramo, setClienteTramo] = useState("");
  const [precioTramo, setPrecioTramo] = useState("");
  const [errorTramo, setErrorTramo] = useState<string | null>(null);
  const [guardandoTramo, setGuardandoTramo] = useState(false);
  const [ciudadesLibres, setCiudadesLibres] = useState<string[]>([]);

  const [precioKmGeneral, setPrecioKmGeneral] = useState("");
  const [clienteKm, setClienteKm] = useState("");
  const [precioKmCliente, setPrecioKmCliente] = useState("");
  const [errorKm, setErrorKm] = useState<string | null>(null);

  const opcionesCiudad = useMemo(() => [...CIUDADES_CHILE, ...ciudadesLibres].map((c) => ({ id: c, label: c })), [ciudadesLibres]);
  const kmGeneral = km.find((t) => t.cliente_id === null) ?? null;
  const kmPorCliente = km.filter((t) => t.cliente_id !== null);

  async function cargarTarifas() {
    const res = await apiFetch("/api/viajes/tarifas");
    const body = await res.json().catch(() => null);
    if (!res.ok) {
      setError(body?.error ?? "No se pudieron cargar las tarifas");
      setTramos([]);
      return;
    }
    setTramos(body.tramos);
    setKm(body.km);
    const general = (body.km as TarifaKm[]).find((t) => t.cliente_id === null);
    setPrecioKmGeneral(general ? String(Number(general.precio_km)) : "");
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
        const { usuario: u } = await resMe.json();
        if (u) {
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
        }
      }
      if (resClientes.ok) setClientes(await resClientes.json());
      await cargarTarifas();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function usarCiudadLibre(texto: string, set: (v: string) => void) {
    if (texto && !CIUDADES_CHILE.includes(texto)) setCiudadesLibres((prev) => (prev.includes(texto) ? prev : [...prev, texto]));
    set(texto);
  }

  async function agregarTramo(e: FormEvent) {
    e.preventDefault();
    setErrorTramo(null);
    setAviso(null);
    if (!origen || !destino) return setErrorTramo("Indica origen y destino");
    if (!precioTramo) return setErrorTramo("Indica el precio del tramo");
    setGuardandoTramo(true);
    const res = await apiFetch("/api/viajes/tarifas/tramos", {
      method: "POST",
      body: JSON.stringify({ origen, destino, precio: precioTramo, cliente_id: clienteTramo || null }),
    });
    setGuardandoTramo(false);
    const body = await res.json().catch(() => ({}));
    if (!res.ok) return setErrorTramo(body.error ?? "No se pudo guardar el tramo");
    setOrigen("");
    setDestino("");
    setPrecioTramo("");
    setAviso(`Tramo ${body.origen} ↔ ${body.destino} guardado.`);
    await cargarTarifas();
  }

  async function cambiarTramo(t: TarifaTramo, cambios: { precio?: string; activo?: boolean }) {
    setError(null);
    const res = await apiFetch(`/api/viajes/tarifas/tramos/${t.id}`, { method: "PATCH", body: JSON.stringify(cambios) });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "No se pudo actualizar el tramo");
    }
    await cargarTarifas();
  }

  function editarPrecioTramo(t: TarifaTramo) {
    const nuevo = window.prompt(`Nuevo precio para ${t.origen} ↔ ${t.destino}`, String(Math.round(Number(t.precio))));
    if (nuevo) void cambiarTramo(t, { precio: nuevo.replace(/[^\d,]/g, "").replace(",", ".") });
  }

  async function eliminarTramo(t: TarifaTramo) {
    if (!window.confirm(`¿Eliminar la tarifa ${t.origen} ↔ ${t.destino}? Los viajes ya calculados no cambian.`)) return;
    const res = await apiFetch(`/api/viajes/tarifas/tramos/${t.id}`, { method: "DELETE" });
    if (!res.ok) setError("No se pudo eliminar el tramo");
    await cargarTarifas();
  }

  async function guardarKm(clienteId: string | null, precio: string) {
    setErrorKm(null);
    setAviso(null);
    if (!precio) return setErrorKm("Indica el precio por km");
    const res = await apiFetch("/api/viajes/tarifas/km", { method: "PUT", body: JSON.stringify({ cliente_id: clienteId, precio_km: precio }) });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) return setErrorKm(body.error ?? "No se pudo guardar el precio por km");
    setAviso("Precio por km guardado.");
    if (clienteId) {
      setClienteKm("");
      setPrecioKmCliente("");
    }
    await cargarTarifas();
  }

  async function eliminarKm(t: TarifaKm) {
    if (!window.confirm("¿Quitar este precio por km? Los viajes ya calculados no cambian.")) return;
    const res = await apiFetch(`/api/viajes/tarifas/km/${t.id}`, { method: "DELETE" });
    if (!res.ok) setErrorKm("No se pudo eliminar");
    await cargarTarifas();
  }

  if (!usuario) return null;
  const puede = ROLES_SUPERVISION.includes(usuario.rol);

  return (
    <DashboardShell usuario={usuario}>
      <div className="mb-ds-6">
        <p className="ds-heading text-ds-h2 text-ds-text">Tarifas</p>
        <p className="mt-ds-1 font-ds-body text-ds-small text-ds-text/70">
          Precios netos (sin IVA) para que el viaje proponga su monto por tramos o por km. Solo los ven el administrador y el supervisor.
        </p>
      </div>
      {!puede ? (
        <ErrorState titulo="Sin acceso" mensaje="Las tarifas solo las ven el administrador y el supervisor." />
      ) : tramos === null ? (
        <LoadingState />
      ) : (
        <div className="flex flex-col gap-ds-6">
          {aviso ? <p className="font-ds-body text-ds-small text-ds-text/70">{aviso}</p> : null}
          {error ? <p className="font-ds-body text-ds-small text-ds-accent-700">{error}</p> : null}

          <Card>
            <p className="mb-ds-1 font-ds-body text-ds-body font-semibold text-ds-text">Precio por tramo</p>
            <p className="mb-ds-4 font-ds-body text-ds-caption text-ds-text-secondary">
              Un tramo vale lo mismo en ambos sentidos (Santiago → Temuco = Temuco → Santiago). La tarifa de un cliente gana sobre la general.
            </p>
            <form onSubmit={agregarTramo} className="grid gap-ds-3 sm:grid-cols-2 lg:grid-cols-5 lg:items-end">
              <div className="flex flex-col gap-ds-1">
                <label className="font-ds-body text-ds-caption font-medium text-ds-text/70">Origen</label>
                <Combobox value={origen} onChange={setOrigen} opciones={opcionesCiudad} placeholder="Ciudad" etiquetaCrear={(t) => `Usar "${t}"`} onCrear={(t) => usarCiudadLibre(t, setOrigen)} />
              </div>
              <div className="flex flex-col gap-ds-1">
                <label className="font-ds-body text-ds-caption font-medium text-ds-text/70">Destino</label>
                <Combobox value={destino} onChange={setDestino} opciones={opcionesCiudad} placeholder="Ciudad" etiquetaCrear={(t) => `Usar "${t}"`} onCrear={(t) => usarCiudadLibre(t, setDestino)} />
              </div>
              <div className="flex flex-col gap-ds-1">
                <label className="font-ds-body text-ds-caption font-medium text-ds-text/70">Cliente (opcional)</label>
                <ComboboxCliente value={clienteTramo} onChange={setClienteTramo} clientes={clientes} onClienteCreado={(c) => setClientes((p) => [...p, c])} opcionVacia="General (todos)" placeholder="General (todos)" />
              </div>
              <div className="flex flex-col gap-ds-1">
                <label className="font-ds-body text-ds-caption font-medium text-ds-text/70">Precio del tramo</label>
                <InputMonto value={precioTramo} onChange={setPrecioTramo} moneda={usuario.moneda} />
              </div>
              <Button tipo="submit" cargando={guardandoTramo}>
                Agregar tramo
              </Button>
            </form>
            {errorTramo ? <p className="mt-ds-2 font-ds-body text-ds-small text-ds-accent-700">{errorTramo}</p> : null}
            <div className="mt-ds-4">
              <Table<ConCliente<TarifaTramo>>
                filas={tramos}
                claveFila={(t) => t.id}
                vacio={{ titulo: "Sin tramos todavía", mensaje: "Agrega el primero arriba (por ejemplo Santiago ↔ Concepción)." }}
                // Convención (tarea 149): la fila edita el precio; el resto en el menú ⋯.
                onFilaClick={(t) => editarPrecioTramo(t)}
                accionesEnMenu
                acciones={[
                  { etiqueta: "Cambiar precio", onPress: (t) => editarPrecioTramo(t) },
                  { etiqueta: (t) => (t.activo ? "Desactivar" : "Activar"), onPress: (t) => void cambiarTramo(t, { activo: !t.activo }), tono: "muted" },
                  { etiqueta: "Eliminar", onPress: (t) => void eliminarTramo(t), tono: "peligro" },
                ]}
                columnas={[
                  { encabezado: "Tramo", celda: (t) => `${t.origen} ↔ ${t.destino}` },
                  { encabezado: "Cliente", celda: (t) => t.cliente?.nombre ?? "General" },
                  { encabezado: "Precio", clase: "text-right tabular-nums", celda: (t) => formatMoneda(Number(t.precio), usuario.moneda) },
                  { encabezado: "Estado", celda: (t) => <StatusBadge estado={t.activo ? "activo" : "inactivo"} /> },
                ]}
              />
            </div>
          </Card>

          <Card>
            <p className="mb-ds-1 font-ds-body text-ds-body font-semibold text-ds-text">Precio por km</p>
            <p className="mb-ds-4 font-ds-body text-ds-caption text-ds-text-secondary">
              Los km del viaje se calculan con el mapa entre origen y destino (o se ingresan a mano). Un precio por cliente gana sobre el general.
            </p>
            <div className="flex flex-wrap items-end gap-ds-3">
              <div className="flex w-56 flex-col gap-ds-1">
                <label className="font-ds-body text-ds-caption font-medium text-ds-text/70">Precio general por km</label>
                <InputMonto value={precioKmGeneral} onChange={setPrecioKmGeneral} moneda={usuario.moneda} />
              </div>
              <Button variante="secundario" onPress={() => void guardarKm(null, precioKmGeneral)}>
                {kmGeneral ? "Actualizar" : "Guardar"}
              </Button>
            </div>
            <div className="mt-ds-5 flex flex-wrap items-end gap-ds-3">
              <div className="flex min-w-[220px] flex-col gap-ds-1">
                <label className="font-ds-body text-ds-caption font-medium text-ds-text/70">Cliente</label>
                <ComboboxCliente value={clienteKm} onChange={setClienteKm} clientes={clientes} onClienteCreado={(c) => setClientes((p) => [...p, c])} placeholder="Elegir cliente" />
              </div>
              <div className="flex w-56 flex-col gap-ds-1">
                <label className="font-ds-body text-ds-caption font-medium text-ds-text/70">Precio por km del cliente</label>
                <InputMonto value={precioKmCliente} onChange={setPrecioKmCliente} moneda={usuario.moneda} />
              </div>
              <Button variante="secundario" onPress={() => (clienteKm ? void guardarKm(clienteKm, precioKmCliente) : setErrorKm("Elige un cliente"))}>
                Guardar para el cliente
              </Button>
            </div>
            {errorKm ? <p className="mt-ds-2 font-ds-body text-ds-small text-ds-accent-700">{errorKm}</p> : null}
            {kmPorCliente.length > 0 ? (
              <ul className="mt-ds-4 flex flex-col gap-ds-2">
                {kmPorCliente.map((t) => (
                  <li key={t.id} className="flex items-center justify-between gap-ds-3 font-ds-body text-ds-small text-ds-text">
                    <span>
                      {t.cliente?.nombre ?? "Cliente"} · <span className="tabular-nums">{formatMoneda(Number(t.precio_km), usuario.moneda)}</span> por km
                    </span>
                    <button type="button" onClick={() => void eliminarKm(t)} className="font-ds-body text-ds-caption font-medium text-ds-accent-700 hover:underline">
                      Quitar
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </Card>
        </div>
      )}
    </DashboardShell>
  );
}
