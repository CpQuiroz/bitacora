"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Briefcase, MapPin, Plus, Receipt, Route, Sparkle, Tag, Wallet, ClipboardCheck } from "lucide-react";
import type { Empresa, Modulo, Usuario } from "@bitacora/shared";
import { puedeVerModulo } from "@bitacora/shared";
import { supabase } from "@/lib/supabase";
import { apiFetch } from "@/lib/api";
import { formatMoneda } from "@/lib/formatMoneda";
import { DashboardShell } from "@/components/DashboardShell";
import { Button, Card, Cifra, DatePicker, LoadingState, Select, Skeleton } from "@bitacora/ui/web";
import dynamic from "next/dynamic";
import type { PuntoDistribucion } from "@/components/charts/GraficoDistribucion";
import type { PuntoIngresoMes } from "@/components/charts/GraficoIngresos";

// Recharts pesa ~340 KB — se carga aparte para no meterlo en el
// first-load del dashboard (AUDITORIA_PERFORMANCE_COSTOS.md #7).
// OJO (Paso 6 del sistema de diseño): estos dos charts son compartidos
// con Informes → Visión General y siguen leyendo las variables CSS de
// Faena (var(--success), var(--border)…) — no se migraron acá para no
// recolorear una pantalla fuera de este bucket. Quedan con su paleta
// vieja DENTRO de una Card ya migrada — es un seam conocido, documentado
// en docs/design-system.md.
const GraficoDistribucion = dynamic(
  () => import("@/components/charts/GraficoDistribucion").then((m) => m.GraficoDistribucion),
  { ssr: false, loading: () => <Skeleton alto={192} radio={16} /> }
);
const GraficoIngresos = dynamic(
  () => import("@/components/charts/GraficoIngresos").then((m) => m.GraficoIngresos),
  { ssr: false, loading: () => <Skeleton alto={192} radio={16} /> }
);

type UsuarioConEmpresa = Usuario & { empresa: Empresa };

type DatosDashboard = {
  periodo: { desde: string; hasta: string };
  kpis: {
    ingresos_totales: number;
    ingresos_recibidos: number;
    pct_recibido: number;
    monto_pendiente: number;
    monto_vencido: number;
    cant_presupuestos: number;
    pct_conversion: number;
    ot_completadas: number;
    pct_conclusion_ot: number;
    clientes_activos: number;
    ticket_promedio: number;
  };
  resumen_financiero: { recibido: number; pendiente: number; atrasado: number; total: number };
  resumen_gastos: { pagado: number; pendiente: number; vencido: number; total: number };
  ingresos_vs_gastos: { ingresos_recibidos: number; gastos_pagados: number; resultado_neto: number };
  estado_presupuestos: PuntoDistribucion[];
  estado_ot: PuntoDistribucion[];
  ingresos_por_mes: PuntoIngresoMes[];
};

const PERIODOS = [
  { valor: "hoy", etiqueta: "Hoy" },
  { valor: "ayer", etiqueta: "Ayer" },
  { valor: "7d", etiqueta: "Últimos 7 días" },
  { valor: "30d", etiqueta: "Últimos 30 días" },
  { valor: "este_mes", etiqueta: "Este mes" },
  { valor: "mes_pasado", etiqueta: "Mes pasado" },
  { valor: "este_anio", etiqueta: "Este año" },
  { valor: "personalizado", etiqueta: "Personalizado" },
];

