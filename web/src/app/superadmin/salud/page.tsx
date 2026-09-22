"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { TendenciaMensual } from "@bitacora/shared";
import { SuperAdminShell } from "@/components/SuperAdminShell";
import { Badge, Card, ErrorText, PageHeader } from "@/components/ui";
import { GraficoEvolucionSimple } from "@/components/charts/GraficoEvolucionSimple";
import { GraficoEvolucionDoble } from "@/components/charts/GraficoEvolucionDoble";
import { obtenerTokenSuperAdmin, superadminFetch } from "@/lib/superadminApi";

function formatearBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
}

function formatearEntero(n: number): string {
  return n.toLocaleString("es-CL");
}

type Proveedor = { nombre: string; estado: "operational" | "degraded" | "outage" | "desconocido"; descripcion: string | null; pagina: string };
type ProveedorSinMonitoreo = { nombre: string; pagina: string | null };
type ErrorReciente = { id: string; ruta: string; metodo: string; mensaje: string; creado_en: string; empresa: { nombre: string } | null };
type RequestLentoFila = {
  id: string;
  ruta: string;
  metodo: string;
  ms: number;
  status_code: number | null;
  filas_devueltas: number | null;
  creado_en: string;
  empresa: { nombre: string } | null;
};

type StorageHistoricoFila = { mes: string; bytes_total: number };

// Uso real de recursos de la cuenta (distinto de `proveedores` arriba,
// que solo dice "¿está caído el proveedor en general?") — pedido
// 22-sep-2026: "costos/facturación, uso de recursos". Cada uno puede
// no estar disponible (falta credencial o la API no lo expone en el
// plan actual) sin afectar a los demás.
type EstadoProyectoSupabase = { ref: string; nombre: string; region: string; estado: string; dbBytes: number | null; dbTexto: string | null };
type UsoSupabase = { disponible: true; proyectos: EstadoProyectoSupabase[] } | { disponible: false; motivo: string };
type UsoResend =
  | { disponible: true; dominios: { nombre: string; estado: string; region: string }[]; ultimos30dias: number | null }
  | { disponible: false; motivo: string };
type UsoAnthropic = { disponible: true; dias: number } | { disponible: false; motivo: string };

type SaludPlataforma = {
  sentry_configurado: boolean;
  errores_ultimas_24h: number;
  errores_recientes: ErrorReciente[];
  requests_lentos_ultimas_24h: number;
  requests_lentos: RequestLentoFila[];
  proveedores: Proveedor[];
  proveedores_sin_monitoreo: ProveedorSinMonitoreo[];
  tendencia_mensual: TendenciaMensual[];
  storage_historico: StorageHistoricoFila[];
  uso_recursos: { supabase: UsoSupabase; resend: UsoResend; anthropic: UsoAnthropic };
  generado_en: string;
};

const ETIQUETA_ESTADO: Record<Proveedor["estado"], string> = {
  operational: "Operativo",
  degraded: "Degradado",
  outage: "Caído",
  desconocido: "Sin datos",
};

