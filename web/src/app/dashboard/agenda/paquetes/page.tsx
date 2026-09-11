"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Box, Plus } from "lucide-react";
import type { Cliente, PaqueteSesionesConSaldo, TipoPack } from "@bitacora/shared";
import { supabase } from "@/lib/supabase";
import { apiFetch } from "@/lib/api";
import { DashboardShell, type UsuarioShell } from "@/components/DashboardShell";
import { Button, Card, EmptyState, ErrorState, Input, LoadingState, StatusBadge, Table } from "@bitacora/ui/web";
import { AsignarPackForm } from "@/components/AsignarPackForm";
import { formatMoneda } from "@/lib/formatMoneda";

type PaqueteListado = PaqueteSesionesConSaldo & { cliente: { nombre: string } | null };

// PASO 6 (sistema de diseño) — migrado. Ver docs/design-system.md.
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
      <div className="mb-ds-6 flex flex-wrap items-center justify-between gap-ds-3">
        <div>
          <p className="ds-heading text-ds-h2 text-ds-text">Paquetes de sesiones</p>
          <p className="mt-ds-1 font-ds-body text-ds-small text-ds-text/70">Packs de sesiones vendidos a tus clientes — Agenda Pro</p>
        </div>
        {!formAbierto && (
          <Button iconoIzq={<Plus size={16} strokeWidth={2.75} />} onPress={() => setFormAbierto(true)}>
            Nuevo Paquete
          </Button>
        )}
      </div>

      {formAbierto && (
        <div className="mb-ds-6">
          <Card>
            <p className="mb-ds-4 font-ds-body text-ds-small font-semibold text-ds-text">Nuevo paquete</p>
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
        </div>
      )}

      {renovando && (
        <div className="mb-ds-6">
          <Card>
            <p className="mb-ds-1 font-ds-body text-ds-small font-semibold text-ds-text">Renovar paquete</p>
            <p className="mb-ds-4 font-ds-body text-ds-caption text-ds-text/60">
              {renovando.cliente?.nombre ?? "Cliente"} · <span className="font-medium text-ds-text">{renovando.nombre}</span> —
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
        </div>
      )}

      {aviso ? <p className="mb-ds-6 font-ds-body text-ds-small font-medium text-ds-accent2-800">{aviso}</p> : null}

      <div className="mb-ds-4 max-w-sm">
        <Input placeholder="Buscar por cliente o nombre del paquete..." valor={busqueda} onCambio={setBusqueda} />
      </div>

      {error ? <ErrorState mensaje={error} /> : null}
      {paquetes === null && !error ? <LoadingState /> : null}

      {paquetes?.length === 0 && (
        <EmptyState
          icono={<Box size={28} strokeWidth={2.75} />}
          titulo="Ningún paquete registrado"
          mensaje="Crea el primer paquete de sesiones para un cliente"
          accion={
            <Button iconoIzq={<Plus size={16} strokeWidth={2.75} />} onPress={() => setFormAbierto(true)}>
              Nuevo Paquete
            </Button>
          }
        />
      )}

      {paquetes && paquetes.length > 0 && filtrados.length === 0 && (
        <EmptyState icono={<Box size={28} strokeWidth={2.75} />} titulo="Ningún paquete coincide con la búsqueda" />
      )}

      {filtrados.length > 0 && (
        <Table<PaqueteListado>
          filas={filtrados}
          claveFila={(p) => p.id}
          vacio={{ titulo: "Ningún paquete coincide con la búsqueda" }}
          columnas={[
            { encabezado: "Cliente", celda: (p) => p.cliente?.nombre ?? "—" },
            { encabezado: "Paquete", celda: (p) => p.nombre },
            { encabezado: "Saldo", celda: (p) => `${p.saldo} / ${p.cantidad_total}` },
            {
              encabezado: "Cobrado",
              celda: (p) => (p.precio_pagado != null ? formatMoneda(p.precio_pagado, usuario.moneda) : p.precio != null ? formatMoneda(p.precio, usuario.moneda) : "—"),
            },
            { encabezado: "Fecha de compra", celda: (p) => new Date(`${p.fecha_compra}T00:00:00`).toLocaleDateString("es-CL") },
            { encabezado: "Vence", celda: (p) => (p.vence_el ? new Date(`${p.vence_el}T00:00:00`).toLocaleDateString("es-CL") : "No vence") },
            { encabezado: "Notas", celda: (p) => p.notas || "—" },
            {
              encabezado: "Estado",
              celda: (p) => (
                <div className="flex items-center gap-ds-2">
                  <StatusBadge estado={p.saldo <= 0 ? "agotado" : "disponible"} />
                  {p.saldo <= 0 && !renovando && !formAbierto && (
                    <Button
                      variante="secundario"
                      onPress={() => {
                        setAviso(null);
                        setRenovando(p);
                      }}
                    >
                      Renovar
                    </Button>
                  )}
                </div>
              ),
            },
          ]}
        />
      )}

      <p className="mt-ds-4 font-ds-body text-ds-caption text-ds-text/60">
        El saldo se calcula a partir de las citas activas de cada paquete — no es un contador editable a mano. Para consumir sesiones
        de un paquete, asígnalo desde el formulario de una tarea en{" "}
        <Link href="/dashboard/agenda" className="font-medium text-ds-brand hover:underline">
          Agenda
        </Link>
        .
      </p>
    </DashboardShell>
  );
}
