"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Cliente, PaqueteSesionesConSaldo, TipoPack } from "@bitacora/shared";
import { supabase } from "@/lib/supabase";
import { apiFetch } from "@/lib/api";
import { DashboardShell, type UsuarioShell } from "@/components/DashboardShell";
import { Badge, Button, Card, ErrorText, Input, PageHeader, SuccessText } from "@/components/ui";
import { AsignarPackForm } from "@/components/AsignarPackForm";
import { formatMoneda } from "@/lib/formatMoneda";
import { IconBox, IconPlus } from "@/components/icons";
import { EstadoCargando, EstadoVacio } from "@/components/estados";

type PaqueteListado = PaqueteSesionesConSaldo & { cliente: { nombre: string } | null };

export default function PaquetesSesionesPage() {
  const router = useRouter();
  const [usuario, setUsuario] = useState<UsuarioShell | null>(null);
  const [paquetes, setPaquetes] = useState<PaqueteListado[] | null>(null);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [tiposPack, setTiposPack] = useState<TipoPack[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState("");

  const [formAbierto, setFormAbierto] = useState(false);
  // Pack agotado que se está renovando (precarga el form).
  const [renovando, setRenovando] = useState<PaqueteListado | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  async function cargar() {
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      router.replace("/login");
      return;
    }
    const [resMe, resPaquetes, resClientes, resTiposPack] = await Promise.all([
      apiFetch("/api/me"),
      apiFetch("/api/paquetes-sesiones"),
      apiFetch("/api/clientes"),
      apiFetch("/api/tipos-pack?activo=1"),
    ]);
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
    if (resTiposPack.ok) setTiposPack(await resTiposPack.json());
    if (!resPaquetes.ok) {
      setError("No se pudieron cargar los paquetes de sesiones");
      return;
    }
    setPaquetes(await resPaquetes.json());
  }

  useEffect(() => {
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtrados = useMemo(() => {
    if (!paquetes) return [];
    const q = busqueda.trim().toLowerCase();
    if (!q) return paquetes;
    return paquetes.filter((p) => p.nombre.toLowerCase().includes(q) || (p.cliente?.nombre ?? "").toLowerCase().includes(q));
  }, [paquetes, busqueda]);

  if (!usuario) return null;

  return (
    <DashboardShell usuario={usuario}>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <PageHeader title="Paquetes de sesiones" subtitle="Packs de sesiones vendidos a tus clientes — Agenda Pro" />
        {!formAbierto && (
          <Button type="button" onClick={() => setFormAbierto(true)}>
            <IconPlus className="h-4 w-4" />
            Nuevo Paquete
          </Button>
        )}
      </div>

      {formAbierto && (
        <Card className="mb-6">
          <h2 className="mb-4 text-sm font-semibold text-foreground">Nuevo paquete</h2>
          <AsignarPackForm
            clientes={clientes}
            onClienteCreado={(c) => setClientes((prev) => [...prev, c])}
            tiposPack={tiposPack}
            moneda={usuario.moneda ?? "CLP"}
            onAsignado={() => {
              setFormAbierto(false);
              setAviso("Paquete creado.");
              cargar();
            }}
            onCancelar={() => setFormAbierto(false)}
          />
        </Card>
      )}

      {renovando && (
        <Card className="mb-6">
          <h2 className="mb-1 text-sm font-semibold text-foreground">Renovar paquete</h2>
          <p className="mb-4 text-xs text-muted">
            {renovando.cliente?.nombre ?? "Cliente"} · <span className="font-medium text-foreground">{renovando.nombre}</span> —
            mismo servicio y cantidad. Ajusta el precio si corresponde.
          </p>
          <AsignarPackForm
            clienteId={renovando.cliente_id ?? undefined}
            tiposPack={tiposPack}
            moneda={usuario.moneda ?? "CLP"}
            inicial={{
              tipoPackId:
                renovando.tipo_pack_id && tiposPack.some((t) => t.id === renovando.tipo_pack_id)
                  ? renovando.tipo_pack_id
                  : undefined,
              nombre: renovando.nombre,
              cantidadTotal: renovando.cantidad_total,
              precioPagado: renovando.precio_pagado != null ? String(renovando.precio_pagado) : "",
            }}
            onAsignado={() => {
              setRenovando(null);
              setAviso("Paquete renovado.");
              cargar();
            }}
            onCancelar={() => setRenovando(null)}
          />
        </Card>
      )}

      {aviso && (
        <div className="mb-6">
          <SuccessText>{aviso}</SuccessText>
        </div>
      )}

      <div className="mb-4">
        <Input type="text" placeholder="Buscar por cliente o nombre del paquete..." value={busqueda} onChange={(e) => setBusqueda(e.target.value)} className="max-w-sm" />
      </div>

      {error && <ErrorText>{error}</ErrorText>}
      {paquetes === null && !error && <EstadoCargando />}

      {paquetes?.length === 0 && (
        <EstadoVacio
          icono={IconBox}
          titulo="Ningún paquete registrado"
          mensaje="Crea el primer paquete de sesiones para un cliente"
          accion={<Button type="button" onClick={() => setFormAbierto(true)}>
              <IconPlus className="h-4 w-4" />
              Nuevo Paquete
            </Button>}
        />
      )}

      {paquetes && paquetes.length > 0 && filtrados.length === 0 && (
        <EstadoVacio icono={IconBox} titulo="Ningún paquete coincide con la búsqueda" />
      )}

      {filtrados.length > 0 && (
        <Card className="overflow-x-auto p-0">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border bg-surface-sunken font-mono text-[10px] uppercase tracking-[0.1em] text-muted">
                <th className="px-5 py-3 font-medium">Cliente</th>
                <th className="px-5 py-3 font-medium">Paquete</th>
                <th className="px-5 py-3 font-medium">Saldo</th>
                <th className="px-5 py-3 font-medium">Cobrado</th>
                <th className="px-5 py-3 font-medium">Fecha de compra</th>
                <th className="px-5 py-3 font-medium">Vence</th>
                <th className="px-5 py-3 font-medium">Notas</th>
                <th className="px-5 py-3 font-medium">Estado</th>
              </tr>
            </thead>
            <tbody>
              {filtrados.map((p) => (
                <tr key={p.id} className="border-b border-border-soft last:border-0 hover:bg-surface-sunken">
                  <td className="px-5 py-3 font-medium text-foreground">{p.cliente?.nombre ?? "—"}</td>
                  <td className="px-5 py-3 text-foreground">{p.nombre}</td>
                  <td className="px-5 py-3 text-foreground">
                    {p.saldo} / {p.cantidad_total}
                  </td>
                  <td className="px-5 py-3 text-muted">
                    {p.precio_pagado != null
                      ? formatMoneda(p.precio_pagado, usuario.moneda)
                      : p.precio != null
                        ? formatMoneda(p.precio, usuario.moneda)
                        : "—"}
                  </td>
                  <td className="px-5 py-3 text-muted">{new Date(`${p.fecha_compra}T00:00:00`).toLocaleDateString("es-CL")}</td>
                  <td className="px-5 py-3 text-muted">
                    {p.vence_el ? new Date(`${p.vence_el}T00:00:00`).toLocaleDateString("es-CL") : "No vence"}
                  </td>
                  <td className="px-5 py-3 text-muted">{p.notas || "—"}</td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      <Badge value={p.saldo <= 0 ? "agotado" : "disponible"} />
                      {p.saldo <= 0 && !renovando && !formAbierto && (
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => {
                            setAviso(null);
                            setRenovando(p);
                          }}
                        >
                          Renovar
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      <p className="mt-4 text-xs text-muted">
        El saldo se calcula a partir de las citas activas de cada paquete — no es un contador editable a mano. Para consumir sesiones
        de un paquete, asígnalo desde el formulario de una tarea en{" "}
        <Link href="/dashboard/agenda" className="font-medium text-brand hover:underline">
          Agenda
        </Link>
        .
      </p>
    </DashboardShell>
  );
}
