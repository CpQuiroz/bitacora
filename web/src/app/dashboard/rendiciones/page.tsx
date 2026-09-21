"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { HandCoins } from "lucide-react";
import type { EstadoRendicion, Rendicion } from "@bitacora/shared";
import { formatearFolio } from "@bitacora/shared";
import { supabase } from "@/lib/supabase";
import { apiFetch } from "@/lib/api";
import { formatMoneda } from "@/lib/formatMoneda";
import { DashboardShell, type UsuarioShell } from "@/components/DashboardShell";
import { Card, EmptyState, ErrorState, LoadingState, Select, StatusBadge, Table, type TonoEstado } from "@bitacora/ui/web";

type RendicionConDatos = Rendicion & {
  colaborador: { id: string; nombre: string } | null;
  total_gastado: number;
  saldo: number;
};

const ETIQUETA_ESTADO: Record<EstadoRendicion, string> = {
  borrador: "Borrador",
  enviada: "Enviada",
  aprobada: "Aprobada",
  rechazada: "Rechazada",
};

// borrador/enviada/rechazada no están en MAPA_ESTADO_TONO (ambiguos a
// propósito, ver packages/ui/src/tipos.ts) — se fuerzan acá.
const TONO_ESTADO: Record<EstadoRendicion, TonoEstado> = {
  borrador: "cerrado",
  enviada: "en_progreso",
  aprobada: "completado",
  rechazada: "cancelado",
};

const ETIQUETA_PERIODO: Record<string, string> = { diario: "Diario", semanal: "Semanal" };

// PASO 6 (sistema de diseño). Fondo por rendir / caja chica —
// pedido 21-sep-2026. Sin formulario de creación acá a propósito: una
// rendición nace en el celular del colaborador (Más → Rendiciones);
// la web es donde gestión revisa/aprueba (ver [id]/page.tsx).
export default function RendicionesPage() {
  const router = useRouter();
  const [usuario, setUsuario] = useState<UsuarioShell | null>(null);
  const [rendiciones, setRendiciones] = useState<RendicionConDatos[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filtroEstado, setFiltroEstado] = useState<"todos" | EstadoRendicion>("todos");

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        router.replace("/login");
        return;
      }
      const [resMe, resRendiciones] = await Promise.all([apiFetch("/api/me"), apiFetch("/api/rendiciones")]);
      if (resMe.ok) {
        const { usuario: u } = await resMe.json();
        if (u)
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
      if (!resRendiciones.ok) {
        setError("No se pudieron cargar las rendiciones");
        return;
      }
      setRendiciones(await resRendiciones.json());
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!usuario) return null;

  const filtradas = (rendiciones ?? []).filter((r) => filtroEstado === "todos" || r.estado === filtroEstado);
  const totales = (rendiciones ?? []).reduce(
    (acc, r) => ({
      entregado: acc.entregado + Number(r.monto_entregado),
      gastado: acc.gastado + r.total_gastado,
      saldo: acc.saldo + r.saldo,
    }),
    { entregado: 0, gastado: 0, saldo: 0 }
  );

  return (
    <DashboardShell usuario={usuario}>
      <div className="mb-ds-6">
        <p className="ds-heading text-ds-h2 text-ds-text">Rendiciones</p>
        <p className="mt-ds-1 font-ds-body text-ds-small text-ds-text/70">
          Fondo por rendir entregado a colaboradores, reconciliado contra sus gastos de terreno
        </p>
      </div>

      <div className="mb-ds-6 grid gap-ds-4 sm:grid-cols-3">
        <Card>
          <p className="font-ds-body text-ds-caption text-ds-text/60">Total entregado</p>
          <p className="mt-ds-1 font-ds-body text-ds-h5 font-semibold text-ds-text">{formatMoneda(totales.entregado, usuario.moneda)}</p>
        </Card>
        <Card>
          <p className="font-ds-body text-ds-caption text-ds-text/60">Total gastado</p>
          <p className="mt-ds-1 font-ds-body text-ds-h5 font-semibold text-ds-text">{formatMoneda(totales.gastado, usuario.moneda)}</p>
        </Card>
        <Card>
          <p className="font-ds-body text-ds-caption text-ds-text/60">Saldo pendiente</p>
          <p className="mt-ds-1 font-ds-body text-ds-h5 font-semibold text-ds-text">{formatMoneda(totales.saldo, usuario.moneda)}</p>
        </Card>
      </div>

      <div className="mb-ds-4 max-w-xs">
        <Select
          etiqueta="Filtrar por estado"
          valor={filtroEstado}
          onCambio={(v) => setFiltroEstado(v as typeof filtroEstado)}
          opciones={[
            { valor: "todos", etiqueta: "Todos" },
            { valor: "borrador", etiqueta: "Borrador" },
            { valor: "enviada", etiqueta: "Enviada" },
            { valor: "aprobada", etiqueta: "Aprobada" },
            { valor: "rechazada", etiqueta: "Rechazada" },
          ]}
        />
      </div>

      {error ? <ErrorState mensaje={error} /> : null}
      {rendiciones === null && !error ? <LoadingState /> : null}
      {rendiciones && rendiciones.length === 0 ? (
        <EmptyState
          icono={<HandCoins size={28} strokeWidth={2.75} />}
          titulo="Todavía no hay rendiciones"
          mensaje="Se crean desde el celular (Más → Rendiciones)."
        />
      ) : null}
      {rendiciones && rendiciones.length > 0 && filtradas.length === 0 ? (
        <EmptyState icono={<HandCoins size={28} strokeWidth={2.75} />} titulo="Ninguna rendición coincide con el filtro" />
      ) : null}

      {filtradas.length > 0 && (
        <Table<RendicionConDatos>
          filas={filtradas}
          claveFila={(r) => r.id}
          vacio={{ titulo: "Ninguna rendición coincide con el filtro" }}
          columnas={[
            {
              encabezado: "Folio",
              celda: (r) => (
                <Link href={`/dashboard/rendiciones/${r.id}`} className="font-medium text-ds-text hover:text-ds-brand hover:underline">
                  {formatearFolio("REND", r.folio) ?? "—"}
                </Link>
              ),
            },
            { encabezado: "Colaborador", celda: (r) => r.colaborador?.nombre ?? "—" },
            { encabezado: "Período", celda: (r) => `${ETIQUETA_PERIODO[r.periodo] ?? r.periodo} · ${r.fecha_inicio} a ${r.fecha_termino}` },
            { encabezado: "Entregado", clase: "text-right", celda: (r) => formatMoneda(r.monto_entregado, usuario.moneda) },
            { encabezado: "Saldo", clase: "text-right", celda: (r) => formatMoneda(r.saldo, usuario.moneda) },
            {
              encabezado: "Estado",
              celda: (r) => <StatusBadge estado={r.estado} etiqueta={ETIQUETA_ESTADO[r.estado]} tonoForzado={TONO_ESTADO[r.estado]} />,
            },
          ]}
        />
      )}
    </DashboardShell>
  );
}
