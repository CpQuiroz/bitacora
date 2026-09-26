"use client";

import { Fragment, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Plus, Truck } from "lucide-react";
import { CIUDADES_CHILE, ROLES_SUPERVISION, formatearFolio, type Cliente, type ConfigViaticos, type EstadoViaje, type ModoPrecioViaje, type TipoViatico, type Usuario, type Viaje } from "@bitacora/shared";
import { supabase } from "@/lib/supabase";
import { apiFetch } from "@/lib/api";
import { formatMoneda } from "@/lib/formatMoneda";
import { DashboardShell, type UsuarioShell } from "@/components/DashboardShell";
import { Button, Card, DatePicker, EmptyState, ErrorState, Input, LoadingState, Select, StatusBadge } from "@bitacora/ui/web";
import { InputMonto } from "@/components/InputMonto";
import { Modal } from "@/components/Modal";
import { ComboboxCliente } from "@/components/ComboboxCliente";
import { ComboboxResponsable } from "@/components/ComboboxResponsable";
import { Combobox } from "@/components/Combobox";
import { CampoViatico } from "@/components/CampoViatico";
import { PrecioViaje } from "@/components/PrecioViaje";

type ViajeConDatos = Viaje & {
  cliente_info: Pick<Cliente, "id" | "nombre"> | null;
  chofer: Pick<Usuario, "id" | "nombre"> | null;
};

type Resumen = {
  clave: string;
  cantidad_viajes: number;
  subtotal: number;
  iva: number;
  total: number;
  km_total: number;
};

const HOY = () => new Date().toISOString().slice(0, 10);

function km(v: Viaje) {
  if (v.km_inicial == null || v.km_final == null) return null;
  return Math.max(0, v.km_final - v.km_inicial);
}

// Forma de cobro que se manda al guardar (tarea 135). El servidor arma el
// detalle con las tarifas; el monto final es el del campo "Monto del viaje".
function cuerpoPrecio(modo: ModoPrecioViaje, origen: string, paradas: string[], destino: string, km: string) {
  if (modo === "tramos") return { modo_precio: modo, paradas: [origen, ...paradas, destino].filter((p) => p.trim()) };
  if (modo === "km") return { modo_precio: modo, distancia_km: km };
  return { modo_precio: "fijo" as const };
}

