"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { AgruparViaticos, FilaResumenViaticos } from "@bitacora/shared";
import { supabase } from "@/lib/supabase";
import { apiFetch, exigirOk } from "@/lib/api";
import { formatMoneda } from "@/lib/formatMoneda";
import { DashboardShell, type UsuarioShell } from "@/components/DashboardShell";
import { GastosSubnav } from "@/components/GastosSubnav";
import { Button, Card, DatePicker, ErrorState, LoadingState, Select, Table, useDeshacer } from "@bitacora/ui/web";

// Gastos › Viáticos (tarea 137): cuánto hay que pagarle a cada chofer
// por semana o por mes. Cada viático es un gasto "Viáticos" ligado a un
// viaje; el chofer es el del viaje. "Marcar pagado" pasa a pagados los
// pendientes de ese chofer en ese período (se deshace por gasto en Gastos).
const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

function hoy(): string {
  return aTexto(new Date());
}
function inicioMes(): string {
  const d = new Date();
  return aTexto(new Date(d.getFullYear(), d.getMonth(), 1));
}
function sumarDias(fecha: string, dias: number): string {
  const d = aFecha(fecha)!;
  d.setDate(d.getDate() + dias);
  return aTexto(d);
}
function finDelPeriodo(periodo: string, agrupar: AgruparViaticos): string {
  if (agrupar === "semana") return sumarDias(periodo, 6);
  const d = aFecha(periodo)!;
  return aTexto(new Date(d.getFullYear(), d.getMonth() + 1, 0));
}
// La primera semana puede empezar antes del filtro "desde" (ej. lunes
// 31-08 con desde 01-09): se rotula desde el primer día que sí suma.
function etiquetaPeriodo(periodo: string, agrupar: AgruparViaticos, desde: string): string {
  const [y, m] = periodo.split("-");
  if (agrupar === "mes") return `${MESES[Number(m) - 1]} ${y}`;
  const inicio = periodo < desde ? desde : periodo;
  return `Semana del ${inicio.split("-").reverse().join("-")}`;
}

