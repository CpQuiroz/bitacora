"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import type { EstadoEmpresa, Plan } from "@bitacora/shared";
import { SuperAdminShell } from "@/components/SuperAdminShell";
import { Badge, Button, Card, ErrorText, Input, Label, PageHeader, Select } from "@/components/ui";
import { IconChevronLeft, IconShield } from "@/components/icons";
import { obtenerTokenSuperAdmin, superadminFetch } from "@/lib/superadminApi";

const ESTADOS: EstadoEmpresa[] = ["activa", "suspendida", "dada_de_baja"];
const PLANES: Plan[] = ["trial", "basico", "pro"];

const ETIQUETA_MODULO: Record<string, string> = {
  agenda: "Agenda",
  ordenes_servicio: "Órdenes de servicio",
  viajes: "Viajes",
  registros: "Registros",
  rutas: "Rutas",
  financiero: "Financiero",
  informes: "Informes",
  informe_ia: "Informe con IA",
  asistente: "Asistente",
  configuracion: "Configuración",
  gestion_control: "Gestión y control",
  flota: "Flota",
  agenda_pro: "Agenda Pro (paquetes de sesiones y confirmación por el cliente)",
};

type Salud = {
  empresa: { id: string; nombre: string; estado: EstadoEmpresa; plan: Plan };
  ultima_actividad: string | null;
  usuarios_activos_mes: number;
  os_creadas_mes: number;
  almacenamiento_bytes: number;
  almacenamiento_incluye_avatares: boolean;
  consumo_ia_mes: {
    tokens_entrada: number;
    tokens_salida: number;
    por_feature: Record<string, { tokens_entrada: number; tokens_salida: number }>;
  };
  errores_recientes: { ruta: string; mensaje: string; creado_en: string }[];
};

const ETIQUETA_FEATURE: Record<string, string> = {
  analisis_foto: "Análisis de fotos",
  informe_os: "Informe de OS",
  extraer_guia: "Guía de despacho (WhatsApp)",
  informe_libre: "Informe con IA (libre)",
  informe_estructurado: "Informe con IA (estructurado)",
  informe_personalizado: "Informe con IA (personalizado)",
  asistente: "Asistente",
};

function formatearBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
}

export default function SuperAdminSaludEmpresaPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [salud, setSalud] = useState<Salud | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [planSeleccionado, setPlanSeleccionado] = useState<Plan>("trial");
  const [guardandoEstado, setGuardandoEstado] = useState(false);
  const [errorEstado, setErrorEstado] = useState<string | null>(null);
  const [guardandoPlan, setGuardandoPlan] = useState(false);
  const [errorPlan, setErrorPlan] = useState<string | null>(null);
  const [exportando, setExportando] = useState(false);
  const [errorExportar, setErrorExportar] = useState<string | null>(null);
  const [confirmacionEliminar, setConfirmacionEliminar] = useState("");
  const [eliminando, setEliminando] = useState(false);
  const [errorEliminar, setErrorEliminar] = useState<string | null>(null);
  const [modulos, setModulos] = useState<{ modulo: string; activado: boolean }[] | null>(null);
  const [guardandoModulo, setGuardandoModulo] = useState<string | null>(null);
  const [errorModulos, setErrorModulos] = useState<string | null>(null);

  async function cargar() {
    const res = await superadminFetch(`/api/superadmin/empresas/${params.id}/salud`);
    if (!res.ok) {
      if (res.status === 401) {
        router.replace("/superadmin/login");
        return;
      }
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "No se pudo cargar la salud de la empresa");
      return;
    }
    const datos: Salud = await res.json();
    setSalud(datos);
    setPlanSeleccionado(datos.empresa.plan);
  }

  async function cargarModulos() {
    const res = await superadminFetch(`/api/superadmin/empresas/${params.id}/modulos`);
    if (res.ok) setModulos(await res.json());
  }

  useEffect(() => {
    if (!obtenerTokenSuperAdmin()) {
      router.replace("/superadmin/login");
      return;
    }
    cargar();
    cargarModulos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id]);

  async function onTogglearModulo(modulo: string, activado: boolean) {
    setErrorModulos(null);
    setGuardandoModulo(modulo);
    const res = await superadminFetch(`/api/superadmin/empresas/${params.id}/modulos`, {
      method: "PATCH",
      body: JSON.stringify({ modulo, activado }),
    });
    setGuardandoModulo(null);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setErrorModulos(body.error ?? "No se pudo cambiar el módulo");
      return;
    }
    cargarModulos();
  }

  async function onCambiarEstado(nuevo: EstadoEmpresa) {
    if (!confirm(`¿Cambiar el estado a "${nuevo.replaceAll("_", " ")}"?`)) return;
    setErrorEstado(null);
    setGuardandoEstado(true);
    const res = await superadminFetch(`/api/superadmin/empresas/${params.id}/estado`, {
      method: "PATCH",
      body: JSON.stringify({ estado: nuevo }),
    });
    setGuardandoEstado(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setErrorEstado(body.error ?? "No se pudo cambiar el estado");
      return;
    }
    cargar();
  }

  async function onGuardarPlan() {
    setErrorPlan(null);
    setGuardandoPlan(true);
    const res = await superadminFetch(`/api/superadmin/empresas/${params.id}/plan`, {
      method: "PATCH",
      body: JSON.stringify({ plan: planSeleccionado }),
    });
    setGuardandoPlan(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setErrorPlan(body.error ?? "No se pudo cambiar el plan");
      return;
    }
    cargar();
  }

  async function onExportar() {
    setErrorExportar(null);
    setExportando(true);
    const res = await superadminFetch(`/api/superadmin/empresas/${params.id}/exportar`);
    setExportando(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setErrorExportar(body.error ?? "No se pudo generar la exportación");
      return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${salud?.empresa.nombre ?? "empresa"}-export-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function onEliminar() {
    if (!salud || confirmacionEliminar !== salud.empresa.nombre) return;
    setErrorEliminar(null);
    setEliminando(true);
    const res = await superadminFetch(`/api/superadmin/empresas/${params.id}`, {
      method: "DELETE",
      body: JSON.stringify({ confirmar: confirmacionEliminar }),
    });
    setEliminando(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setErrorEliminar(body.error ?? "No se pudo eliminar la empresa");
      return;
    }
    router.replace("/superadmin");
  }

  return (
    <SuperAdminShell>
      <Link href="/superadmin" className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-brand hover:underline">
        <IconChevronLeft className="h-4 w-4" />
        Empresas
      </Link>

      {error && <ErrorText>{error}</ErrorText>}

      {salud && (
        <>
          <PageHeader
            title={salud.empresa.nombre}
            subtitle="Salud y uso — sin datos operativos internos"
            action={<Badge value={salud.empresa.estado} />}
          />

          <div className="my-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card>
              <p className="text-xs text-muted">Última actividad</p>
              <p className="mt-1 text-lg font-semibold text-foreground">
                {salud.ultima_actividad ? new Date(salud.ultima_actividad).toLocaleString("es-CL") : "Sin registro"}
              </p>
            </Card>
            <Card>
              <p className="text-xs text-muted">Usuarios activos este mes</p>
              <p className="mt-1 text-lg font-semibold text-foreground">{salud.usuarios_activos_mes}</p>
            </Card>
            <Card>
              <p className="text-xs text-muted">OS creadas este mes</p>
              <p className="mt-1 text-lg font-semibold text-foreground">{salud.os_creadas_mes}</p>
            </Card>
            <Card>
              <p className="text-xs text-muted">Almacenamiento usado</p>
              <p className="mt-1 text-lg font-semibold text-foreground">{formatearBytes(salud.almacenamiento_bytes)}</p>
              {!salud.almacenamiento_incluye_avatares && (
                <p className="mt-1 text-[11px] text-muted">No incluye fotos de perfil (volumen marginal)</p>
              )}
            </Card>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <h2 className="mb-3 text-sm font-semibold text-foreground">Consumo de Claude este mes</h2>
              <div className="flex gap-6">
                <div>
                  <p className="text-xs text-muted">Tokens de entrada</p>
                  <p className="text-lg font-semibold text-foreground">{salud.consumo_ia_mes.tokens_entrada.toLocaleString("es-CL")}</p>
                </div>
                <div>
                  <p className="text-xs text-muted">Tokens de salida</p>
                  <p className="text-lg font-semibold text-foreground">{salud.consumo_ia_mes.tokens_salida.toLocaleString("es-CL")}</p>
                </div>
              </div>
              {Object.keys(salud.consumo_ia_mes.por_feature).length > 0 && (
                <div className="mt-4 flex flex-col gap-1.5 border-t border-border pt-3">
                  {Object.entries(salud.consumo_ia_mes.por_feature).map(([feature, tokens]) => (
                    <div key={feature} className="flex items-center justify-between text-xs">
                      <span className="text-muted">{ETIQUETA_FEATURE[feature] ?? feature}</span>
                      <span className="text-foreground">
                        {(tokens.tokens_entrada + tokens.tokens_salida).toLocaleString("es-CL")} tokens
                      </span>
                    </div>
                  ))}
                </div>
              )}
              <p className="mt-3 text-[11px] text-muted">
                El costo exacto depende del precio vigente por token — revisa console.anthropic.com para calcularlo.
              </p>
            </Card>

            <Card>
              <h2 className="mb-3 text-sm font-semibold text-foreground">Errores recientes</h2>
              {salud.errores_recientes.length === 0 ? (
                <p className="text-sm text-muted">Sin errores recientes.</p>
              ) : (
                <div className="flex flex-col divide-y divide-border">
                  {salud.errores_recientes.map((e, i) => (
                    <div key={i} className="py-2 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-foreground">{e.ruta}</span>
                        <span className="text-muted">{new Date(e.creado_en).toLocaleString("es-CL")}</span>
                      </div>
                      <p className="mt-0.5 text-muted">{e.mensaje}</p>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <Card>
              <h2 className="mb-3 text-sm font-semibold text-foreground">Estado</h2>
              <p className="mb-3 text-sm text-muted">
                Estado actual: <Badge value={salud.empresa.estado} />
              </p>
              <div className="flex flex-wrap gap-2">
                {ESTADOS.filter((e) => e !== salud.empresa.estado).map((e) => (
                  <Button key={e} type="button" variant="outline" disabled={guardandoEstado} onClick={() => onCambiarEstado(e)}>
                    {e === "activa" ? "Activar" : e === "suspendida" ? "Suspender" : "Dar de baja"}
                  </Button>
                ))}
              </div>
              {errorEstado && (
                <div className="mt-3">
                  <ErrorText>{errorEstado}</ErrorText>
                </div>
              )}
              <p className="mt-3 text-[11px] text-muted">
                Suspendida o dada de baja bloquea el acceso a la app completa para todos los usuarios de esta empresa de inmediato.
              </p>
            </Card>

            <Card>
              <h2 className="mb-3 text-sm font-semibold text-foreground">Plan</h2>
              <div className="flex items-end gap-2">
                <div className="flex-1">
                  <Label>Plan actual</Label>
                  <Select value={planSeleccionado} onChange={(e) => setPlanSeleccionado(e.target.value as Plan)}>
                    {PLANES.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </Select>
                </div>
                <Button type="button" disabled={guardandoPlan || planSeleccionado === salud.empresa.plan} onClick={onGuardarPlan}>
                  {guardandoPlan ? "Guardando…" : "Guardar"}
                </Button>
              </div>
              {errorPlan && (
                <div className="mt-3">
                  <ErrorText>{errorPlan}</ErrorText>
                </div>
              )}
              <p className="mt-3 text-[11px] text-muted">No hay límites de uso conectados al plan todavía — es solo una etiqueta.</p>
            </Card>
          </div>

          <Card className="mt-4">
            <h2 className="mb-2 text-sm font-semibold text-foreground">Módulos contratados</h2>
            <p className="mb-3 text-sm text-muted">
              Desactivar un módulo lo oculta del menú y bloquea sus rutas para todos los usuarios de esta empresa, sin importar su rol.
            </p>
            {!modulos ? (
              <p className="text-sm text-muted">Cargando…</p>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2">
                {modulos.map((m) => (
                  <label key={m.modulo} className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm">
                    <input
                      type="checkbox"
                      checked={m.activado}
                      disabled={guardandoModulo === m.modulo}
                      onChange={(e) => onTogglearModulo(m.modulo, e.target.checked)}
                    />
                    <span className="text-foreground">{ETIQUETA_MODULO[m.modulo] ?? m.modulo}</span>
                  </label>
                ))}
              </div>
            )}
            {errorModulos && (
              <div className="mt-3">
                <ErrorText>{errorModulos}</ErrorText>
              </div>
            )}
          </Card>

          <Card className="mt-4">
            <h2 className="mb-2 text-sm font-semibold text-foreground">Exportar datos</h2>
            <p className="mb-3 text-sm text-muted">
              Genera un archivo con todos los datos de esta empresa (para portabilidad si se da de baja). No incluye el contenido de
              fotos/PDFs, solo las referencias ya guardadas.
            </p>
            <Button type="button" variant="outline" disabled={exportando} onClick={onExportar}>
              {exportando ? "Generando…" : "Exportar datos"}
            </Button>
            {errorExportar && (
              <div className="mt-3">
                <ErrorText>{errorExportar}</ErrorText>
              </div>
            )}
          </Card>

          <Card className="mt-4 border-danger/40">
            <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold text-danger">
              <IconShield className="h-4 w-4" />
              Zona de peligro
            </h2>
            <p className="mb-4 text-sm text-muted">
              Eliminar la empresa borra <strong>permanentemente</strong> a {salud.empresa.nombre} — clientes, cotizaciones, órdenes de
              servicio, cobranzas y todo lo demás. Esta acción no se puede deshacer.
            </p>
            <Label>Escribe &ldquo;{salud.empresa.nombre}&rdquo; para confirmar</Label>
            <Input type="text" value={confirmacionEliminar} onChange={(e) => setConfirmacionEliminar(e.target.value)} className="max-w-sm" />
            {errorEliminar && (
              <div className="mt-3">
                <ErrorText>{errorEliminar}</ErrorText>
              </div>
            )}
            <Button
              type="button"
              variant="danger"
              onClick={onEliminar}
              disabled={eliminando || confirmacionEliminar !== salud.empresa.nombre}
              className="mt-4"
            >
              {eliminando ? "Eliminando…" : "Eliminar empresa"}
            </Button>
          </Card>
        </>
      )}
    </SuperAdminShell>
  );
}