// PASO 6 (sistema de diseño) — migrado. Ver docs/design-system.md.
// La tabla de viajes tiene una fila de edición inline expandible (2do
// <tr> con un form completo, ver editId) — el primitivo <Table> no
// soporta filas expandibles, así que sigue siendo un <table> a mano,
// con las mismas clases que usa <Table> internamente.
export default function ViajesPage() {
  const router = useRouter();
  const [usuario, setUsuario] = useState<UsuarioShell | null>(null);
  const [viajes, setViajes] = useState<ViajeConDatos[] | null>(null);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [choferes, setChoferes] = useState<Usuario[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [agrupacion, setAgrupacion] = useState<"semana" | "mes">("semana");
  const [resumen, setResumen] = useState<Resumen[] | null>(null);

  const [filtroEstado, setFiltroEstado] = useState<"todos" | EstadoViaje>("todos");
  const [seleccionados, setSeleccionados] = useState<Set<string>>(new Set());
  const [aprobAuto, setAprobAuto] = useState(false);

  const [formAbierto, setFormAbierto] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [fecha, setFecha] = useState(() => HOY());
  const [numeroGuia, setNumeroGuia] = useState("");
  const [clienteId, setClienteId] = useState("");
  const [choferId, setChoferId] = useState("");
  const [hora, setHora] = useState("");
  const [origen, setOrigen] = useState("");
  const [destino, setDestino] = useState("");
  // Ciudades escritas a mano (no están en CIUDADES_CHILE) — se agregan
  // a las opciones para que el Combobox pueda mostrarlas seleccionadas
  // (a diferencia de PickerBuscable en mobile, Combobox no tiene un
  // fallback propio para "mostrar el texto aunque no matchee ningún
  // id" — mismo criterio que ComboboxCliente usa para el cliente recién
  // creado). Compartida entre alta y edición: una ciudad libre elegida
  // en cualquiera de los dos lados queda disponible en el otro.
  const [ciudadesLibres, setCiudadesLibres] = useState<string[]>([]);
  const opcionesCiudad = useMemo(
    () => [...CIUDADES_CHILE, ...ciudadesLibres].map((c) => ({ id: c, label: c })),
    [ciudadesLibres]
  );
  function agregarCiudadLibre(texto: string) {
    if (!texto || CIUDADES_CHILE.includes(texto)) return;
    setCiudadesLibres((prev) => (prev.includes(texto) ? prev : [...prev, texto]));
  }
  const [kmInicial, setKmInicial] = useState("");
  const [kmFinal, setKmFinal] = useState("");
  const [subtotal, setSubtotal] = useState("");
  const [aplicaIva, setAplicaIva] = useState(true);
  const [comentarios, setComentarios] = useState("");
  // Viático del chofer (tarea 137): solo Admin/Supervisor.
  const [configViaticos, setConfigViaticos] = useState<ConfigViaticos | null>(null);
  const [viaticoTipo, setViaticoTipo] = useState<TipoViatico | "">("");
  const [viaticoMonto, setViaticoMonto] = useState("");
  // Forma de cobro (tarea 135): fijo, por tramos o por km.
  const [modoPrecio, setModoPrecio] = useState<ModoPrecioViaje>("fijo");
  const [paradas, setParadas] = useState<string[]>([]);
  const [distanciaKm, setDistanciaKm] = useState("");

  const [fotosViaje, setFotosViaje] = useState<{
    id: string;
    guiaUrl: string | null;
    fotos: { id: string; url: string }[];
    cargando: boolean;
    subiendo: boolean;
    error: string | null;
  } | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  // Historial de cambios de monto del viaje (tarea 132).
  const [historialMonto, setHistorialMonto] = useState<{
    guia: string;
    cargando: boolean;
    error: string | null;
    filas: { id: string; creado_en: string; usuario: { nombre: string } | null; detalle: { anterior?: { total: number }; nuevo?: { total: number } } }[];
  } | null>(null);
  const [editError, setEditError] = useState<string | null>(null);
  const [confirmando, setConfirmando] = useState(false);
  const [editNumeroGuia, setEditNumeroGuia] = useState("");
  const [editOrigen, setEditOrigen] = useState("");
  const [editDestino, setEditDestino] = useState("");
  const [editClienteId, setEditClienteId] = useState("");
  const [editChoferId, setEditChoferId] = useState("");
  const [editHora, setEditHora] = useState("");
  const [editKmInicial, setEditKmInicial] = useState("");
  const [editKmFinal, setEditKmFinal] = useState("");
  const [editSubtotal, setEditSubtotal] = useState("");
  const [editAplicaIva, setEditAplicaIva] = useState(true);
  const [editComentarios, setEditComentarios] = useState("");
  const [editViaticoTipo, setEditViaticoTipo] = useState<TipoViatico | "">("");
  const [editViaticoMonto, setEditViaticoMonto] = useState("");
  const [editModoPrecio, setEditModoPrecio] = useState<ModoPrecioViaje>("fijo");
  const [editParadas, setEditParadas] = useState<string[]>([]);
  const [editDistanciaKm, setEditDistanciaKm] = useState("");
  const puedeViatico = ROLES_SUPERVISION.includes(usuario?.rol ?? "");

  async function cargarViajes() {
    const res = await apiFetch(`/api/viajes${filtroEstado !== "todos" ? `?estado=${filtroEstado}` : ""}`);
    if (!res.ok) {
      setError("No se pudieron cargar los viajes");
      return;
    }
    setViajes(await res.json());
  }

  async function cargarResumen(agr: "semana" | "mes") {
    const res = await apiFetch(`/api/viajes/resumen?agrupar=${agr}`);
    if (res.ok) setResumen(await res.json());
  }

  async function cargar() {
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      router.replace("/login");
      return;
    }
    const [resMe, resClientes, resUsuarios, resConfig] = await Promise.all([
      apiFetch("/api/me"),
      apiFetch("/api/clientes"),
      apiFetch("/api/usuarios"),
      apiFetch("/api/viajes/config"),
    ]);
    if (resConfig.ok) setConfigViaticos(await resConfig.json());
    if (resMe.ok) {
      const { usuario: u } = await resMe.json();
      if (u) {
        setAprobAuto(Boolean(u.empresa?.viajes_aprobacion_automatica));
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
    if (resUsuarios.ok) {
      const todos: Usuario[] = await resUsuarios.json();
      // Tarea 133: solo usuarios activos con la función Chofer (el backend
      // valida lo mismo). Incluye a un admin que además maneja.
      setChoferes(todos.filter((u) => u.funcion === "chofer" && u.activo));
    }
    await Promise.all([cargarViajes(), cargarResumen(agrupacion)]);
  }

  async function cambiarAprobAuto(next: boolean) {
    setAprobAuto(next);
    setAviso(null);
    const res = await apiFetch("/api/empresa", {
      method: "PATCH",
      body: JSON.stringify({ viajes_aprobacion_automatica: next }),
    });
    if (res.ok) {
      setAviso(
        next
          ? "Listo. Los viajes que registren los choferes quedarán confirmados automáticamente."
          : "Listo. Los viajes de los choferes volverán a entrar como borrador para que los revises."
      );
    } else {
      setAprobAuto(!next);
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "No se pudo guardar el ajuste");
    }
  }

  useEffect(() => {
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    cargarViajes();
    setSeleccionados(new Set());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtroEstado]);

  // Enlace directo ?editar=<id> (tarea 148: desde la pestaña Viajes de la
  // ficha de un equipo). Se abre una sola vez, cuando ya cargaron los viajes.
  const deepLinkUsado = useRef(false);
  useEffect(() => {
    if (deepLinkUsado.current || !viajes || !usuario) return;
    deepLinkUsado.current = true;
    const id = new URLSearchParams(window.location.search).get("editar");
    const v = id ? viajes.find((x) => x.id === id) : undefined;
    if (v) {
      // Un viaje facturado no se edita (el backend responde 409): se avisa y
      // se muestra la fila, igual que la lista, que no ofrece "Editar".
      if (v.estado === "facturado") setAviso(`El viaje guía ${v.numero_guia} ya está facturado: no se puede editar.`);
      else abrirEdicion(v);
      setTimeout(() => document.getElementById(`viaje-${v.id}`)?.scrollIntoView({ block: "center", behavior: "smooth" }), 100);
    }
    if (id) router.replace("/dashboard/viajes");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viajes, usuario]);

  useEffect(() => {
    cargarResumen(agrupacion);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agrupacion]);

  function abrirNuevo() {
    setFecha(HOY());
    setNumeroGuia("");
    setClienteId("");
    setChoferId("");
    setHora("");
    setOrigen("");
    setDestino("");
    setKmInicial("");
    setKmFinal("");
    setSubtotal("");
    setAplicaIva(true);
    setComentarios("");
    setViaticoTipo("");
    setViaticoMonto("");
    setModoPrecio("fijo");
    setParadas([]);
    setDistanciaKm("");
    setFormError(null);
    setFormAbierto(true);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    setAviso(null);
    if (!clienteId) {
      setFormError("Selecciona un cliente");
      return;
    }
    if (viaticoTipo && !choferId) {
      setFormError("Asigna un chofer: el viático es del chofer del viaje");
      return;
    }
    setGuardando(true);
    const res = await apiFetch("/api/viajes", {
      method: "POST",
      body: JSON.stringify({
        fecha,
        numero_guia: numeroGuia,
        cliente_id: clienteId,
        chofer_id: choferId || undefined,
        hora: hora || undefined,
        origen,
        destino,
        km_inicial: kmInicial || undefined,
        km_final: kmFinal || undefined,
        subtotal,
        aplica_iva: aplicaIva,
        comentarios,
        ...(viaticoTipo ? { viatico_tipo: viaticoTipo, viatico_monto: viaticoMonto } : {}),
        ...(puedeViatico ? cuerpoPrecio(modoPrecio, origen, paradas, destino, distanciaKm) : {}),
      }),
    });
    setGuardando(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setFormError(body.error ?? "No se pudo crear el viaje");
      return;
    }
    setAviso("Viaje creado.");
    setFormAbierto(false);
    cargar();
  }

  function abrirEdicion(v: ViajeConDatos) {
    setEditId(v.id);
    setEditError(null);
    setEditNumeroGuia(v.numero_guia);
    setEditOrigen(v.origen);
    setEditDestino(v.destino);
    // Si el viaje ya tenía una ciudad libre (no está en CIUDADES_CHILE
    // ni se agregó antes en esta sesión), hay que sumarla para que el
    // Combobox la muestre seleccionada en vez de vacía.
    agregarCiudadLibre(v.origen);
    agregarCiudadLibre(v.destino);
    setEditClienteId(v.cliente_id ?? "");
    setEditChoferId(v.chofer_id ?? "");
    setEditHora(v.hora ? v.hora.slice(0, 5) : "");
    setEditKmInicial(v.km_inicial != null ? String(v.km_inicial) : "");
    setEditKmFinal(v.km_final != null ? String(v.km_final) : "");
    setEditSubtotal(v.subtotal ? String(v.subtotal) : "");
    setEditAplicaIva(v.aplica_iva);
    setEditComentarios(v.comentarios ?? "");
    setEditModoPrecio(v.modo_precio ?? "fijo");
    // Paradas intermedias = los destinos de cada tramo menos el último.
    setEditParadas(v.tramos_detalle && v.tramos_detalle.length > 1 ? v.tramos_detalle.slice(0, -1).map((t) => t.destino) : []);
    setEditDistanciaKm(v.distancia_km != null ? String(v.distancia_km) : "");
    setEditViaticoTipo(v.viatico_tipo ?? "");
    setEditViaticoMonto(v.viatico_monto != null ? String(Math.round(Number(v.viatico_monto))) : "");
  }

  async function verHistorialMonto(v: ViajeConDatos) {
    setHistorialMonto({ guia: v.numero_guia, cargando: true, error: null, filas: [] });
    const res = await apiFetch(`/api/viajes/${v.id}/historial-monto`);
    const body = await res.json().catch(() => null);
    setHistorialMonto({
      guia: v.numero_guia,
      cargando: false,
      error: res.ok ? null : (body?.error ?? "No se pudo cargar el historial"),
      filas: res.ok && Array.isArray(body) ? body : [],
    });
  }

  async function verFotos(id: string) {
    setFotosViaje({ id, guiaUrl: null, fotos: [], cargando: true, subiendo: false, error: null });
    const guia = await apiFetch(`/api/viajes/${id}/foto`);
    const guiaUrl = guia.ok ? ((await guia.json()) as { url: string }).url : null;
    const extra = await apiFetch(`/api/viajes/${id}/fotos`);
    const fotos = extra.ok ? ((await extra.json()) as { id: string; url: string }[]) : [];
    setFotosViaje({ id, guiaUrl, fotos, cargando: false, subiendo: false, error: null });
  }

  async function subirFotoViaje(archivo: File) {
    if (!fotosViaje) return;
    setFotosViaje({ ...fotosViaje, subiendo: true, error: null });
    const formData = new FormData();
    formData.append("foto", archivo);
    const res = await apiFetch(`/api/viajes/${fotosViaje.id}/fotos`, { method: "POST", body: formData });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setFotosViaje({ ...fotosViaje, subiendo: false, error: body.error ?? "No se pudo subir la foto" });
      return;
    }
    const nueva = (await res.json()) as { id: string; url: string };
    setFotosViaje({ ...fotosViaje, subiendo: false, fotos: [...fotosViaje.fotos, nueva] });
  }

  async function eliminarFotoViaje(fotoId: string) {
    if (!fotosViaje) return;
    if (!window.confirm("¿Eliminar esta foto?")) return;
    const res = await apiFetch(`/api/viajes/${fotosViaje.id}/fotos/${fotoId}`, { method: "DELETE" });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setFotosViaje({ ...fotosViaje, error: body.error ?? "No se pudo eliminar la foto" });
      return;
    }
    setFotosViaje({ ...fotosViaje, fotos: fotosViaje.fotos.filter((f) => f.id !== fotoId) });
  }

  // confirmar: solo tiene sentido viniendo de "borrador" (los dos botones
  // de esa fila). Editar un viaje ya "confirmado" no manda `estado` — así
  // nunca lo hace retroceder ni lo vuelve a "confirmar" sin necesidad.
  async function guardarEdicion(id: string, confirmar?: boolean) {
    setEditError(null);
    if (!editNumeroGuia.trim() || !editOrigen.trim() || !editDestino.trim()) {
      setEditError("Completa número de guía, origen y destino");
      return;
    }
    if (!editClienteId) {
      setEditError("Selecciona un cliente");
      return;
    }
    const subtotalNum = Number(editSubtotal);
    if (!Number.isFinite(subtotalNum) || subtotalNum <= 0) {
      setEditError("Ingresa un monto válido");
      return;
    }
    if (editViaticoTipo && !editChoferId) {
      setEditError("Asigna un chofer: el viático es del chofer del viaje");
      return;
    }
    setConfirmando(true);
    const res = await apiFetch(`/api/viajes/${id}`, {
      method: "PATCH",
      body: JSON.stringify({
        numero_guia: editNumeroGuia.trim(),
        origen: editOrigen.trim(),
        destino: editDestino.trim(),
        cliente_id: editClienteId,
        chofer_id: editChoferId || null,
        hora: editHora || null,
        km_inicial: editKmInicial || undefined,
        km_final: editKmFinal || undefined,
        subtotal: subtotalNum,
        aplica_iva: editAplicaIva,
        comentarios: editComentarios,
        ...(puedeViatico ? { viatico_tipo: editViaticoTipo || null, viatico_monto: editViaticoTipo ? editViaticoMonto : null } : {}),
        ...(puedeViatico ? cuerpoPrecio(editModoPrecio, editOrigen, editParadas, editDestino, editDistanciaKm) : {}),
        ...(confirmar !== undefined ? { estado: confirmar ? "confirmado" : "borrador" } : {}),
      }),
    });
    setConfirmando(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setEditError(body.error ?? "No se pudo guardar");
      return;
    }
    setEditId(null);
    setAviso(confirmar === true ? "Viaje confirmado." : confirmar === false ? "Cambios guardados." : "Cambios guardados.");
    cargar();
  }

  function alternarSeleccion(id: string) {
    setSeleccionados((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function eliminar(id: string) {
    if (!window.confirm("¿Eliminar este viaje?")) return;
    const res = await apiFetch(`/api/viajes/${id}`, { method: "DELETE" });
    if (res.ok) {
      cargar();
      return;
    }
    const body = await res.json().catch(() => ({}));
    setError(body.error ?? "No se pudo eliminar el viaje");
  }

  const viajesSeleccionados = useMemo(
    () => (viajes ?? []).filter((v) => seleccionados.has(v.id)),
    [viajes, seleccionados]
  );
  const clienteIdsSeleccionados = new Set(viajesSeleccionados.map((v) => v.cliente_id));
  const puedeFacturar =
    viajesSeleccionados.length > 0 &&
    clienteIdsSeleccionados.size === 1 &&
    viajesSeleccionados.every((v) => v.estado === "confirmado");
  const totalSeleccionado = viajesSeleccionados.reduce((acc, v) => acc + v.total, 0);

  async function facturarSeleccionados() {
    setAviso(null);
    setError(null);
    const res = await apiFetch("/api/viajes/facturar", {
      method: "POST",
      body: JSON.stringify({ viaje_ids: Array.from(seleccionados) }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "No se pudo generar la factura");
      return;
    }
    // Tarea 134: al generar, se abre el cobro con el detalle por viaje y
    // el PDF.
    const cobro = await res.json().catch(() => null);
    setSeleccionados(new Set());
    if (cobro?.id) {
      router.push(`/dashboard/financiero/cobros/${cobro.id}`);
      return;
    }
    setAviso("Cobro generado a partir de los viajes seleccionados.");
    cargar();
  }

  if (!usuario) return null;

  const lista = viajes ?? [];

  return (
    <DashboardShell usuario={usuario}>
      <div className="mb-ds-6 flex flex-wrap items-center justify-between gap-ds-3">
        <div>
          <p className="ds-heading flex items-center gap-ds-2 text-ds-h2 text-ds-text">
            <Truck size={24} strokeWidth={2.75} className="text-ds-brand" />
            Viajes
          </p>
          <p className="mt-ds-1 font-ds-body text-ds-small text-ds-text/70">Guías de despacho, kilometraje y facturación</p>
        </div>
        <Button iconoIzq={<Plus size={16} strokeWidth={2.75} />} onPress={() => (formAbierto ? setFormAbierto(false) : abrirNuevo())}>
          Nuevo Viaje
        </Button>
      </div>

      <div className="mb-ds-6">
        <Card sinRelleno elevacion="sm">
          <div className="flex items-center justify-between gap-ds-3 border-b border-ds-divider px-ds-4 py-ds-3">
            <p className="font-ds-body text-ds-small font-semibold text-ds-text">Resumen</p>
            <div className="flex gap-ds-1">
              <button
                type="button"
                onClick={() => setAgrupacion("semana")}
                className={`rounded-ds-pill px-ds-3 py-1 font-ds-body text-ds-caption font-medium transition-colors ${
                  agrupacion === "semana" ? "bg-ds-brand/[0.08] text-ds-brand" : "text-ds-text/60"
                }`}
              >
                Semanal
              </button>
              <button
                type="button"
                onClick={() => setAgrupacion("mes")}
                className={`rounded-ds-pill px-ds-3 py-1 font-ds-body text-ds-caption font-medium transition-colors ${
                  agrupacion === "mes" ? "bg-ds-brand/[0.08] text-ds-brand" : "text-ds-text/60"
                }`}
              >
                Mensual
              </button>
            </div>
          </div>
          {resumen && resumen.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-ds-body">
                <thead>
                  <tr className="border-b border-ds-divider text-[11px] font-medium uppercase tracking-[0.08em] text-ds-text/60">
                    <th className="px-ds-4 py-ds-3">{agrupacion === "semana" ? "Semana de" : "Mes"}</th>
                    <th className="px-ds-4 py-ds-3">Guías</th>
                    <th className="px-ds-4 py-ds-3">Km recorridos</th>
                    <th className="px-ds-4 py-ds-3">Subtotal</th>
                    <th className="px-ds-4 py-ds-3">IVA</th>
                    <th className="px-ds-4 py-ds-3">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {resumen.map((r) => (
                    <tr key={r.clave} className="border-b border-ds-text/[0.08] last:border-0">
                      <td className="px-ds-4 py-ds-3 font-medium text-ds-text">{r.clave}</td>
                      <td className="px-ds-4 py-ds-3 text-ds-text">{r.cantidad_viajes}</td>
                      <td className="px-ds-4 py-ds-3 tabular-nums text-ds-text">{r.km_total.toLocaleString("es-CL")} km</td>
                      <td className="px-ds-4 py-ds-3 text-ds-text">{formatMoneda(r.subtotal, usuario.moneda)}</td>
                      <td className="px-ds-4 py-ds-3 text-ds-text">{formatMoneda(r.iva, usuario.moneda)}</td>
                      <td className="px-ds-4 py-ds-3 font-medium text-ds-text">{formatMoneda(r.total, usuario.moneda)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="px-ds-4 py-ds-6 font-ds-body text-ds-small text-ds-text/70">Sin viajes registrados todavía.</p>
          )}
        </Card>
      </div>

      {formAbierto && (
        <div className="mb-ds-6">
          <Card>
            <p className="mb-ds-4 font-ds-body text-ds-small font-semibold text-ds-text">Nuevo viaje</p>
            <form onSubmit={onSubmit} className="flex flex-col gap-ds-4">
              <div className="grid gap-ds-4 sm:grid-cols-2 lg:grid-cols-3">
                <DatePicker etiqueta="Fecha" valor={aFecha(fecha)} onCambio={(f) => setFecha(aTexto(f))} />
                <Input etiqueta="Número de guía" requerido valor={numeroGuia} onCambio={setNumeroGuia} />
                <div className="flex flex-col gap-ds-1">
                  <label className="font-ds-body text-ds-caption font-medium text-ds-text/70">Cliente</label>
                  <ComboboxCliente
                    value={clienteId}
                    onChange={(id) => {
                      setClienteId(id);
                      // Tarea 135: la forma de cobro por defecto del cliente.
                      const c = clientes.find((x) => x.id === id);
                      if (c?.modo_precio_default) setModoPrecio(c.modo_precio_default);
                    }}
                    clientes={clientes}
                    onClienteCreado={(c) => setClientes((prev) => [...prev, c])}
                    placeholder="Selecciona un cliente…"
                  />
                </div>
                <div className="flex flex-col gap-ds-1">
                  <label className="font-ds-body text-ds-caption font-medium text-ds-text/70">Chofer (opcional)</label>
                  <ComboboxResponsable value={choferId} onChange={setChoferId} equipo={choferes} opcionVacia="Sin asignar" placeholder="Sin asignar" />
                  {choferes.length === 0 ? (
                    <p className="font-ds-body text-ds-caption text-ds-text/60">Para asignar, marca a la persona con la función Chofer en Personas.</p>
                  ) : null}
                </div>
                <Input etiqueta="Hora de salida (opcional)" tipo="hora" valor={hora} onCambio={setHora} />
                <div className="flex flex-col gap-ds-1">
                  <label className="font-ds-body text-ds-caption font-medium text-ds-text/70">Origen</label>
                  <Combobox
                    value={origen}
                    onChange={setOrigen}
                    opciones={opcionesCiudad}
                    placeholder="Elegir ciudad de origen"
                    etiquetaCrear={(texto) => `Usar "${texto}" (no está en la lista)`}
                    onCrear={(texto) => {
                      agregarCiudadLibre(texto);
                      setOrigen(texto);
                    }}
                  />
                </div>
                <div className="flex flex-col gap-ds-1">
                  <label className="font-ds-body text-ds-caption font-medium text-ds-text/70">Destino</label>
                  <Combobox
                    value={destino}
                    onChange={setDestino}
                    opciones={opcionesCiudad}
                    placeholder="Elegir ciudad de destino"
                    etiquetaCrear={(texto) => `Usar "${texto}" (no está en la lista)`}
                    onCrear={(texto) => {
                      agregarCiudadLibre(texto);
                      setDestino(texto);
                    }}
                  />
                </div>
                <Input etiqueta="Km inicial (opcional)" tipo="numero" valor={kmInicial} onCambio={setKmInicial} />
                <Input etiqueta="Km final (opcional)" tipo="numero" valor={kmFinal} onCambio={setKmFinal} />
                <div className="flex flex-col gap-ds-1">
                  <label className="font-ds-body text-ds-caption font-medium text-ds-text/70">Monto del viaje</label>
                  <InputMonto required value={subtotal} onChange={setSubtotal} moneda={usuario.moneda} />
                </div>
                <div className="flex items-end pb-2.5">
                  <label className="flex items-center gap-ds-2 font-ds-body text-ds-small text-ds-text">
                    <input type="checkbox" checked={aplicaIva} onChange={(e) => setAplicaIva(e.target.checked)} className="accent-[var(--ds-brand)]" />
                    Aplicar IVA (19%)
                  </label>
                </div>
                {puedeViatico ? (
                  <CampoViatico
                    tipo={viaticoTipo}
                    monto={viaticoMonto}
                    onCambio={(t, m) => {
                      setViaticoTipo(t);
                      setViaticoMonto(m);
                    }}
                    origen={origen}
                    destino={destino}
                    config={configViaticos}
                    moneda={usuario.moneda}
                  />
                ) : null}
                {puedeViatico ? (
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
                    onMontoPropuesto={setSubtotal}
                    opcionesCiudad={opcionesCiudad}
                    onCiudadLibre={agregarCiudadLibre}
                    moneda={usuario.moneda}
                  />
                ) : null}
                <div className="sm:col-span-2 lg:col-span-3">
                  <Input etiqueta="Comentarios (opcional)" valor={comentarios} onCambio={setComentarios} />
                </div>
              </div>
              {formError ? <p className="font-ds-body text-ds-small text-ds-accent-700">{formError}</p> : null}
              <div className="flex gap-ds-2">
                <Button tipo="submit" cargando={guardando}>
                  Agregar viaje
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

      {usuario.rol === "admin" && (
        <label className="mb-ds-4 flex items-center gap-ds-2 font-ds-body text-ds-small text-ds-text">
          <input type="checkbox" checked={aprobAuto} onChange={(e) => cambiarAprobAuto(e.target.checked)} className="accent-[var(--ds-brand)]" />
          Aprobar automáticamente los viajes que registran los choferes desde la app
        </label>
      )}

      <div className="mb-ds-4 flex flex-wrap items-center gap-ds-3">
        <Select
          valor={filtroEstado}
          onCambio={(v) => setFiltroEstado(v as typeof filtroEstado)}
          opciones={[
            { valor: "todos", etiqueta: "Todos los estados" },
            { valor: "borrador", etiqueta: "Borrador" },
            { valor: "confirmado", etiqueta: "Confirmado" },
            { valor: "facturado", etiqueta: "Facturado" },
          ]}
        />
        {seleccionados.size > 0 && (
          <div className="ml-auto flex items-center gap-ds-3">
            <span className="font-ds-body text-ds-small text-ds-text/70">
              {seleccionados.size} seleccionado{seleccionados.size > 1 ? "s" : ""} · {formatMoneda(totalSeleccionado, usuario.moneda)}
            </span>
            <Button onPress={facturarSeleccionados} deshabilitado={!puedeFacturar}>
              Facturar seleccionados
            </Button>
          </div>
        )}
      </div>
      {seleccionados.size > 0 && !puedeFacturar && (
        <p className="-mt-ds-2 mb-ds-4 font-ds-body text-ds-caption text-ds-text/60">
          Para facturar, todos los viajes seleccionados deben ser del mismo cliente y estar en estado &quot;confirmado&quot;.
        </p>
      )}

      {error ? <ErrorState mensaje={error} onReintentar={cargar} /> : null}
      {viajes === null && !error ? <LoadingState /> : null}

      {viajes?.length === 0 && (
        <EmptyState
          icono={<Truck size={28} strokeWidth={2.75} />}
          titulo="Ningún viaje registrado"
          mensaje="Registra tu primer viaje para comenzar."
          accion={
            <Button iconoIzq={<Plus size={16} strokeWidth={2.75} />} onPress={abrirNuevo}>
              Nuevo Viaje
            </Button>
          }
        />
      )}

      {lista.length > 0 && (
        <Card sinRelleno elevacion="sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-ds-body">
              <thead>
                <tr className="border-b border-ds-divider text-[11px] font-medium uppercase tracking-[0.08em] text-ds-text/60">
                  <th className="px-ds-4 py-ds-3"></th>
                  <th className="px-ds-4 py-ds-3">Fecha</th>
                  <th className="px-ds-4 py-ds-3">Guía</th>
                  <th className="px-ds-4 py-ds-3">Cliente</th>
                  <th className="px-ds-4 py-ds-3">Chofer</th>
                  <th className="px-ds-4 py-ds-3">Ruta</th>
                  <th className="px-ds-4 py-ds-3">Km</th>
                  <th className="px-ds-4 py-ds-3">Total</th>
                  <th className="px-ds-4 py-ds-3">Estado</th>
                  <th className="px-ds-4 py-ds-3">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {lista.map((v) => {
                  const kilometros = km(v);
                  const esBorrador = v.estado === "borrador";
                  return (
                    <Fragment key={v.id}>
                      <tr id={`viaje-${v.id}`} className={`border-b border-ds-text/[0.08] last:border-0 hover:bg-ds-text/[0.04] ${esBorrador ? "bg-ds-accent-100/60" : ""}`}>
                        <td className="px-ds-4 py-ds-3">
                          <input
                            type="checkbox"
                            checked={seleccionados.has(v.id)}
                            disabled={v.estado === "facturado"}
                            onChange={() => alternarSeleccion(v.id)}
                            className="accent-[var(--ds-brand)]"
                          />
                        </td>
                        <td className="px-ds-4 py-ds-3 text-ds-text/70">{v.fecha}</td>
                        <td className="px-ds-4 py-ds-3 font-medium text-ds-text">
                          {formatearFolio("VIA", v.folio) ? <p className="font-ds-body text-ds-caption text-ds-text/60">{formatearFolio("VIA", v.folio)}</p> : null}
                          {v.numero_guia}
                        </td>
                        <td className="px-ds-4 py-ds-3 text-ds-text">{v.cliente_info?.nombre ?? v.cliente}</td>
                        <td className="px-ds-4 py-ds-3 text-ds-text/70">{v.chofer?.nombre ?? "—"}</td>
                        <td className="px-ds-4 py-ds-3 text-ds-text/70">
                          {v.origen} → {v.destino}
                          {v.origen && v.destino && (
                            <a
                              href={`https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(v.origen)}&destination=${encodeURIComponent(v.destino)}&travelmode=driving`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="ml-ds-2 font-ds-body text-ds-caption font-medium text-ds-brand hover:underline"
                              title="Ver la ruta en Google Maps"
                            >
                              ruta
                            </a>
                          )}
                        </td>
                        <td className="px-ds-4 py-ds-3 tabular-nums text-ds-text/70">{kilometros != null ? `${kilometros.toLocaleString("es-CL")} km` : "—"}</td>
                        <td className="px-ds-4 py-ds-3 text-ds-text">
                          {formatMoneda(v.total, usuario.moneda)}
                          {v.aplica_iva && <span className="ml-ds-1 font-ds-body text-ds-caption text-ds-text/60">+IVA</span>}
                          {puedeViatico && v.modo_precio && v.modo_precio !== "fijo" ? (
                            <p className="font-ds-body text-ds-caption text-ds-text/60">
                              {v.modo_precio === "tramos" ? `Por tramos (${v.tramos_detalle?.length ?? 0})` : `Por km · ${v.distancia_km ?? 0} km`}
                            </p>
                          ) : null}
                        </td>
                        <td className="px-ds-4 py-ds-3">
                          <StatusBadge estado={v.estado} tonoForzado={v.estado === "confirmado" || v.estado === "facturado" ? "completado" : "en_progreso"} />
                          {v.origen_captura === "whatsapp" && (
                            <span className="ml-1.5 font-ds-body text-ds-caption text-ds-text/60" title="Capturado por WhatsApp">
                              📱
                            </span>
                          )}
                        </td>
                        <td className="px-ds-4 py-ds-3">
                          <div className="flex items-center gap-ds-3">
                            {v.estado !== "facturado" && (
                              <button type="button" onClick={() => abrirEdicion(v)} className="font-ds-body text-ds-caption font-medium text-ds-brand hover:underline">
                                {esBorrador ? "Revisar y confirmar" : "Editar"}
                              </button>
                            )}
                            <button type="button" onClick={() => verFotos(v.id)} className="font-ds-body text-ds-caption font-medium text-ds-text/60 hover:text-ds-brand">
                              Fotos
                            </button>
                            <button type="button" onClick={() => void verHistorialMonto(v)} className="font-ds-body text-ds-caption font-medium text-ds-text/60 hover:text-ds-brand">
                              Historial
                            </button>
                            {v.estado !== "facturado" && (
                              <button type="button" onClick={() => eliminar(v.id)} className="font-ds-body text-ds-caption font-medium text-ds-accent-700 hover:underline">
                                Eliminar
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                      {editId === v.id && (
                        <tr className="border-b border-ds-divider bg-ds-brand/[0.06]">
                          <td colSpan={10} className="px-ds-4 py-ds-4">
                            <div className="mb-ds-3 flex flex-wrap items-end gap-ds-3">
                              <div className="w-32">
                                <Input etiqueta="Número de guía" valor={editNumeroGuia} onCambio={setEditNumeroGuia} />
                              </div>
                              <div className="min-w-[180px] flex-1">
                                <label className="font-ds-body text-ds-caption font-medium text-ds-text/70">Origen</label>
                                <Combobox
                                  value={editOrigen}
                                  onChange={setEditOrigen}
                                  opciones={opcionesCiudad}
                                  placeholder="Elegir ciudad de origen"
                                  etiquetaCrear={(texto) => `Usar "${texto}" (no está en la lista)`}
                                  onCrear={(texto) => {
                                    agregarCiudadLibre(texto);
                                    setEditOrigen(texto);
                                  }}
                                />
                              </div>
                              <div className="min-w-[180px] flex-1">
                                <label className="font-ds-body text-ds-caption font-medium text-ds-text/70">Destino</label>
                                <Combobox
                                  value={editDestino}
                                  onChange={setEditDestino}
                                  opciones={opcionesCiudad}
                                  placeholder="Elegir ciudad de destino"
                                  etiquetaCrear={(texto) => `Usar "${texto}" (no está en la lista)`}
                                  onCrear={(texto) => {
                                    agregarCiudadLibre(texto);
                                    setEditDestino(texto);
                                  }}
                                />
                              </div>
                            </div>
                            <div className="flex flex-wrap items-end gap-ds-3">
                              <div className="min-w-[220px]">
                                <label className="font-ds-body text-ds-caption font-medium text-ds-text/70">Cliente</label>
                                <ComboboxCliente
                                  value={editClienteId}
                                  onChange={setEditClienteId}
                                  clientes={clientes}
                                  onClienteCreado={(c) => setClientes((prev) => [...prev, c])}
                                  placeholder="Selecciona un cliente…"
                                />
                              </div>
                              <div className="min-w-[180px]">
                                <label className="font-ds-body text-ds-caption font-medium text-ds-text/70">Chofer</label>
                                <ComboboxResponsable
                                  value={editChoferId}
                                  onChange={setEditChoferId}
                                  equipo={v.chofer && !choferes.some((c) => c.id === v.chofer?.id) ? [...choferes, v.chofer as Usuario] : choferes}
                                  opcionVacia="Sin asignar"
                                  placeholder="Sin asignar"
                                />
                              </div>
                              <div className="w-32">
                                <Input etiqueta="Hora" tipo="hora" valor={editHora} onCambio={setEditHora} />
                              </div>
                              <div className="w-32">
                                <Input etiqueta="Km inicial" tipo="numero" valor={editKmInicial} onCambio={setEditKmInicial} />
                              </div>
                              <div className="w-32">
                                <Input etiqueta="Km final" tipo="numero" valor={editKmFinal} onCambio={setEditKmFinal} />
                              </div>
                              <div className="w-36">
                                <label className="font-ds-body text-ds-caption font-medium text-ds-text/70">Monto del viaje</label>
                                {/* Solo Admin y Supervisor cambian el monto (tarea 132; el backend lo exige). */}
                                <InputMonto
                                  value={editSubtotal}
                                  onChange={setEditSubtotal}
                                  moneda={usuario.moneda}
                                  disabled={!ROLES_SUPERVISION.includes(usuario.rol)}
                                />
                              </div>
                              <label className="flex items-center gap-ds-2 pb-2.5 font-ds-body text-ds-small text-ds-text">
                                <input
                                  type="checkbox"
                                  checked={editAplicaIva}
                                  onChange={(e) => setEditAplicaIva(e.target.checked)}
                                  disabled={!ROLES_SUPERVISION.includes(usuario.rol)}
                                  className="accent-[var(--ds-brand)]"
                                />
                                Aplicar IVA
                              </label>
                              {puedeViatico ? (
                                <div className="flex min-w-[220px] flex-wrap items-end gap-ds-3">
                                  <CampoViatico
                                    tipo={editViaticoTipo}
                                    monto={editViaticoMonto}
                                    onCambio={(t, m) => {
                                      setEditViaticoTipo(t);
                                      setEditViaticoMonto(m);
                                    }}
                                    origen={editOrigen}
                                    destino={editDestino}
                                    config={configViaticos}
                                    moneda={usuario.moneda}
                                  />
                                </div>
                              ) : null}
                            </div>
                            {puedeViatico ? (
                              <div className="mt-ds-3">
                                <PrecioViaje
                                  modo={editModoPrecio}
                                  onModo={setEditModoPrecio}
                                  origen={editOrigen}
                                  destino={editDestino}
                                  paradas={editParadas}
                                  onParadas={setEditParadas}
                                  km={editDistanciaKm}
                                  onKm={setEditDistanciaKm}
                                  clienteId={editClienteId}
                                  onMontoPropuesto={setEditSubtotal}
                                  opcionesCiudad={opcionesCiudad}
                                  onCiudadLibre={agregarCiudadLibre}
                                  moneda={usuario.moneda}
                                />
                              </div>
                            ) : null}
                            <div className="mt-ds-3">
                              <Input etiqueta="Comentarios / incidentes (opcional)" valor={editComentarios} onCambio={setEditComentarios} />
                            </div>
                            <div className="mt-ds-3 flex flex-wrap items-center gap-ds-3">
                              {esBorrador ? (
                                <>
                                  <Button onPress={() => guardarEdicion(v.id, true)} cargando={confirmando}>
                                    Confirmar viaje
                                  </Button>
                                  <Button variante="secundario" onPress={() => guardarEdicion(v.id, false)} deshabilitado={confirmando}>
                                    Guardar sin confirmar
                                  </Button>
                                </>
                              ) : (
                                <Button onPress={() => guardarEdicion(v.id)} cargando={confirmando}>
                                  Guardar cambios
                                </Button>
                              )}
                              <button type="button" onClick={() => verFotos(v.id)} className="font-ds-body text-ds-caption font-medium text-ds-text/60 hover:text-ds-brand">
                                Ver / subir fotos
                              </button>
                              <Button variante="ghost" onPress={() => setEditId(null)}>
                                Cancelar
                              </Button>
                            </div>
                            {editError ? <p className="mt-ds-2 font-ds-body text-ds-small text-ds-accent-700">{editError}</p> : null}
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
      )}

      <Modal open={historialMonto != null} onClose={() => setHistorialMonto(null)} title={`Cambios de monto — guía ${historialMonto?.guia ?? ""}`}>
        {historialMonto?.cargando ? (
          <p className="font-ds-body text-ds-small text-ds-text/70">Cargando…</p>
        ) : historialMonto?.error ? (
          <p className="font-ds-body text-ds-small text-ds-accent-700">{historialMonto.error}</p>
        ) : historialMonto && historialMonto.filas.length === 0 ? (
          <p className="font-ds-body text-ds-small text-ds-text/70">El monto de este viaje no se ha modificado.</p>
        ) : (
          <ul className="flex flex-col gap-ds-2 font-ds-body text-ds-small text-ds-text">
            {historialMonto?.filas.map((f) => (
              <li key={f.id} className="flex flex-wrap justify-between gap-ds-2 border-b border-ds-divider pb-ds-2 tabular-nums">
                <span>
                  {formatMoneda(f.detalle.anterior?.total ?? 0, usuario?.moneda)} → <strong>{formatMoneda(f.detalle.nuevo?.total ?? 0, usuario?.moneda)}</strong>
                </span>
                <span className="text-ds-text/60">
                  {f.usuario?.nombre ?? "—"} · {new Date(f.creado_en).toLocaleString("es-CL")}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Modal>

      <Modal open={fotosViaje != null} onClose={() => setFotosViaje(null)} title="Fotos del viaje" wide>
        {fotosViaje?.cargando ? (
          <p className="font-ds-body text-ds-small text-ds-text/70">Cargando…</p>
        ) : fotosViaje ? (
          <div className="flex flex-col gap-ds-4">
            {fotosViaje.guiaUrl && (
              <div>
                <p className="mb-ds-2 font-ds-body text-ds-caption font-medium text-ds-text/70">Foto de la guía</p>
                <a href={fotosViaje.guiaUrl} target="_blank" rel="noopener noreferrer">
                  {/* URL firmada (vence) — sin optimizer, con lazy-load igual. */}
                  <Image src={fotosViaje.guiaUrl} alt="Foto de la guía" width={160} height={160} unoptimized className="aspect-square w-40 rounded-ds-md border border-ds-divider object-cover" />
                </a>
              </div>
            )}
            <div>
              <p className="mb-ds-2 font-ds-body text-ds-caption font-medium text-ds-text/70">Otras fotos</p>
              {fotosViaje.fotos.length > 0 ? (
                <div className="grid grid-cols-2 gap-ds-3 sm:grid-cols-3">
                  {fotosViaje.fotos.map((f) => (
                    <div key={f.id} className="group relative">
                      <a href={f.url} target="_blank" rel="noopener noreferrer" className="relative block aspect-square w-full">
                        {/* URL firmada (vence) — sin optimizer, con lazy-load igual. */}
                        <Image src={f.url} alt="Foto del viaje" fill unoptimized className="rounded-ds-md border border-ds-divider object-cover" />
                      </a>
                      <button
                        type="button"
                        onClick={() => eliminarFotoViaje(f.id)}
                        className="absolute right-1.5 top-1.5 rounded-ds-pill bg-ds-accent-700 px-2 py-0.5 font-ds-body text-[11px] font-medium text-white opacity-0 transition-opacity group-hover:opacity-100"
                      >
                        Eliminar
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="font-ds-body text-ds-small text-ds-text/70">Todavía no hay fotos adicionales.</p>
              )}
            </div>
            <div>
              <label className="inline-block cursor-pointer">
                <div className="pointer-events-none">
                  <Button variante="secundario" cargando={fotosViaje.subiendo}>
                    Subir foto
                  </Button>
                </div>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={(e) => {
                    const archivo = e.target.files?.[0];
                    if (archivo) subirFotoViaje(archivo);
                    e.target.value = "";
                  }}
                />
              </label>
              {fotosViaje.error ? <p className="mt-ds-2 font-ds-body text-ds-small text-ds-accent-700">{fotosViaje.error}</p> : null}
            </div>
          </div>
        ) : null}
      </Modal>
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
