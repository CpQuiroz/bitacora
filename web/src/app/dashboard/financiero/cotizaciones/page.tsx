"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { EstadoPresupuesto, Presupuesto } from "@bitacora/shared";
import { supabase } from "@/lib/supabase";
import { apiFetch } from "@/lib/api";
import { formatMoneda } from "@/lib/formatMoneda";
import { DashboardShell, type UsuarioShell } from "@/components/DashboardShell";
import { Badge, Button, Card, Cifra, ErrorText, Input, PageHeader } from "@/components/ui";
import { IconPlus, IconReceipt } from "@/components/icons";
import { EstadoCargando, EstadoVacio } from "@/components/estados";

type CotizacionConCliente = Presupuesto & { cliente_info: { nombre: string } | null };
type Chip = "todos" | EstadoPresupuesto;

// Bloque I: "expirado" ya es un estado real y persistido (el backend
// lo marca solo al cargar el listado — ver marcarCotizacionesExpiradas
// en cotizaciones.ts) — antes esto se calculaba acá en el frontend
// sin guardar nada, con el nombre "vencida".
const CHIPS: { valor: Chip; etiqueta: string }[] = [
  { valor: "todos", etiqueta: "Todos" },
  { valor: "borrador", etiqueta: "Borrador" },
  { valor: "enviado", etiqueta: "Enviada" },
  { valor: "aprobado", etiqueta: "Aprobada" },
  { valor: "rechazado", etiqueta: "Rechazada" },
  { valor: "expirado", etiqueta: "Expirada" },
];

export default function CotizacionesPage() {
  const router = useRouter();
  const [usuario, setUsuario] = useState<UsuarioShell | null>(null);
  const [cotizaciones, setCotizaciones] = useState<CotizacionConCliente[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState("");
  const [filtro, setFiltro] = useState<Chip>("todos");

  async function cargar() {
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      router.replace("/login");
      return;
    }
    const [resMe, resCotizaciones] = await Promise.all([apiFetch("/api/me"), apiFetch("/api/cotizaciones")]);
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
    if (!resCotizaciones.ok) {
      setError("No se pudieron cargar las cotizaciones");
      return;
    }
    setCotizaciones(await resCotizaciones.json());
  }

  useEffect(() => {
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!usuario) return null;

  const lista = cotizaciones ?? [];
  const contadores: Record<Chip, number> = {
    todos: lista.length,
    borrador: lista.filter((c) => c.estado === "borrador").length,
    enviado: lista.filter((c) => c.estado === "enviado").length,
    aprobado: lista.filter((c) => c.estado === "aprobado").length,
    rechazado: lista.filter((c) => c.estado === "rechazado").length,
    expirado: lista.filter((c) => c.estado === "expirado").length,
  };

  const filtradas = lista.filter((c) => {
    const q = busqueda.trim().toLowerCase();
    if (q && !(c.cliente_info?.nombre ?? "").toLowerCase().includes(q) && !(c.descripcion ?? "").toLowerCase().includes(q) && !String(c.numero ?? "").includes(q)) {
      return false;
    }
    if (filtro === "todos") return true;
    return c.estado === filtro;
  });

  return (
    <DashboardShell usuario={usuario}>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <PageHeader title="Cotizaciones" subtitle="Gestiona tus cotizaciones y da seguimiento a las aprobaciones" />
        <Button type="button" onClick={() => router.push("/dashboard/financiero/cotizaciones/nueva")}>
          <IconPlus className="h-4 w-4" />
          Nueva Cotización
        </Button>
      </div>

      <div className="mb-4 flex flex-col gap-3">
        <Input type="text" placeholder="Buscar cotizaciones..." value={busqueda} onChange={(e) => setBusqueda(e.target.value)} className="max-w-sm" />
        <div className="flex flex-wrap gap-2">
          {CHIPS.map((c) => (
            <button
              key={c.valor}
              type="button"
              onClick={() => setFiltro(c.valor)}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                filtro === c.valor ? "border-brand bg-brand-soft text-brand" : "border-border text-muted hover:border-muted-soft"
              }`}
            >
              {c.etiqueta} ({contadores[c.valor]})
            </button>
          ))}
        </div>
      </div>

      {error && <ErrorText>{error}</ErrorText>}
      {cotizaciones === null && !error && <EstadoCargando />}

      {cotizaciones?.length === 0 && (
        <EstadoVacio
          icono={IconReceipt}
          titulo="Ninguna cotización registrada"
          mensaje="Crea tu primera cotización para comenzar"
          accion={<Button type="button" onClick={() => router.push("/dashboard/financiero/cotizaciones/nueva")}>
              <IconPlus className="h-4 w-4" />
              Nueva Cotización
            </Button>}
        />
      )}

      {cotizaciones && cotizaciones.length > 0 && filtradas.length === 0 && (
        <EstadoVacio icono={IconReceipt} titulo="Ninguna cotización coincide con la búsqueda o el filtro" />
      )}

      {filtradas.length > 0 && (
        <Card className="overflow-x-auto p-0">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border bg-surface-sunken font-mono text-[10px] uppercase tracking-[0.1em] text-muted">
                <th className="px-5 py-3 font-medium">N°</th>
                <th className="px-5 py-3 font-medium">Cliente</th>
                <th className="px-5 py-3 text-right font-medium">Monto</th>
                <th className="px-5 py-3 font-medium">Estado</th>
                <th className="px-5 py-3 font-medium">Creación</th>
                <th className="px-5 py-3 font-medium">Vencimiento</th>
              </tr>
            </thead>
            <tbody>
              {filtradas.map((c) => (
                <tr
                  key={c.id}
                  onClick={() => router.push(`/dashboard/financiero/cotizaciones/${c.id}`)}
                  className="cursor-pointer border-b border-border-soft last:border-0 hover:bg-surface-sunken"
                >
                  <td className="px-5 py-3 font-medium text-foreground">{c.numero != null ? `#${String(c.numero).padStart(4, "0")}` : "—"}</td>
                  <td className="px-5 py-3 text-foreground">{c.cliente_info?.nombre ?? "—"}</td>
                  <td className="px-5 py-3 text-right"><Cifra>{formatMoneda(c.monto, usuario.moneda)}</Cifra></td>
                  <td className="px-5 py-3">
                    <Badge value={c.estado} />
                  </td>
                  <td className="px-5 py-3 text-muted">{c.fecha}</td>
                  <td className="px-5 py-3 text-muted">{c.fecha_vencimiento ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </DashboardShell>
  );
}
