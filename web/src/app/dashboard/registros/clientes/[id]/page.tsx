"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ChevronLeft, MapPin, MessageCircle, Plus, Receipt, Tag, Wrench } from "lucide-react";
import type { Cliente, Equipo, Factura, PaqueteSesionesConSaldo, Presupuesto, TipoPack, Trabajo, OrdenServicio } from "@bitacora/shared";
import { estadoOsDeTrabajo, formatearRut, validarRut } from "@bitacora/shared";
import { supabase } from "@/lib/supabase";
import { apiFetch } from "@/lib/api";
import { formatMoneda } from "@/lib/formatMoneda";
import { DashboardShell, type UsuarioShell } from "@/components/DashboardShell";
import { AsignarPackForm } from "@/components/AsignarPackForm";
import { Button, Card, Input, StatusBadge } from "@bitacora/ui/web";
import { linkWhatsapp } from "@/lib/whatsapp";

type TrabajoConOrden = Trabajo & { orden: Pick<OrdenServicio, "folio" | "estado_os"> | null };
type ClienteDetalle = Cliente & {
  trabajos: TrabajoConOrden[];
  presupuestos: Presupuesto[];
  facturas: Factura[];
  equipos: Equipo[];
};

type Tab = "historial" | "equipos" | "financiero";
const TABS: { valor: Tab; etiqueta: string }[] = [
  { valor: "historial", etiqueta: "Historial" },
  { valor: "equipos", etiqueta: "Equipos" },
  { valor: "financiero", etiqueta: "Financiero" },
];

// Bloque A — Vista 360°: un solo timeline cronológico combinando OS,
// cotizaciones y cobros — antes eran 3 cards apiladas sin orden común.
type EventoHistorial = {
  id: string;
  tipo: "os" | "cotizacion" | "cobro";
  fecha: string;
  titulo: string;
  badgeValue: string;
  onClick: () => void;
};

const ICONO_EVENTO = { os: Wrench, cotizacion: Tag, cobro: Receipt } as const;

