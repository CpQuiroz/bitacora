"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import type { Cliente, Factura, Presupuesto, Trabajo, OrdenServicio } from "@bitacora/shared";
import { supabase } from "@/lib/supabase";
import { apiFetch } from "@/lib/api";
import { formatMoneda } from "@/lib/formatMoneda";
import { DashboardShell, type UsuarioShell } from "@/components/DashboardShell";
import { Badge, Button, Card, ErrorText, Input, Label, PageHeader, SuccessText } from "@/components/ui";
import { IconChevronLeft, IconMapPin } from "@/components/icons";

type TrabajoConOrden = Trabajo & { orden: Pick<OrdenServicio, "folio" | "estado_os"> | null };
type ClienteDetalle = Cliente & { trabajos: TrabajoConOrden[]; presupuestos: Presupuesto[]; facturas: Factura[] };

export default function ClienteDetallePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [usuario, setUsuario] = useState<UsuarioShell | null>(null);
  const [cliente, setCliente] = useState<ClienteDetalle | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [editando, setEditando] = useState(false);
  const [nombre, setNombre] = useState("");
  const [telefono, setTelefono] = useState("");
  const [correo, setCorreo] = useState("");
  const [direccion, setDireccion] = useState("");
  const [comuna, setComuna] = useState("");
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
    setTelefono(c.telefono ?? "");
    setCorreo(c.correo ?? "");
    setDireccion(c.direccion);
    setComuna(c.comuna ?? "");
  }, [params.id, router]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  async function onGuardar() {
    setErrorForm(null);
    setAviso(null);
    setGuardando(true);
    const res = await apiFetch(`/api/clientes/${params.id}`, {
      method: "PATCH",
      body: JSON.stringify({ nombre, telefono, correo, direccion, comuna }),
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
                <Button type="button" variant="outline" onClick={onAlternarActivo}>
                  {cliente.activo ? "Desactivar" : "Activar"}
                </Button>
                <Button type="button" variant="outline" onClick={() => setEditando((v) => !v)}>
                  {editando ? "Cerrar" : "Editar"}
                </Button>
              </div>
            }
          />

          {editando && (
            <Card className="my-6">
              <h2 className="mb-4 text-sm font-semibold text-foreground">Editar datos</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label>Nombre</Label>
                  <Input type="text" value={nombre} onChange={(e) => setNombre(e.target.value)} />
                </div>
                <div>
                  <Label>Teléfono</Label>
                  <Input type="text" value={telefono} onChange={(e) => setTelefono(e.target.value)} />
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
                <p className="text-xs text-muted">Teléfono</p>
                <p className="text-foreground">{cliente.telefono ?? "—"}</p>
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

          <Card className="my-6">
            <h2 className="mb-4 text-sm font-semibold text-foreground">Órdenes de servicio ({cliente.trabajos.length})</h2>
            {cliente.trabajos.length === 0 ? (
              <p className="text-sm text-muted">Sin OS todavía.</p>
            ) : (
              <div className="flex flex-col divide-y divide-border">
                {cliente.trabajos.map((t) => (
                  <div key={t.id} className="flex items-center justify-between py-2.5 text-sm">
                    <div>
                      <p className="font-medium text-foreground">
                        {t.orden?.folio != null ? `OS N° ${t.orden.folio}` : t.descripcion || t.codigo || "Sin folio"}
                      </p>
                      <p className="text-xs text-muted">{t.fecha}</p>
                    </div>
                    <Badge value={t.orden?.estado_os ?? t.estado} />
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card className="my-6">
            <h2 className="mb-4 text-sm font-semibold text-foreground">Cotizaciones ({cliente.presupuestos.length})</h2>
            {cliente.presupuestos.length === 0 ? (
              <p className="text-sm text-muted">Sin cotizaciones todavía.</p>
            ) : (
              <div className="flex flex-col divide-y divide-border">
                {cliente.presupuestos.map((p) => (
                  <div key={p.id} className="flex items-center justify-between py-2.5 text-sm">
                    <div>
                      <p className="font-medium text-foreground">{p.descripcion || "Cotización"}</p>
                      <p className="text-xs text-muted">{p.fecha}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-foreground">{formatMoneda(p.monto, usuario.moneda)}</span>
                      <Badge value={p.estado} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card className="my-6">
            <h2 className="mb-4 text-sm font-semibold text-foreground">Cobranzas ({cliente.facturas.length})</h2>
            {cliente.facturas.length === 0 ? (
              <p className="text-sm text-muted">Sin cobranzas todavía.</p>
            ) : (
              <div className="flex flex-col divide-y divide-border">
                {cliente.facturas.map((f) => (
                  <div key={f.id} className="flex items-center justify-between py-2.5 text-sm">
                    <div>
                      <p className="font-medium text-foreground">Factura</p>
                      <p className="text-xs text-muted">Vence {f.fecha_vencimiento}</p>
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
        </>
      )}
    </DashboardShell>
  );
}