// Cada acceso lleva su módulo — se muestra solo si el ROL lo puede ver
// (puedeVerModulo) y la empresa lo tiene activado. Antes solo se
// filtraba por módulo opt-in, así que un colaborador (sin módulos) veía
// atajos a Trabajos, Clientes, Cobros, etc. que no puede abrir.
const ACCESOS: { href: string; label: string; icon: typeof Briefcase; modulo: Modulo }[] = [
  { href: "/dashboard/ordenes", label: "Órdenes de servicio", icon: ClipboardCheck, modulo: "ordenes_servicio" },
  { href: "/dashboard/registros/clientes", label: "Clientes", icon: MapPin, modulo: "registros" },
  { href: "/dashboard/rutas", label: "Rutas", icon: Route, modulo: "rutas" },
  { href: "/dashboard/financiero/cobros", label: "Cobros", icon: Receipt, modulo: "financiero" },
  { href: "/dashboard/financiero/cotizaciones", label: "Cotizaciones", icon: Tag, modulo: "financiero" },
  { href: "/dashboard/gastos", label: "Gastos", icon: Wallet, modulo: "financiero" },
  { href: "/dashboard/informe", label: "Informe con IA", icon: Sparkle, modulo: "informe_ia" },
];

function Kpi({ etiqueta, valor, sub }: { etiqueta: string; valor: string; sub?: string }) {
  return (
    <Card>
      <p className="font-ds-body text-[11px] font-semibold uppercase tracking-[0.1em] text-ds-text/60">{etiqueta}</p>
      <p className="mt-ds-2 font-ds-body text-ds-h3 font-semibold tracking-tight text-ds-text">
        <Cifra>{valor}</Cifra>
      </p>
      {sub ? <p className="mt-ds-1 font-ds-body text-ds-caption font-semibold text-ds-text/60">{sub}</p> : null}
    </Card>
  );
}

function Renglon({ etiqueta, valor, tono }: { etiqueta: string; valor: string; tono: "completado" | "en_progreso" | "cancelado" | "normal" }) {
  const color = {
    completado: "text-ds-accent2-800",
    en_progreso: "text-ds-accent-800",
    cancelado: "text-ds-accent-700",
    normal: "text-ds-text",
  }[tono];
  return (
    <div className="flex items-center justify-between">
      <span className="font-ds-body text-ds-small text-ds-text/70">{etiqueta}</span>
      <span className={`font-ds-body text-ds-small font-medium ${color}`}>
        <Cifra>{valor}</Cifra>
      </span>
    </div>
  );
}

const pct = (n: number) => `${n.toFixed(0)}%`;

function aFecha(texto: string): Date {
  const [y, m, d] = texto.split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}
