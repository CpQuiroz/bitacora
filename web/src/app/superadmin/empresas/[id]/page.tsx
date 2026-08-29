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
        </>
      )}
    </SuperAdminShell>
  );
}
