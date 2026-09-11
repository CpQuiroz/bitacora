"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Receipt } from "lucide-react";
import type { EstadoPresupuesto, Presupuesto } from "@bitacora/shared";
import { supabase } from "@/lib/supabase";
import { apiFetch } from "@/lib/api";
import { formatMoneda } from "@/lib/formatMoneda";
import { DashboardShell, type UsuarioShell } from "@/components/DashboardShell";
import { Button, Cifra, EmptyState, ErrorState, Input, LoadingState, StatusBadge, Table, type TonoEstado } from "@bitacora/ui/web";

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

// "borrador"/"enviado" no están en MAPA_ESTADO_TONO (ambiguos a propósito
// — ver el comentario en tipos.ts), se fuerza el tono en vez de dejarlos
// caer al fallback "cerrado".
const TONO_FORZADO: Partial<Record<EstadoPresupuesto, TonoEstado>> = {
  borrador: "en_progreso",
  enviado: "en_progreso",
};

// PASO 6 (sistema de diseño) — migrado. Ver docs/design-system.md.
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
      <div className="mb-ds-6 flex flex-wrap items-center justify-between gap-ds-3">
        <div>
          <p className="ds-heading text-ds-h2 text-ds-text">Cotizaciones</p>
          <p className="mt-ds-1 font-ds-body text-ds-small text-ds-text/70">Gestiona tus cotizaciones y da seguimiento a las aprobaciones</p>
        </div>
        <Button iconoIzq={<Plus size={16} strokeWidth={2.75} />} onPress={() => router.push("/dashboard/financiero/cotizaciones/nueva")}>
          Nueva Cotización
        </Button>
      </div>

      <div className="mb-ds-4 flex flex-col gap-ds-3">
        <div className="max-w-sm">
          <Input placeholder="Buscar cotizaciones..." valor={busqueda} onCambio={setBusqueda} />
        </div>
        <div className="flex flex-wrap gap-ds-2">
          {CHIPS.map((c) => (
            <button
              key={c.valor}
              type="button"
              onClick={() => setFiltro(c.valor)}
              className={`rounded-ds-pill border px-ds-3 py-1 font-ds-body text-ds-caption font-medium transition-colors ${
                filtro === c.valor ? "border-ds-brand bg-ds-brand/[0.08] text-ds-brand" : "border-ds-divider text-ds-text/70 hover:border-ds-text/30"
              }`}
            >
              {c.etiqueta} ({contadores[c.valor]})
            </button>
          ))}
        </div>
      </div>

      {error ? <ErrorState mensaje={error} /> : null}
      {cotizaciones === null && !error ? <LoadingState /> : null}

      {cotizaciones?.length === 0 && (
        <EmptyState
          icono={<Receipt size={28} strokeWidth={2.75} />}
          titulo="Ninguna cotización registrada"
          mensaje="Crea tu primera cotización para comenzar"
          accion={
            <Button iconoIzq={<Plus size={16} strokeWidth={2.75} />} onPress={() => router.push("/dashboard/financiero/cotizaciones/nueva")}>
              Nueva Cotización
            </Button>
          }
        />
      )}

      {cotizaciones && cotizaciones.length > 0 && filtradas.length === 0 && (
        <EmptyState icono={<Receipt size={28} strokeWidth={2.75} />} titulo="Ninguna cotización coincide con la búsqueda o el filtro" />
      )}

      {filtradas.length > 0 && (
        <Table<CotizacionConCliente>
          filas={filtradas}
          claveFila={(c) => c.id}
          onFilaClick={(c) => router.push(`/dashboard/financiero/cotizaciones/${c.id}`)}
          vacio={{ titulo: "Ninguna cotización coincide con la búsqueda o el filtro" }}
          columnas={[
            { encabezado: "N°", celda: (c) => (c.numero != null ? `#${String(c.numero).padStart(4, "0")}` : "—") },
            { encabezado: "Cliente", celda: (c) => c.cliente_info?.nombre ?? "—" },
            { encabezado: "Monto", clase: "text-right", celda: (c) => <Cifra>{formatMoneda(c.monto, usuario.moneda)}</Cifra> },
            { encabezado: "Estado", celda: (c) => <StatusBadge estado={c.estado} tonoForzado={TONO_FORZADO[c.estado]} /> },
            { encabezado: "Creación", celda: (c) => c.fecha },
            { encabezado: "Vencimiento", celda: (c) => c.fecha_vencimiento ?? "—" },
          ]}
        />
      )}
    </DashboardShell>
  );
}
