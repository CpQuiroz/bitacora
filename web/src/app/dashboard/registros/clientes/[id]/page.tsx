"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import type { Cliente, Equipo, Factura, Presupuesto, Trabajo, OrdenServicio } from "@bitacora/shared";
import { formatearRut, validarRut } from "@bitacora/shared";
import { supabase } from "@/lib/supabase";
import { apiFetch } from "@/lib/api";
import { formatMoneda } from "@/lib/formatMoneda";
import { DashboardShell, type UsuarioShell } from "@/components/DashboardShell";
import { Badge, Button, buttonClass, Card, ErrorText, Input, Label, PageHeader, SuccessText } from "@/components/ui";
import { IconChat, IconChevronLeft, IconMapPin, IconPlus, IconReceipt, IconTag, IconWrench } from "@/components/icons";
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
  }, [cargar]);

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
      body: JSON.stringify({ nombre, rut: rut.trim() || null, telefono, correo, direccion, comuna, fecha_nacimiento: fechaNacimiento || null }),
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
        badgeValue: t.orden?.estado_os ?? t.estado,
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

  const ICONO_EVENTO = { os: IconWrench, cotizacion: IconTag, cobro: IconReceipt } as const;

  if (!usuario) return null;

  return (
    <DashboardShell usuario={usuario}>
      <Link href="/dashboard/registros/clientes" className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-brand hover:underline">
        <IconChevronLeft className="h-4 w-4" />
        Clientes
      </Link>

      {error && !cliente && <ErrorText>{error}</ErrorText>}

      {cliente && (
        <>
          <PageHeader
            title={cliente.nombre}
            subtitle={cliente.direccion}
            action={
              <div className="flex items-center gap-2">
                <Badge value={cliente.activo ? "activo" : "inactivo"} />
                {cliente.telefono && (
                  <a
                    href={linkWhatsapp(cliente.telefono)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={buttonClass("outline")}
                  >
                    <IconChat className="h-4 w-4" />
                    WhatsApp
                  </a>
                )}
                <Button type="button" variant="outline" onClick={onAlternarActivo}>
                  {cliente.activo ? "Desactivar" : "Activar"}
                </Button>
                <Button type="button" variant="outline" onClick={() => setEditando((v) => !v)}>
                  {editando ? "Cerrar" : "Editar"}
                </Button>
              </div>
            }
          />

          {/* Bloque A — accesos directos: cada uno abre el formulario
              correspondiente con este cliente ya preseleccionado. */}
          <div className="mt-4 flex flex-wrap gap-2">
            <Link href={`/dashboard/financiero/cotizaciones/nueva?cliente_id=${cliente.id}`} className={buttonClass("outline")}>
              <IconPlus className="h-4 w-4" />
              Nueva Cotización
            </Link>
            <Link href={`/dashboard/ordenes/nueva?cliente_id=${cliente.id}`} className={buttonClass("outline")}>
              <IconPlus className="h-4 w-4" />
              Nueva OS
            </Link>
            <Link href={`/dashboard/financiero/cobros?nuevo=1&cliente_id=${cliente.id}`} className={buttonClass("outline")}>
              <IconPlus className="h-4 w-4" />
              Nuevo Cobro
            </Link>
          </div>

          {editando && (
            <Card className="my-6">
              <h2 className="mb-4 text-sm font-semibold text-foreground">Editar datos</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label>Nombre</Label>
                  <Input type="text" value={nombre} onChange={(e) => setNombre(e.target.value)} />
                </div>
                <div>
                  <Label>RUT (habilita el login al Portal de Cliente)</Label>
                  <Input
                    type="text"
                    placeholder="12.345.678-9"
                    value={rut}
                    onChange={(e) => setRut(e.target.value)}
                    onBlur={() => rut.trim() && validarRut(rut) && setRut(formatearRut(rut))}
                  />
                </div>
                <div>
                  <Label>Teléfono (para WhatsApp, puedes escribirlo con +56 9…)</Label>
                  <Input type="text" placeholder="+56 9 1234 5678" value={telefono} onChange={(e) => setTelefono(e.target.value)} />
                </div>
                <div>
                  <Label>Correo</Label>
                  <Input type="email" value={correo} onChange={(e) => setCorreo(e.target.value)} />
                </div>
                <div>
                  <Label>Dirección</Label>
                  <Input type="text" value={direccion} onChange={(e) => setDireccion(e.target.value)} />
                </div>
                <div>
                  <Label>Comuna</Label>
                  <Input type="text" value={comuna} onChange={(e) => setComuna(e.target.value)} />
                </div>
                <div>
                  <Label>Fecha de cumpleaños (opcional)</Label>
                  <Input type="date" value={fechaNacimiento} onChange={(e) => setFechaNacimiento(e.target.value)} />
                </div>
              </div>
              {errorForm && (
                <div className="mt-3">
                  <ErrorText>{errorForm}</ErrorText>
                </div>
              )}
              <Button type="button" onClick={onGuardar} disabled={guardando} className="mt-4">
                {guardando ? "Guardando…" : "Guardar"}
              </Button>
            </Card>
          )}
          {aviso && (
            <div className="my-4">
              <SuccessText>{aviso}</SuccessText>
            </div>
          )}

          <Card className="my-6">
            <h2 className="mb-4 text-sm font-semibold text-foreground">Contacto</h2>
            <div className="grid gap-4 text-sm sm:grid-cols-3">
              <div>
                <p className="text-xs text-muted">RUT</p>
                <p className="text-foreground">{cliente.rut ?? "—"}</p>
              </div>
              <div>
                <p className="text-xs text-muted">Teléfono</p>
                <div className="flex items-center gap-2">
                  <p className="text-foreground">{cliente.telefono ?? "—"}</p>
                  {cliente.telefono && (
                    <a
                      href={linkWhatsapp(cliente.telefono)}
                      target="_blank"
                      rel="noopener noreferrer"
                      title="Contactar por WhatsApp"
                      className="text-muted hover:text-brand"
                    >
                      <IconChat className="h-4 w-4" />
                    </a>
                  )}
                </div>
              </div>
              <div>
                <p className="text-xs text-muted">Cumpleaños</p>
                <p className="text-foreground">
                  {cliente.fecha_nacimiento
                    ? new Date(`${cliente.fecha_nacimiento}T00:00:00`).toLocaleDateString("es-CL", { day: "2-digit", month: "long" })
                    : "—"}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted">Correo</p>
                <p className="text-foreground">{cliente.correo ?? "—"}</p>
              </div>
              <div>
                <p className="text-xs text-muted">Ubicación</p>
                {cliente.lat != null ? (
                  <span className="inline-flex items-center gap-1 text-success">
                    <IconMapPin className="h-3.5 w-3.5" /> Ubicado
                  </span>
                ) : (
                  <span className="text-muted">Sin ubicar</span>
                )}
              </div>
            </div>
          </Card>

          <div className="mb-4 flex gap-1 border-b border-border">
            {TABS.map((t) => (
              <button
                key={t.valor}
                type="button"
                onClick={() => setTab(t.valor)}
                className={`px-4 py-2.5 text-sm font-medium transition-colors ${
                  tab === t.valor ? "border-b-2 border-brand text-brand" : "text-muted hover:text-foreground"
                }`}
              >
                {t.etiqueta}
              </button>
            ))}
          </div>

          {tab === "historial" && (
            <Card>
              <h2 className="mb-4 text-sm font-semibold text-foreground">Historial ({eventosHistorial.length})</h2>
              {eventosHistorial.length === 0 ? (
                <p className="text-sm text-muted">Sin actividad todavía.</p>
              ) : (
                <div className="flex flex-col divide-y divide-border">
                  {eventosHistorial.map((ev) => {
                    const Icono = ICONO_EVENTO[ev.tipo];
                    return (
                      <button
                        key={ev.id}
                        type="button"
                        onClick={ev.onClick}
                        className="flex items-center justify-between gap-2 py-2.5 text-left text-sm hover:text-brand"
                      >
                        <div className="flex min-w-0 items-center gap-2">
                          <Icono className="h-3.5 w-3.5 shrink-0 text-muted" />
                          <div className="min-w-0">
                            <p className="truncate font-medium text-foreground">{ev.titulo}</p>
                            <p className="text-xs text-muted">{ev.fecha}</p>
                          </div>
                        </div>
                        <Badge value={ev.badgeValue} />
                      </button>
                    );
                  })}
                </div>
              )}
            </Card>
          )}

          {tab === "equipos" && (
            <Card>
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-foreground">Equipos ({cliente.equipos.length})</h2>
                <Link href="/dashboard/registros/equipos" className={buttonClass("outline")}>
                  <IconPlus className="h-4 w-4" />
                  Nuevo Equipo
                </Link>
              </div>
              {cliente.equipos.length === 0 ? (
                <p className="text-sm text-muted">Sin equipos registrados para este cliente.</p>
              ) : (
                <div className="flex flex-col divide-y divide-border">
                  {cliente.equipos.map((e) => (
                    <button
                      key={e.id}
                      type="button"
                      onClick={() => router.push(`/dashboard/registros/equipos/${e.id}`)}
                      className="flex items-center justify-between py-2.5 text-left text-sm hover:text-brand"
                    >
                      <div>
                        <p className="font-medium text-foreground">{e.nombre}</p>
                        <p className="text-xs text-muted">{[e.categoria, e.marca, e.modelo].filter(Boolean).join(" · ") || "—"}</p>
                      </div>
                      <Badge value={e.activo ? "activo" : "inactivo"} />
                    </button>
                  ))}
                </div>
              )}
            </Card>
          )}

          {tab === "financiero" && (
            <Card>
              <h2 className="mb-4 text-sm font-semibold text-foreground">Cobros ({cliente.facturas.length})</h2>
              {cliente.facturas.length === 0 ? (
                <p className="text-sm text-muted">Sin cobros todavía.</p>
              ) : (
                <div className="flex flex-col divide-y divide-border">
                  {cliente.facturas.map((f) => (
                    <div key={f.id} className="flex items-center justify-between py-2.5 text-sm">
                      <div>
                        <p className="font-medium text-foreground">Factura</p>
                        <p className="text-xs text-muted">
                          Emitida {f.fecha_emision} · Vence {f.fecha_vencimiento}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-foreground">{formatMoneda(f.monto, usuario.moneda)}</span>
                        <Badge value={f.estado} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          )}
        </>
      )}
    </DashboardShell>
  );
}