function aTexto(fecha: Date | null): string {
  if (!fecha) return new Date().toISOString().slice(0, 10);
  const y = fecha.getFullYear();
  const m = String(fecha.getMonth() + 1).padStart(2, "0");
  const d = String(fecha.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export default function DashboardPage() {
  const router = useRouter();
  const [usuario, setUsuario] = useState<UsuarioConEmpresa | null>(null);
  const [modulosDeshabilitados, setModulosDeshabilitados] = useState<Modulo[]>([]);
  const [modulosVisibles, setModulosVisibles] = useState<Modulo[] | null>(null);
  const [acciones, setAcciones] = useState<string[]>([]);
  const [cargando, setCargando] = useState(true);

  const [periodo, setPeriodo] = useState("este_mes");
  const [desdeCustom, setDesdeCustom] = useState(() => new Date().toISOString().slice(0, 10));
  const [hastaCustom, setHastaCustom] = useState(() => new Date().toISOString().slice(0, 10));
  const [datos, setDatos] = useState<DatosDashboard | null>(null);
  const [cargandoDatos, setCargandoDatos] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        router.replace("/login");
        return;
      }
      const res = await apiFetch("/api/me");
      if (!res.ok) {
        router.replace("/login");
        return;
      }
      const body = await res.json();
      if (!body.usuario) {
        router.replace("/onboarding");
        return;
      }
      setUsuario(body.usuario);
      setModulosDeshabilitados(body.modulos_deshabilitados ?? []);
      if (Array.isArray(body.modulos_visibles)) setModulosVisibles(body.modulos_visibles);
      setAcciones(body.acciones ?? []);
      setCargando(false);
    })();
  }, [router]);

  const cargarDashboard = useCallback(async () => {
    setError(null);
    setCargandoDatos(true);
    const params = new URLSearchParams({ periodo });
    if (periodo === "personalizado") {
      params.set("desde", desdeCustom);
      params.set("hasta", hastaCustom);
    }
    const res = await apiFetch(`/api/dashboard?${params.toString()}`);
    setCargandoDatos(false);
    if (!res.ok) {
      setError("No se pudieron cargar los indicadores");
      return;
    }
    setDatos(await res.json());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periodo]);

  const verAnalitico = acciones.includes("ver_dashboard");

  useEffect(() => {
    // El dashboard analítico (KPIs/gráficos financieros y operativos) lo
    // habilita la acción "ver_dashboard" del rol — el backend ahora
    // también rechaza el endpoint sin ella, así no se dispara un 403.
    if (!cargando && usuario && verAnalitico) cargarDashboard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cargando, verAnalitico]);

  if (cargando || !usuario) return null;

  const moneda = usuario.empresa.moneda ?? "CLP";
  const money = (n: number) => formatMoneda(n, moneda);
  const puedeVer = (m: Modulo) =>
    modulosVisibles !== null
      ? modulosVisibles.includes(m)
      : puedeVerModulo(usuario.rol, m) && !modulosDeshabilitados.includes(m);
  const accesosVisibles = ACCESOS.filter((a) => puedeVer(a.modulo));

  return (
    <DashboardShell
      usuario={{
        nombre: usuario.nombre,
        rol: usuario.rol,
        empresaNombre: usuario.empresa.nombre,
        empresaLogoUrl: usuario.empresa.logo_url,
        colorPrimario: usuario.empresa.color_primario,
        colorPrimarioForeground: usuario.empresa.color_primario_foreground,
        colorSecundario: usuario.empresa.color_secundario,
        fuente: usuario.empresa.fuente,
        moneda,
      }}
    >
      {/* Panel propio — mismo motivo que en el listado de OS, ver ese archivo. */}
      <div className="rounded-[32px] bg-ds-bg p-ds-6 text-ds-text">
      <div className="mb-ds-6 flex flex-col gap-ds-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="font-ds-body text-ds-small font-medium text-ds-brand">{usuario.empresa.nombre}</p>
          <p className="mt-ds-1 ds-heading text-ds-h2 text-ds-text">Hola, {usuario.nombre.split(" ")[0]}</p>
          {puedeVer("ordenes_servicio") || puedeVer("financiero") ? (
            <div className="mt-ds-3 flex flex-wrap gap-ds-2">
              {puedeVer("ordenes_servicio") ? (
                <Link href="/dashboard/ordenes/nueva">
                  <Button tamano="sm" iconoIzq={<Plus size={16} strokeWidth={2.75} />}>
                    Nueva OS
                  </Button>
                </Link>
              ) : null}
              {puedeVer("financiero") ? (
                <Link href="/dashboard/financiero/cotizaciones/nueva">
                  <Button variante="secundario" tamano="sm" iconoIzq={<Plus size={16} strokeWidth={2.75} />}>
                    Nueva Cotización
                  </Button>
                </Link>
              ) : null}
            </div>
          ) : null}
        </div>
        {verAnalitico ? (
          <div className="flex flex-wrap items-end gap-ds-2">
            <Select
              valor={periodo}
              onCambio={setPeriodo}
              opciones={PERIODOS.map((p) => ({ valor: p.valor, etiqueta: p.etiqueta }))}
            />
            {periodo === "personalizado" ? (
              <>
                <DatePicker valor={aFecha(desdeCustom)} onCambio={(f) => setDesdeCustom(aTexto(f))} />
                <DatePicker valor={aFecha(hastaCustom)} onCambio={(f) => setHastaCustom(aTexto(f))} />
              </>
            ) : null}
            <Button onPress={cargarDashboard} deshabilitado={cargandoDatos} cargando={cargandoDatos}>
              Actualizar
            </Button>
          </div>
        ) : null}
      </div>

      {!verAnalitico ? (
        <Card>
          <p className="font-ds-body text-ds-small text-ds-text">Tu perfil no tiene módulos de gestión asignados.</p>
          <p className="mt-ds-1 font-ds-body text-ds-small text-ds-text/70">
            El trabajo en terreno (órdenes de servicio, checklists, fotos) se hace desde la app móvil. Si crees que deberías ver más
            acá, pídele a un administrador de tu empresa que revise tu rol en Grupo y usuario.
          </p>
        </Card>
      ) : null}

      {verAnalitico && error ? (
        <p className="mb-ds-6 font-ds-body text-ds-small text-ds-accent-700">{error}</p>
      ) : null}

      {verAnalitico && !datos && !error ? (
        <LoadingState>
          <div className="grid gap-ds-4 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} alto={92} radio={32} />
            ))}
          </div>
        </LoadingState>
      ) : null}

      {verAnalitico && datos ? (
        <>
          {/* TODO: decisión pendiente — estos KPIs y el gráfico de
              ingresos duplican casi exactamente lo que ya muestra
              Informes → Visión General (web/src/app/dashboard/informes/
              vision-general/page.tsx). Evaluar si este Dashboard pasa a
              ser más accionable (accesos rápidos + alertas) y Visión
              General se queda con el análisis profundo, sin repetir
              las mismas métricas en los dos lugares. */}
          <div className="grid gap-ds-4 sm:grid-cols-2 lg:grid-cols-4">
            <Kpi etiqueta="Ingresos totales" valor={money(datos.kpis.ingresos_totales)} />
            <Kpi
              etiqueta="Ingresos recibidos"
              valor={money(datos.kpis.ingresos_recibidos)}
              sub={`${pct(datos.kpis.pct_recibido)} del total`}
            />
            <Kpi etiqueta="Pendiente de cobro" valor={money(datos.kpis.monto_pendiente)} />
            <Kpi etiqueta="Monto vencido" valor={money(datos.kpis.monto_vencido)} />
            <Kpi
              etiqueta="Cotizaciones"
              valor={String(datos.kpis.cant_presupuestos)}
              sub={`${pct(datos.kpis.pct_conversion)} de conversión`}
            />
            <Kpi
              etiqueta="OT completadas"
              valor={String(datos.kpis.ot_completadas)}
              sub={`${pct(datos.kpis.pct_conclusion_ot)} de conclusión`}
            />
            <Kpi etiqueta="Clientes activos" valor={String(datos.kpis.clientes_activos)} />
            <Kpi etiqueta="Ticket promedio" valor={money(datos.kpis.ticket_promedio)} />
          </div>

          <div className="my-ds-6 grid gap-ds-6 lg:grid-cols-[1fr_20rem]">
            <Card>
              <p className="mb-ds-4 font-ds-body text-ds-small font-semibold text-ds-text">
                Ingresos por período (últimos {datos.ingresos_por_mes.length} meses)
              </p>
              <GraficoIngresos datos={datos.ingresos_por_mes} moneda={moneda} />
            </Card>

            <Card>
              <p className="mb-ds-4 font-ds-body text-ds-small font-semibold text-ds-text">Resumen financiero</p>
              <div className="flex flex-col gap-ds-3">
                <Renglon etiqueta="Recibido" valor={money(datos.resumen_financiero.recibido)} tono="completado" />
                <Renglon etiqueta="Pendiente" valor={money(datos.resumen_financiero.pendiente)} tono="en_progreso" />
                <Renglon etiqueta="Atrasado" valor={money(datos.resumen_financiero.atrasado)} tono="cancelado" />
                <div className="mt-ds-1 flex items-center justify-between border-t border-ds-divider pt-ds-3">
                  <span className="font-ds-body text-ds-small font-medium text-ds-text">Total</span>
                  <span className="font-ds-body text-ds-small font-semibold text-ds-text">
                    <Cifra>{money(datos.resumen_financiero.total)}</Cifra>
                  </span>
                </div>
              </div>
            </Card>
          </div>

          <div className="my-ds-6">
          <Card>
            <p className="mb-ds-4 font-ds-body text-ds-small font-semibold text-ds-text">Ingresos vs Gastos</p>
            <div className="grid gap-ds-4 sm:grid-cols-3">
              <div>
                <p className="font-ds-body text-ds-caption text-ds-text/60">Ingresos recibidos</p>
                <p className="mt-ds-1 font-ds-body text-ds-h5 font-semibold text-ds-accent2-800">
                  <Cifra>{money(datos.ingresos_vs_gastos.ingresos_recibidos)}</Cifra>
                </p>
              </div>
              <div>
                <p className="font-ds-body text-ds-caption text-ds-text/60">Gastos pagados</p>
                <p className="mt-ds-1 font-ds-body text-ds-h5 font-semibold text-ds-accent-700">
                  <Cifra>{money(datos.ingresos_vs_gastos.gastos_pagados)}</Cifra>
                </p>
              </div>
              <div>
                <p className="font-ds-body text-ds-caption text-ds-text/60">Resultado neto</p>
                <p
                  className={`mt-ds-1 font-ds-body text-ds-h3 font-semibold ${
                    datos.ingresos_vs_gastos.resultado_neto >= 0 ? "text-ds-accent2-800" : "text-ds-accent-700"
                  }`}
                >
                  <Cifra>{money(datos.ingresos_vs_gastos.resultado_neto)}</Cifra>
                </p>
              </div>
            </div>
          </Card>
          </div>

          <div className="my-ds-6 grid gap-ds-6 sm:grid-cols-2">
            <Card>
              <p className="mb-ds-4 font-ds-body text-ds-small font-semibold text-ds-text">Resumen de gastos</p>
              <div className="flex flex-col gap-ds-3">
                <Renglon etiqueta="Pagado" valor={money(datos.resumen_gastos.pagado)} tono="completado" />
                <Renglon etiqueta="Pendiente" valor={money(datos.resumen_gastos.pendiente)} tono="en_progreso" />
                <Renglon etiqueta="Vencido" valor={money(datos.resumen_gastos.vencido)} tono="cancelado" />
                <div className="mt-ds-1 flex items-center justify-between border-t border-ds-divider pt-ds-3">
                  <span className="font-ds-body text-ds-small font-medium text-ds-text">Total</span>
                  <span className="font-ds-body text-ds-small font-semibold text-ds-text">
                    <Cifra>{money(datos.resumen_gastos.total)}</Cifra>
                  </span>
                </div>
              </div>
            </Card>

            <Card>
              <p className="mb-ds-4 font-ds-body text-ds-small font-semibold text-ds-text">Estado de cotizaciones</p>
              <GraficoDistribucion datos={datos.estado_presupuestos} mensajeVacio="Sin cotizaciones" />
            </Card>
          </div>

          <div className="my-ds-6">
            <Card>
              <p className="mb-ds-4 font-ds-body text-ds-small font-semibold text-ds-text">Estado de órdenes de trabajo</p>
              <GraficoDistribucion datos={datos.estado_ot} mensajeVacio="Sin órdenes de trabajo" />
            </Card>
          </div>
        </>
      ) : null}

      {accesosVisibles.length > 0 ? (
        <div className="mt-ds-8 flex flex-wrap gap-ds-2">
          {accesosVisibles.map((a) => (
            <Link
              key={a.href}
              href={a.href}
              className="inline-flex items-center gap-ds-2 rounded-ds-pill border border-ds-divider bg-ds-surface px-ds-3 py-ds-2 font-ds-body text-ds-small font-medium text-ds-text/70 transition-colors hover:border-ds-brand hover:text-ds-brand"
            >
              <a.icon size={16} strokeWidth={2.75} />
              {a.label}
            </Link>
          ))}
        </div>
      ) : null}
      </div>
    </DashboardShell>
  );
}
