"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { SuperAdminShell } from "@/components/SuperAdminShell";
import { Card, ErrorText, PageHeader } from "@/components/ui";
import { IconChevronLeft } from "@/components/icons";
import { obtenerTokenSuperAdmin, superadminFetch } from "@/lib/superadminApi";

type Salud = {
  empresa: { id: string; nombre: string };
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

  useEffect(() => {
    if (!obtenerTokenSuperAdmin()) {
      router.replace("/superadmin/login");
      return;
    }
    (async () => {
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
      setSalud(await res.json());
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id]);

  return (
    <SuperAdminShell>
      <Link href="/superadmin" className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-brand hover:underline">
        <IconChevronLeft className="h-4 w-4" />
        Empresas
      </Link>

      {error && <ErrorText>{error}</ErrorText>}

      {salud && (
        <>
          <PageHeader title={salud.empresa.nombre} subtitle="Salud y uso — sin datos operativos internos" />

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
        </>
      )}
    </SuperAdminShell>
  );
}