export default function SuperAdminSaludPage() {
  const router = useRouter();
  const [salud, setSalud] = useState<SaludPlataforma | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refrescando, setRefrescando] = useState(false);

  async function cargar() {
    const res = await superadminFetch("/api/superadmin/salud-plataforma");
    if (!res.ok) {
      if (res.status === 401) {
        router.replace("/superadmin/login");
        return;
      }
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "No se pudo cargar la salud de la plataforma");
      return;
    }
    setError(null);
    setSalud(await res.json());
  }

  useEffect(() => {
    if (!obtenerTokenSuperAdmin()) {
      router.replace("/superadmin/login");
      return;
    }
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onRefrescar() {
    setRefrescando(true);
    await cargar();
    setRefrescando(false);
  }

  return (
    <SuperAdminShell>
      <PageHeader
        title="Salud"
        subtitle={
          salud
            ? `Vista global de toda la plataforma — actualizado ${new Date(salud.generado_en).toLocaleTimeString("es-CL")}`
            : "Estado de la infraestructura y errores de toda la plataforma"
        }
        action={
          <button
            type="button"
            onClick={onRefrescar}
            disabled={refrescando}
            className="rounded-md border border-border px-3 py-1.5 text-sm font-medium text-foreground hover:bg-surface disabled:opacity-50"
          >
            {refrescando ? "Actualizando…" : "Actualizar"}
          </button>
        }
      />

      {error && <ErrorText>{error}</ErrorText>}

      {!salud && !error && <p className="my-6 text-sm text-muted">Cargando…</p>}

      {salud && (
        <div className="my-6 flex flex-col gap-6">
          {!salud.sentry_configurado && (
            <Card className="border-warning/40">
              <p className="text-sm font-semibold text-foreground">Sentry no está configurado</p>
              <p className="mt-1 text-sm text-muted">
                El código ya captura excepciones (<code>backend/src/instrument.ts</code>) pero sin{" "}
                <code>SENTRY_DSN</code> cargado en las variables de entorno de Render no manda nada — es un no-op. Es la mejora de
                mayor retorno de esta pantalla: creá un proyecto gratis en sentry.io y cargá el DSN en Render para enterarte por mail
                de cada error real, sin depender de venir a mirar esta tabla.
              </p>
            </Card>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <Card>
              <p className="text-xs text-muted">Errores del backend (últimas 24 h)</p>
              <p className="mt-1 text-2xl font-semibold text-foreground">{salud.errores_ultimas_24h}</p>
              <p className="mt-1 text-[11px] text-muted">5xx inesperados de cualquier empresa — ver detalle abajo.</p>
            </Card>
            <Card>
              <p className="text-xs text-muted">Requests lentos (últimas 24 h)</p>
              <p className="mt-1 text-2xl font-semibold text-foreground">{salud.requests_lentos_ultimas_24h}</p>
              <p className="mt-1 text-[11px] text-muted">Por encima del umbral de latencia — ver detalle abajo.</p>
            </Card>
          </div>

          <Card>
            <h2 className="mb-3 text-sm font-semibold text-foreground">Proveedores externos</h2>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {salud.proveedores.map((p) => (
                <a
                  key={p.nombre}
                  href={p.pagina}
                  target="_blank"
                  rel="noreferrer"
                  className="flex flex-col gap-1 rounded-lg border border-border px-3 py-2 hover:bg-surface"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium text-foreground">{p.nombre}</span>
                    <Badge value={p.estado} label={ETIQUETA_ESTADO[p.estado]} />
                  </div>
                  {p.descripcion && <span className="text-[11px] text-muted">{p.descripcion}</span>}
                </a>
              ))}
            </div>
            {salud.proveedores_sin_monitoreo.length > 0 && (
              <div className="mt-3 border-t border-border pt-3">
                <p className="mb-2 text-[11px] text-muted">Sin status page automática consultable — revisar manualmente si se sospecha de ellos:</p>
                <div className="flex flex-wrap gap-3 text-sm">
                  {salud.proveedores_sin_monitoreo.map((p) =>
                    p.pagina ? (
                      <a key={p.nombre} href={p.pagina} target="_blank" rel="noreferrer" className="text-brand hover:underline">
                        {p.nombre}
                      </a>
                    ) : (
                      <span key={p.nombre} className="text-muted">
                        {p.nombre}
                      </span>
                    )
                  )}
                </div>
              </div>
            )}
          </Card>

          <Card>
            <h2 className="mb-1 text-sm font-semibold text-foreground">Uso de recursos</h2>
            <p className="mb-3 text-[11px] text-muted">Datos reales de tu cuenta en cada servicio — distinto de &ldquo;¿está caído?&rdquo; de arriba.</p>
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <p className="mb-2 text-xs font-medium text-foreground">Supabase</p>
                {salud.uso_recursos.supabase.disponible ? (
                  <div className="flex flex-col gap-2">
                    {salud.uso_recursos.supabase.proyectos.map((p) => (
                      <div key={p.ref} className="rounded-md border border-border px-2.5 py-2">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-medium text-foreground">{p.nombre}</span>
                          <Badge value={p.estado === "ACTIVE_HEALTHY" ? "operational" : "desconocido"} label={p.estado} />
                        </div>
                        <p className="mt-1 text-[11px] text-muted">
                          {p.region} · DB {p.dbTexto ?? "—"}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-[11px] text-muted">{salud.uso_recursos.supabase.motivo}</p>
                )}
              </div>
              <div>
                <p className="mb-2 text-xs font-medium text-foreground">Resend</p>
                {salud.uso_recursos.resend.disponible ? (
                  salud.uso_recursos.resend.dominios.length > 0 ? (
                    <div className="flex flex-col gap-1.5">
                      {salud.uso_recursos.resend.dominios.map((d) => (
                        <div key={d.nombre} className="flex items-center justify-between gap-2 rounded-md border border-border px-2.5 py-2">
                          <span className="text-xs text-foreground">{d.nombre}</span>
                          <Badge value={d.estado === "verified" ? "operational" : "desconocido"} label={d.estado} />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[11px] text-muted">Sin dominios configurados.</p>
                  )
                ) : (
                  <p className="text-[11px] text-muted">{salud.uso_recursos.resend.motivo}</p>
                )}
              </div>
              <div>
                <p className="mb-2 text-xs font-medium text-foreground">Anthropic (Claude)</p>
                {salud.uso_recursos.anthropic.disponible ? (
                  <p className="text-[11px] text-muted">{salud.uso_recursos.anthropic.dias} días de datos disponibles.</p>
                ) : (
                  <p className="text-[11px] text-muted">{salud.uso_recursos.anthropic.motivo}</p>
                )}
              </div>
            </div>
          </Card>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <h2 className="mb-1 text-sm font-semibold text-foreground">Tokens de IA por mes</h2>
              <p className="mb-3 text-[11px] text-muted">Últimos 12 meses · todas las empresas.</p>
              <GraficoEvolucionSimple
                datos={salud.tendencia_mensual.map((t) => ({ mes: t.mes, monto: t.tokens_ia }))}
                mensajeVacio="Sin consumo de IA registrado."
                formatearValor={formatearEntero}
              />
            </Card>
            <Card>
              <h2 className="mb-1 text-sm font-semibold text-foreground">Órdenes de servicio creadas por mes</h2>
              <p className="mb-3 text-[11px] text-muted">Últimos 12 meses · todas las empresas.</p>
              <GraficoEvolucionSimple
                datos={salud.tendencia_mensual.map((t) => ({ mes: t.mes, monto: t.os_creadas }))}
                mensajeVacio="Sin OS creadas todavía."
                formatearValor={formatearEntero}
              />
            </Card>
            <Card>
              <h2 className="mb-1 text-sm font-semibold text-foreground">Errores y requests lentos por mes</h2>
              <p className="mb-3 text-[11px] text-muted">Tendencia de salud técnica · todas las empresas.</p>
              <GraficoEvolucionDoble
                datos={salud.tendencia_mensual.map((t) => ({ mes: t.mes, a: t.errores, b: t.requests_lentos }))}
                etiquetaA="Errores"
                etiquetaB="Requests lentos"
                mensajeVacio="Sin errores ni requests lentos registrados."
                formatearValor={formatearEntero}
              />
            </Card>
            <Card>
              <h2 className="mb-1 text-sm font-semibold text-foreground">Storage usado por mes</h2>
              <p className="mb-3 text-[11px] text-muted">
                Foto tomada al abrir esta pantalla cada mes — puede tener huecos si un mes entero pasa sin abrirla.
              </p>
              <GraficoEvolucionSimple
                datos={salud.storage_historico.map((s) => ({ mes: s.mes.slice(0, 7), monto: s.bytes_total }))}
                mensajeVacio="Todavía no hay suficiente historia — vuelve el próximo mes."
                formatearValor={formatearBytes}
              />
            </Card>
          </div>

          <Card>
            <h2 className="mb-1 text-sm font-semibold text-foreground">Errores recientes (todas las empresas)</h2>
            <p className="mb-3 text-[11px] text-muted">Últimos 50 · para el detalle de una sola empresa, ver su ficha en Empresas.</p>
            {salud.errores_recientes.length === 0 ? (
              <p className="text-sm text-muted">Sin errores registrados.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="text-muted">
                      <th className="py-1.5 pr-4 font-medium">Fecha</th>
                      <th className="py-1.5 pr-4 font-medium">Empresa</th>
                      <th className="py-1.5 pr-4 font-medium">Ruta</th>
                      <th className="py-1.5 font-medium">Mensaje</th>
                    </tr>
                  </thead>
                  <tbody>
                    {salud.errores_recientes.map((e) => (
                      <tr key={e.id} className="border-t border-border align-top">
                        <td className="whitespace-nowrap py-1.5 pr-4 text-muted">{new Date(e.creado_en).toLocaleString("es-CL")}</td>
                        <td className="py-1.5 pr-4 text-muted">{e.empresa?.nombre ?? "—"}</td>
                        <td className="py-1.5 pr-4 font-mono text-foreground">
                          {e.metodo} {e.ruta}
                        </td>
                        <td className="py-1.5 text-foreground">{e.mensaje}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          <Card>
            <h2 className="mb-1 text-sm font-semibold text-foreground">Requests lentos (todas las empresas)</h2>
            <p className="mb-3 text-[11px] text-muted">
              Últimos 50 · por encima del umbral de latencia (<code>LATENCIA_UMBRAL_MS</code>, 2000 ms por defecto).
            </p>
            {salud.requests_lentos.length === 0 ? (
              <p className="text-sm text-muted">Sin requests lentos registrados.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="text-muted">
                      <th className="py-1.5 pr-4 font-medium">Fecha</th>
                      <th className="py-1.5 pr-4 font-medium">Empresa</th>
                      <th className="py-1.5 pr-4 font-medium">Ruta</th>
                      <th className="py-1.5 pr-4 font-medium">Duración</th>
                      <th className="py-1.5 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {salud.requests_lentos.map((r) => (
                      <tr key={r.id} className="border-t border-border">
                        <td className="whitespace-nowrap py-1.5 pr-4 text-muted">{new Date(r.creado_en).toLocaleString("es-CL")}</td>
                        <td className="py-1.5 pr-4 text-muted">{r.empresa?.nombre ?? "—"}</td>
                        <td className="py-1.5 pr-4 font-mono text-foreground">
                          {r.metodo} {r.ruta}
                        </td>
                        <td className="py-1.5 pr-4 text-foreground">
                          {(r.ms / 1000).toFixed(1)} s{r.filas_devueltas != null ? ` · ${r.filas_devueltas} filas` : ""}
                        </td>
                        <td className="py-1.5 text-muted">{r.status_code ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          <p className="text-[11px] text-muted">
            Chequeo manual más a fondo (curl por capa, contactos de cada proveedor, severidad de incidentes):{" "}
            <a href="https://github.com/CpQuiroz/bitacora/blob/main/docs/RUNBOOK_INCIDENTES.md" target="_blank" rel="noreferrer" className="text-brand hover:underline">
              RUNBOOK_INCIDENTES.md
            </a>
            .
          </p>
        </div>
      )}
    </SuperAdminShell>
  );
}