export default function ViaticosPage() {
  const router = useRouter();
  const [usuario, setUsuario] = useState<UsuarioShell | null>(null);
  const [desde, setDesde] = useState(inicioMes);
  const [hasta, setHasta] = useState(hoy);
  const [agrupar, setAgrupar] = useState<AgruparViaticos>("semana");
  const [filas, setFilas] = useState<FilaResumenViaticos[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const conDeshacer = useDeshacer();

  async function cargarResumen() {
    setError(null);
    const res = await apiFetch(`/api/gastos/viaticos?desde=${desde}&hasta=${hasta}&agrupar=${agrupar}`);
    const body = await res.json().catch(() => null);
    if (!res.ok) {
      setError(body?.error ?? "No se pudieron cargar los viáticos");
      setFilas([]);
      return;
    }
    setFilas(body);
  }

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        router.replace("/login");
        return;
      }
      const resMe = await apiFetch("/api/me");
      if (!resMe.ok) return;
      const { usuario: u } = await resMe.json();
      if (!u) return;
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
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (desde && hasta) cargarResumen();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [desde, hasta, agrupar]);

  const totales = useMemo(
    () => (filas ?? []).reduce((t, f) => ({ total: t.total + f.total, pendiente: t.pendiente + f.pendiente, pagado: t.pagado + f.pagado }), { total: 0, pendiente: 0, pagado: 0 }),
    [filas]
  );

  function marcarPagado(f: FilaResumenViaticos) {
    if (!f.chofer_id) return;
    // El período se recorta al rango filtrado: solo se paga lo que se ve.
    const d = f.periodo > desde ? f.periodo : desde;
    const fin = finDelPeriodo(f.periodo, agrupar);
    const h = fin < hasta ? fin : hasta;
    const clave = (x: FilaResumenViaticos) => `${x.periodo}|${x.chofer_id}`;
    conDeshacer({
      mensaje: `${formatMoneda(f.pendiente, usuario?.moneda)} de viáticos a ${f.chofer} marcados como pagados`,
      ocultar: () => setFilas((l) => l?.map((x) => (clave(x) === clave(f) ? { ...x, pendiente: 0, pagado: x.pagado + x.pendiente } : x)) ?? l),
      restaurar: () => setFilas((l) => l?.map((x) => (clave(x) === clave(f) ? f : x)) ?? l),
      ejecutar: async () =>
        exigirOk(
          await apiFetch("/api/gastos/viaticos/pagar", { method: "POST", body: JSON.stringify({ chofer_id: f.chofer_id, desde: d, hasta: h }) }),
          "No se pudo marcar como pagado"
        ),
    });
  }

  if (!usuario) return null;

  return (
    <DashboardShell usuario={usuario}>
      <GastosSubnav activo="viaticos" />
      <div className="mb-ds-6">
        <p className="ds-heading text-ds-h2 text-ds-text">Viáticos</p>
        <p className="mt-ds-1 font-ds-body text-ds-small text-ds-text/70">
          Lo que corresponde pagar a cada chofer por sus viajes. Los montos por defecto se ajustan en{" "}
          <Link href="/dashboard/configuracion/viajes" className="text-ds-brand hover:underline">
            Configuración › Viajes
          </Link>
          .
        </p>
      </div>

      <Card>
        <div className="grid gap-ds-4 sm:grid-cols-3">
          <DatePicker etiqueta="Desde" valor={aFecha(desde)} onCambio={(f) => setDesde(aTexto(f))} />
          <DatePicker etiqueta="Hasta" valor={aFecha(hasta)} onCambio={(f) => setHasta(aTexto(f))} />
          <Select
            etiqueta="Agrupar por"
            valor={agrupar}
            onCambio={(v) => setAgrupar(v as AgruparViaticos)}
            opciones={[
              { valor: "semana", etiqueta: "Semana" },
              { valor: "mes", etiqueta: "Mes" },
            ]}
          />
        </div>
        <div className="mt-ds-4 flex flex-wrap gap-ds-6 font-ds-body text-ds-small text-ds-text">
          <span>
            Total: <strong className="tabular-nums">{formatMoneda(totales.total, usuario.moneda)}</strong>
          </span>
          <span>
            Por pagar: <strong className="tabular-nums">{formatMoneda(totales.pendiente, usuario.moneda)}</strong>
          </span>
          <span>
            Pagado: <strong className="tabular-nums">{formatMoneda(totales.pagado, usuario.moneda)}</strong>
          </span>
        </div>
      </Card>


      <div className="mt-ds-6">
        {error ? (
          <ErrorState titulo="No se pudieron cargar los viáticos" mensaje={error} />
        ) : filas === null ? (
          <LoadingState />
        ) : (
          <Table<FilaResumenViaticos>
            filas={filas}
            claveFila={(f) => `${f.periodo}|${f.chofer_id ?? ""}`}
            vacio={{ titulo: "Sin viáticos en este período", mensaje: "Se registran al asignar un viático a un viaje (Viajes › Editar)." }}
            columnas={[
              { encabezado: "Período", celda: (f) => etiquetaPeriodo(f.periodo, agrupar, desde) },
              { encabezado: "Chofer", celda: (f) => f.chofer },
              { encabezado: "Viajes", clase: "text-right", celda: (f) => f.cantidad },
              { encabezado: "Total", clase: "text-right", celda: (f) => formatMoneda(f.total, usuario.moneda) },
              { encabezado: "Por pagar", clase: "text-right", celda: (f) => formatMoneda(f.pendiente, usuario.moneda) },
              { encabezado: "Pagado", clase: "text-right", celda: (f) => formatMoneda(f.pagado, usuario.moneda) },
              {
                encabezado: "",
                celda: (f) =>
                  f.pendiente > 0 && f.chofer_id ? (
                    <Button variante="secundario" onPress={() => marcarPagado(f)}>
                      Marcar pagado
                    </Button>
                  ) : null,
              },
            ]}
          />
        )}
      </div>
    </DashboardShell>
  );
}

// DatePicker (packages/ui) trabaja con Date — mismo par de helpers que
// gastos/page.tsx.
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
