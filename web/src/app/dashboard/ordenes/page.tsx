"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Cliente, EstadoOS, OrdenServicio, Trabajo, Usuario } from "@bitacora/shared";
import { supabase } from "@/lib/supabase";
import { apiFetch } from "@/lib/api";
import { abrirPdfOS } from "@/lib/descargarPdf";
import { DashboardShell, type UsuarioShell } from "@/components/DashboardShell";
import { Badge, Card, ErrorText, Label, Select, buttonClass } from "@/components/ui";
import { IconClipboardCheck, IconPlus } from "@/components/icons";

type OrdenListado = Trabajo & {
  cliente_info: { nombre: string } | null;
  responsable: { nombre: string } | null;
  orden: OrdenServicio | null;
};

const ESTADOS_OS: EstadoOS[] = ["enviada", "en_proceso", "completada", "firmada"];

export default function OrdenesServicioPage() {
  const router = useRouter();
  const [usuario, setUsuario] = useState<UsuarioShell | null>(null);
  const [equipo, setEquipo] = useState<Usuario[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [ordenes, setOrdenes] = useState<OrdenListado[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [estadoOs, setEstadoOs] = useState("");
  const [responsableId, setResponsableId] = useState("");
  const [clienteId, setClienteId] = useState("");
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");

  const cargarOrdenes = useCallback(async () => {
    setError(null);
    const params = new URLSearchParams();
    if (estadoOs) params.set("estado_os", estadoOs);
    if (responsableId) params.set("responsable_id", responsableId);
    if (clienteId) params.set("cliente_id", clienteId);
    if (desde) params.set("desde", desde);
    if (hasta) params.set("hasta", hasta);

    const res = await apiFetch(`/api/ordenes-servicio?${params.toString()}`);
    if (!res.ok) {
      setError("No se pudieron cargar las órdenes de servicio");
      return;
    }
    setOrdenes(await res.json());
  }, [estadoOs, responsableId, clienteId, desde, hasta]);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        router.replace("/login");
        return;
      }
      const [resMe, resEquipo, resClientes] = await Promise.all([
        apiFetch("/api/me"),
        apiFetch("/api/usuarios"),
        apiFetch("/api/clientes"),
      ]);
      if (resMe.ok) {
        const { usuario: u } = await resMe.json();
        if (u) setUsuario({ nombre: u.nombre, rol: u.rol, empresaNombre: u.empresa?.nombre ?? "", empresaLogoUrl: u.empresa?.logo_url ?? null, colorPrimario: u.empresa?.color_primario ?? null, colorPrimarioForeground: u.empresa?.color_primario_foreground ?? null, colorSecundario: u.empresa?.color_secundario ?? null, fuente: u.empresa?.fuente ?? null, moneda: u.empresa?.moneda ?? "CLP" });
      }
      if (resEquipo.ok) setEquipo(await resEquipo.json());
      if (resClientes.ok) setClientes(await resClientes.json());
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    cargarOrdenes();
  }, [cargarOrdenes]);

  if (!usuario) return null;

  return (
    <DashboardShell usuario={usuario}>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight text-foreground">
          <IconClipboardCheck className="h-6 w-6 text-brand" />
          Órdenes de Trabajo/Servicio
        </h1>
        <Link href="/dashboard/ordenes/nueva" className={buttonClass("primary")}>
          <IconPlus className="h-4 w-4" />
          Nueva OS
        </Link>
      </div>

      <Card className="mb-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <div>
            <Label>Estado</Label>
            <Select value={estadoOs} onChange={(e) => setEstadoOs(e.target.value)}>
              <option value="">Todos</option>
              {ESTADOS_OS.map((e) => (
                <option key={e} value={e}>
                  {e.replace("_", " ")}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label>Colaborador</Label>
            <Select value={responsableId} onChange={(e) => setResponsableId(e.target.value)}>
              <option value="">Todos</option>
              {equipo.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.nombre}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label>Cliente</Label>
            <Select value={clienteId} onChange={(e) => setClienteId(e.target.value)}>
              <option value="">Todos</option>
              {clientes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label>Desde</Label>
            <input
              type="date"
              value={desde}
              onChange={(e) => setDesde(e.target.value)}
              className="w-full rounded-lg border border-border bg-surface px-3.5 py-2.5 text-sm text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
            />
          </div>
          <div>
            <Label>Hasta</Label>
            <input
              type="date"
              value={hasta}
              onChange={(e) => setHasta(e.target.value)}
              className="w-full rounded-lg border border-border bg-surface px-3.5 py-2.5 text-sm text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
            />
          </div>
        </div>
      </Card>

      {error && <ErrorText>{error}</ErrorText>}
      {ordenes === null && !error && <p className="text-sm text-muted">Cargando…</p>}
      {ordenes?.length === 0 && (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border py-16 text-center">
          <IconClipboardCheck className="h-8 w-8 text-muted" />
          <p className="text-sm text-muted">No hay órdenes de servicio con estos filtros.</p>
        </div>
      )}
      {ordenes && ordenes.length > 0 && (
        <Card className="overflow-x-auto p-0">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border text-xs text-muted">
                <th className="px-5 py-3 font-medium">Folio</th>
                <th className="px-5 py-3 font-medium">Cliente</th>
                <th className="px-5 py-3 font-medium">Colaborador</th>
                <th className="px-5 py-3 font-medium">Fecha</th>
                <th className="px-5 py-3 font-medium">Estado</th>
                <th className="px-5 py-3 font-medium">PDF</th>
              </tr>
            </thead>
            <tbody>
              {ordenes.map((o) => (
                <tr
                  key={o.id}
                  onClick={() => router.push(`/dashboard/ordenes/${o.id}`)}
                  className="cursor-pointer border-b border-border last:border-0 hover:bg-brand-soft/40"
                >
                  <td className="px-5 py-3 font-medium text-foreground">
                    {o.orden?.folio != null ? `N° ${o.orden.folio}` : "—"}
                  </td>
                  <td className="px-5 py-3">{o.cliente_info?.nombre ?? o.cliente}</td>
                  <td className="px-5 py-3">{o.responsable?.nombre ?? "—"}</td>
                  <td className="px-5 py-3">
                    {o.fecha}
                    {o.hora_programada ? ` ${o.hora_programada}` : ""}
                  </td>
                  <td className="px-5 py-3">
                    <Badge value={o.orden?.estado_os ?? "pendiente"} />
                  </td>
                  <td className="px-5 py-3">
                    {o.orden?.estado_os === "firmada" ? (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          abrirPdfOS(o.id);
                        }}
                        className="font-medium text-brand hover:underline"
                      >
                        Ver PDF
                      </button>
                    ) : (
                      <span className="text-muted">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </DashboardShell>
  );
}