// PASO 6 (sistema de diseño) — migrado. Ver docs/design-system.md.
export default function ClienteDetallePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [usuario, setUsuario] = useState<UsuarioShell | null>(null);
  const [cliente, setCliente] = useState<ClienteDetalle | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("historial");

  const [editando, setEditando] = useState(false);
  const [nombre, setNombre] = useState("");
  const [rut, setRut] = useState("");
  const [telefono, setTelefono] = useState("");
  const [correo, setCorreo] = useState("");
  const [direccion, setDireccion] = useState("");
  const [comuna, setComuna] = useState("");
  const [fechaNacimiento, setFechaNacimiento] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [errorForm, setErrorForm] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  // Agenda Pro — packs del cliente. `null` = todavía no cargó o la
  // empresa no tiene Agenda Pro (en cuyo caso la card no se muestra).
  const [paquetes, setPaquetes] = useState<PaqueteSesionesConSaldo[] | null>(null);
  const [tiposPack, setTiposPack] = useState<TipoPack[]>([]);
  const [asignandoPack, setAsignandoPack] = useState(false);
  // Pack agotado que se está renovando (precarga el form con sus datos).
  const [renovandoPack, setRenovandoPack] = useState<PaqueteSesionesConSaldo | null>(null);
  const [avisoPack, setAvisoPack] = useState<string | null>(null);

  const cargarPacks = useCallback(async () => {
    const [resPaquetes, resTipos] = await Promise.all([
      apiFetch(`/api/paquetes-sesiones?cliente_id=${params.id}`),
      apiFetch("/api/tipos-pack?activo=1"),
    ]);
    if (resPaquetes.ok) setPaquetes(await resPaquetes.json());
    if (resTipos.ok) setTiposPack(await resTipos.json());
  }, [params.id]);

  const cargar = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      router.replace("/login");
      return;
    }
    const [resMe, resCliente] = await Promise.all([apiFetch("/api/me"), apiFetch(`/api/clientes/${params.id}`)]);
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
    if (!resCliente.ok) {
      setError("No se pudo cargar el cliente");
      return;
    }
    const c: ClienteDetalle = await resCliente.json();
    setCliente(c);
    setNombre(c.nombre);
    setRut(c.rut ?? "");
    setTelefono(c.telefono ?? "");
    setCorreo(c.correo ?? "");
    setDireccion(c.direccion);
    setComuna(c.comuna ?? "");
    setFechaNacimiento(c.fecha_nacimiento ?? "");
  }, [params.id, router]);

  useEffect(() => {
    cargar();
    cargarPacks();
  }, [cargar, cargarPacks]);

  async function onGuardar() {
    setErrorForm(null);
    setAviso(null);
    if (rut.trim() && !validarRut(rut)) {
      setErrorForm("El RUT no es válido (revisa el dígito verificador)");
      return;
    }
    setGuardando(true);
    const res = await apiFetch(`/api/clientes/${params.id}`, {
      method: "PATCH",
      body: JSON.stringify({ nombre, rut: rut.trim() ? formatearRut(rut) : null, telefono, correo, direccion, comuna, fecha_nacimiento: fechaNacimiento || null }),
    });
    setGuardando(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setErrorForm(body.error ?? "No se pudo guardar");
      return;
    }
    setEditando(false);
    setAviso("Cliente actualizado");
    cargar();
  }

  async function onAlternarActivo() {
    if (!cliente) return;
    const res = await apiFetch(`/api/clientes/${params.id}`, { method: "PATCH", body: JSON.stringify({ activo: !cliente.activo }) });
    if (res.ok) cargar();
  }

  const eventosHistorial: EventoHistorial[] = useMemo(() => {
    if (!cliente) return [];
    const eventos: EventoHistorial[] = [
      ...cliente.trabajos.map((t) => ({
        id: `os-${t.id}`,
        tipo: "os" as const,
        fecha: t.fecha,
        titulo: t.orden?.folio != null ? `OS N° ${t.orden.folio}` : t.descripcion || t.codigo || "Orden de servicio",
        badgeValue: t.orden?.estado_os ?? estadoOsDeTrabajo(t.estado),
        onClick: () => router.push(`/dashboard/ordenes/${t.id}`),
      })),
      ...cliente.presupuestos.map((p) => ({
        id: `cot-${p.id}`,
        tipo: "cotizacion" as const,
        fecha: p.fecha,
        titulo: p.descripcion || "Cotización",
        badgeValue: p.estado,
        onClick: () => router.push(`/dashboard/financiero/cotizaciones/${p.id}`),
      })),
      ...cliente.facturas.map((f) => ({
        id: `cobro-${f.id}`,
        tipo: "cobro" as const,
        fecha: f.fecha_emision,
        titulo: `Cobro — ${formatMoneda(f.monto, usuario?.moneda ?? "CLP")}`,
        badgeValue: f.estado,
        onClick: () => router.push("/dashboard/financiero/cobros"),
      })),
    ];
    return eventos.sort((a, b) => (a.fecha < b.fecha ? 1 : a.fecha > b.fecha ? -1 : 0));
  }, [cliente, usuario?.moneda, router]);

  // Saldo del cliente: total por cobrar y cuánto de eso está vencido
  // (fecha de vencimiento pasada y sin pagar).
  const hoyISO = new Date().toISOString().slice(0, 10);
  const facturasCliente = cliente?.facturas ?? [];
  const totalPorCobrar = facturasCliente.filter((f) => f.estado !== "pagada").reduce((s, f) => s + f.monto, 0);
  const totalVencido = facturasCliente
    .filter((f) => f.estado !== "pagada" && f.fecha_vencimiento < hoyISO)
    .reduce((s, f) => s + f.monto, 0);

  if (!usuario) return null;

  return (
    <DashboardShell usuario={usuario}>
      <Link href="/dashboard/registros/clientes" className="mb-ds-4 inline-flex items-center gap-ds-1 font-ds-body text-ds-small font-medium text-ds-brand hover:underline">
        <ChevronLeft size={16} strokeWidth={2.75} />
        Clientes
      </Link>

      {error && !cliente ? <p className="font-ds-body text-ds-small text-ds-accent-700">{error}</p> : null}

      {cliente && (
        <>
          <div className="mb-ds-4 flex flex-wrap items-center justify-between gap-ds-3">
            <div>
              <p className="ds-heading text-ds-h2 text-ds-text">{cliente.nombre}</p>
              <p className="mt-ds-1 font-ds-body text-ds-small text-ds-text/70">{cliente.direccion}</p>
            </div>
            <div className="flex items-center gap-ds-2">
              <StatusBadge estado={cliente.activo ? "activo" : "inactivo"} />
              {cliente.telefono && (
                <a href={linkWhatsapp(cliente.telefono)} target="_blank" rel="noopener noreferrer">
                  <Button variante="secundario" iconoIzq={<MessageCircle size={16} strokeWidth={2.75} />}>
                    WhatsApp
                  </Button>
                </a>
              )}
              <Button variante="secundario" onPress={onAlternarActivo}>
                {cliente.activo ? "Desactivar" : "Activar"}
              </Button>
              <Button variante="secundario" onPress={() => setEditando((v) => !v)}>
                {editando ? "Cerrar" : "Editar"}
              </Button>
            </div>
          </div>

          {/* Bloque A — accesos directos: cada uno abre el formulario
              correspondiente con este cliente ya preseleccionado. */}
          <div className="mb-ds-6 flex flex-wrap gap-ds-2">
            <Link href={`/dashboard/financiero/cotizaciones/nueva?cliente_id=${cliente.id}`}>
              <Button variante="secundario" iconoIzq={<Plus size={16} strokeWidth={2.75} />}>
                Nueva Cotización
              </Button>
            </Link>
            <Link href={`/dashboard/ordenes/nueva?cliente_id=${cliente.id}`}>
              <Button variante="secundario" iconoIzq={<Plus size={16} strokeWidth={2.75} />}>
                Nueva OS
              </Button>
            </Link>
            <Link href={`/dashboard/financiero/cobros?nuevo=1&cliente_id=${cliente.id}`}>
              <Button variante="secundario" iconoIzq={<Plus size={16} strokeWidth={2.75} />}>
                Nuevo Cobro
              </Button>
            </Link>
          </div>

          {editando && (
            <div className="mb-ds-6">
              <Card>
                <p className="mb-ds-4 font-ds-body text-ds-small font-semibold text-ds-text">Editar datos</p>
                <div className="grid gap-ds-4 sm:grid-cols-2">
                  <Input etiqueta="Nombre" valor={nombre} onCambio={setNombre} />
                  {/* Sin onBlur en Input (ds-) — mismo motivo que en el listado de clientes. */}
                  <Input etiqueta="RUT (habilita el login al Portal de Cliente)" placeholder="12.345.678-9" valor={rut} onCambio={setRut} />
                  <Input etiqueta="Teléfono (para WhatsApp, puedes escribirlo con +56 9…)" placeholder="+56 9 1234 5678" valor={telefono} onCambio={setTelefono} />
                  <Input etiqueta="Correo" tipo="email" valor={correo} onCambio={setCorreo} />
                  <Input etiqueta="Dirección" valor={direccion} onCambio={setDireccion} />
                  <Input etiqueta="Comuna" valor={comuna} onCambio={setComuna} />
                  <FechaCampo etiqueta="Fecha de cumpleaños (opcional)" valor={fechaNacimiento} onCambio={setFechaNacimiento} />
                </div>
                {errorForm ? <p className="mt-ds-3 font-ds-body text-ds-small text-ds-accent-700">{errorForm}</p> : null}
                <div className="mt-ds-4">
                  <Button onPress={onGuardar} cargando={guardando}>
                    Guardar
                  </Button>
                </div>
              </Card>
            </div>
          )}
          {aviso ? <p className="my-ds-4 font-ds-body text-ds-small font-medium text-ds-accent2-800">{aviso}</p> : null}

          <div className="mb-ds-6">
            <Card>
              <p className="mb-ds-4 font-ds-body text-ds-small font-semibold text-ds-text">Contacto</p>
              <div className="grid gap-ds-4 sm:grid-cols-3">
                <div>
                  <p className="font-ds-body text-ds-caption text-ds-text/60">RUT</p>
                  <p className="font-ds-body text-ds-small text-ds-text">{cliente.rut ?? "—"}</p>
                </div>
                <div>
                  <p className="font-ds-body text-ds-caption text-ds-text/60">Teléfono</p>
                  <div className="flex items-center gap-ds-2">
                    <p className="font-ds-body text-ds-small text-ds-text">{cliente.telefono ?? "—"}</p>
                    {cliente.telefono && (
                      <a href={linkWhatsapp(cliente.telefono)} target="_blank" rel="noopener noreferrer" title="Contactar por WhatsApp" className="text-ds-text/60 hover:text-ds-brand">
                        <MessageCircle size={16} strokeWidth={2.75} />
                      </a>
                    )}
                  </div>
                </div>
                <div>
                  <p className="font-ds-body text-ds-caption text-ds-text/60">Cumpleaños</p>
                  <p className="font-ds-body text-ds-small text-ds-text">
                    {cliente.fecha_nacimiento
                      ? new Date(`${cliente.fecha_nacimiento}T00:00:00`).toLocaleDateString("es-CL", { day: "2-digit", month: "long" })
                      : "—"}
                  </p>
                </div>
                <div>
                  <p className="font-ds-body text-ds-caption text-ds-text/60">Correo</p>
                  <p className="font-ds-body text-ds-small text-ds-text">{cliente.correo ?? "—"}</p>
                </div>
                <div>
                  <p className="font-ds-body text-ds-caption text-ds-text/60">Ubicación</p>
                  {cliente.lat != null ? (
                    <span className="inline-flex items-center gap-ds-1 font-ds-body text-ds-small text-ds-accent2-800">
                      <MapPin size={14} strokeWidth={2.75} /> Ubicado
                    </span>
                  ) : (
                    <span className="font-ds-body text-ds-small text-ds-text/60">Sin ubicar</span>
                  )}
                </div>
              </div>
            </Card>
          </div>

          <div className="mb-ds-4 flex gap-ds-1 border-b border-ds-divider">
            {TABS.map((t) => (
              <button
                key={t.valor}
                type="button"
                onClick={() => setTab(t.valor)}
                className={`px-ds-4 py-2.5 font-ds-body text-ds-small font-medium transition-colors ${
                  tab === t.valor ? "border-b-2 border-ds-brand text-ds-brand" : "text-ds-text/60 hover:text-ds-text"
                }`}
              >
                {t.etiqueta}
              </button>
            ))}
          </div>

          {tab === "historial" && (
            <Card>
              <p className="mb-ds-4 font-ds-body text-ds-small font-semibold text-ds-text">Historial ({eventosHistorial.length})</p>
              {eventosHistorial.length === 0 ? (
                <p className="font-ds-body text-ds-small text-ds-text/70">Sin actividad todavía.</p>
              ) : (
                <div className="flex flex-col divide-y divide-ds-divider">
                  {eventosHistorial.map((ev) => {
                    const Icono = ICONO_EVENTO[ev.tipo];
                    return (
                      <button
                        key={ev.id}
                        type="button"
                        onClick={ev.onClick}
                        className="flex items-center justify-between gap-ds-2 py-2.5 text-left font-ds-body text-ds-small hover:text-ds-brand"
                      >
                        <div className="flex min-w-0 items-center gap-ds-2">
                          <Icono size={14} strokeWidth={2.75} className="shrink-0 text-ds-text/60" />
                          <div className="min-w-0">
                            <p className="truncate font-medium text-ds-text">{ev.titulo}</p>
                            <p className="font-ds-body text-ds-caption text-ds-text/60">{ev.fecha}</p>
                          </div>
                        </div>
                        <StatusBadge estado={ev.badgeValue} />
                      </button>
                    );
                  })}
                </div>
              )}
            </Card>
          )}

          {tab === "equipos" && (
            <Card>
              <div className="mb-ds-4 flex items-center justify-between">
                <p className="font-ds-body text-ds-small font-semibold text-ds-text">Equipos ({cliente.equipos.length})</p>
                <Link href="/dashboard/registros/equipos">
                  <Button variante="secundario" iconoIzq={<Plus size={16} strokeWidth={2.75} />}>
                    Nuevo Equipo
                  </Button>
                </Link>
              </div>
              {cliente.equipos.length === 0 ? (
                <p className="font-ds-body text-ds-small text-ds-text/70">Sin equipos registrados para este cliente.</p>
              ) : (
                <div className="flex flex-col divide-y divide-ds-divider">
                  {cliente.equipos.map((e) => (
                    <button
                      key={e.id}
                      type="button"
                      onClick={() => router.push(`/dashboard/registros/equipos/${e.id}`)}
                      className="flex items-center justify-between py-2.5 text-left font-ds-body text-ds-small hover:text-ds-brand"
                    >
                      <div>
                        <p className="font-medium text-ds-text">{e.nombre}</p>
                        <p className="font-ds-body text-ds-caption text-ds-text/60">{[e.categoria, e.marca, e.modelo].filter(Boolean).join(" · ") || "—"}</p>
                      </div>
                      <StatusBadge estado={e.activo ? "activo" : "inactivo"} />
                    </button>
                  ))}
                </div>
              )}
            </Card>
          )}

          {tab === "financiero" && (
            <div className="flex flex-col gap-ds-4">
              <Card>
                <p className="mb-ds-4 font-ds-body text-ds-small font-semibold text-ds-text">Cobros ({cliente.facturas.length})</p>
                {cliente.facturas.length > 0 && (
                  <div className="mb-ds-4 grid grid-cols-2 gap-ds-3">
                    <div className="rounded-ds-md border border-ds-divider p-ds-3">
                      <p className="font-ds-body text-ds-caption text-ds-text/60">Por cobrar</p>
                      <p className="mt-ds-1 font-ds-body text-ds-h5 font-semibold tabular-nums text-ds-text">
                        {formatMoneda(totalPorCobrar, usuario.moneda)}
                      </p>
                    </div>
                    <div className="rounded-ds-md border border-ds-divider p-ds-3">
                      <p className="font-ds-body text-ds-caption text-ds-text/60">Vencido</p>
                      <p className={`mt-ds-1 font-ds-body text-ds-h5 font-semibold tabular-nums ${totalVencido > 0 ? "text-ds-accent-700" : "text-ds-text"}`}>
                        {formatMoneda(totalVencido, usuario.moneda)}
                      </p>
                    </div>
                  </div>
                )}
                {cliente.facturas.length === 0 ? (
                  <p className="font-ds-body text-ds-small text-ds-text/70">Sin cobros todavía.</p>
                ) : (
                  <div className="flex flex-col divide-y divide-ds-divider">
                    {cliente.facturas.map((f) => (
                      <div key={f.id} className="flex items-center justify-between py-2.5 font-ds-body text-ds-small">
                        <div>
                          <p className="font-medium text-ds-text">Factura</p>
                          <p className="font-ds-body text-ds-caption text-ds-text/60">
                            Emitida {f.fecha_emision} · Vence {f.fecha_vencimiento}
                          </p>
                        </div>
                        <div className="flex items-center gap-ds-2">
                          <span className="text-ds-text">{formatMoneda(f.monto, usuario.moneda)}</span>
                          <StatusBadge estado={f.estado} />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Card>

              {/* Packs de sesiones — solo si la empresa tiene Agenda Pro
                  (si no, el fetch da 403 y `paquetes` queda en null). */}
              {paquetes !== null && (
                <Card>
                  <div className="mb-ds-4 flex items-center justify-between gap-ds-3">
                    <p className="font-ds-body text-ds-small font-semibold text-ds-text">Packs de sesiones ({paquetes.length})</p>
                    {!asignandoPack && (
                      <Button variante="secundario" iconoIzq={<Plus size={16} strokeWidth={2.75} />} onPress={() => setAsignandoPack(true)}>
                        Asignar pack
                      </Button>
                    )}
                  </div>

                  {avisoPack ? <p className="mb-ds-4 font-ds-body text-ds-small font-medium text-ds-accent2-800">{avisoPack}</p> : null}

                  {asignandoPack && (
                    <div className="mb-ds-4 rounded-ds-md border border-ds-divider p-ds-3">
                      <AsignarPackForm
                        clienteId={cliente.id}
                        tiposPack={tiposPack}
                        moneda={usuario.moneda ?? "CLP"}
                        onAsignado={() => {
                          setAsignandoPack(false);
                          setAvisoPack("Pack asignado.");
                          cargarPacks();
                        }}
                        onCancelar={() => setAsignandoPack(false)}
                      />
                    </div>
                  )}

                  {renovandoPack && (
                    <div className="mb-ds-4 rounded-ds-md border border-ds-divider p-ds-3">
                      <p className="mb-ds-3 font-ds-body text-ds-caption text-ds-text/60">
                        Renovando <span className="font-medium text-ds-text">{renovandoPack.nombre}</span> — mismo servicio y
                        cantidad. Ajusta el precio si corresponde.
                      </p>
                      <AsignarPackForm
                        clienteId={cliente.id}
                        tiposPack={tiposPack}
                        moneda={usuario.moneda ?? "CLP"}
                        inicial={{
                          tipoPackId:
                            renovandoPack.tipo_pack_id && tiposPack.some((t) => t.id === renovandoPack.tipo_pack_id)
                              ? renovandoPack.tipo_pack_id
                              : undefined,
                          nombre: renovandoPack.nombre,
                          cantidadTotal: renovandoPack.cantidad_total,
                          precioPagado: renovandoPack.precio_pagado != null ? String(renovandoPack.precio_pagado) : "",
                        }}
                        onAsignado={() => {
                          setRenovandoPack(null);
                          setAvisoPack("Pack renovado.");
                          cargarPacks();
                        }}
                        onCancelar={() => setRenovandoPack(null)}
                      />
                    </div>
                  )}

                  {paquetes.length === 0 && !asignandoPack ? (
                    <p className="font-ds-body text-ds-small text-ds-text/70">Este cliente no tiene packs.</p>
                  ) : (
                    <div className="flex flex-col divide-y divide-ds-divider">
                      {paquetes.map((p) => (
                        <div key={p.id} className="flex items-center justify-between gap-ds-3 py-2.5 font-ds-body text-ds-small">
                          <div>
                            <p className="font-medium text-ds-text">{p.nombre}</p>
                            <p className="font-ds-body text-ds-caption text-ds-text/60">
                              {p.saldo} / {p.cantidad_total} sesiones ·{" "}
                              {p.precio_pagado != null
                                ? `cobrado ${formatMoneda(p.precio_pagado, usuario.moneda)}`
                                : p.precio != null
                                  ? `lista ${formatMoneda(p.precio, usuario.moneda)}`
                                  : "sin precio"}
                              {p.vence_el ? ` · vence ${new Date(`${p.vence_el}T00:00:00`).toLocaleDateString("es-CL")}` : " · no vence"}
                            </p>
                          </div>
                          <div className="flex items-center gap-ds-2">
                            {p.saldo <= 0 && !renovandoPack && !asignandoPack && (
                              <Button
                                variante="secundario"
                                onPress={() => {
                                  setAvisoPack(null);
                                  setRenovandoPack(p);
                                }}
                              >
                                Renovar
                              </Button>
                            )}
                            <StatusBadge estado={p.saldo <= 0 ? "agotado" : "disponible"} />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </Card>
              )}
            </div>
          )}
        </>
      )}
    </DashboardShell>
  );
}

// Input nativo type="date" — ver el mismo helper en rutas/nueva/page.tsx.
function FechaCampo({ etiqueta, valor, onCambio }: { etiqueta: string; valor: string; onCambio: (v: string) => void }) {
  return (
    <div className="flex flex-col gap-ds-1">
      <label className="font-ds-body text-ds-caption font-medium text-ds-text/70">{etiqueta}</label>
      <input
        type="date"
        value={valor}
        onChange={(e) => onCambio(e.target.value)}
        className="h-11 w-full rounded-ds-md border border-ds-divider bg-ds-surface px-ds-3 font-ds-body text-ds-body text-ds-text transition-colors hover:border-ds-text/30 focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ds-brand)]"
      />
    </div>
  );
}
