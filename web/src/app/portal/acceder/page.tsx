"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AuthLayout } from "@/components/AuthLayout";
import { ErrorText } from "@/components/ui";
import { guardarTokenPortal, portalFetch } from "@/lib/portalApi";

const RUTA_POR_ENTIDAD: Record<string, (id: string) => string> = {
  trabajo: (id) => `/portal/ordenes/${id}`,
  cotizacion: (id) => `/portal/cotizaciones/${id}`,
  factura: () => `/portal/cobros`,
};

export default function AccederPortalPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = searchParams.get("token");
    if (!token) {
      setError("Este link no es válido.");
      return;
    }
    (async () => {
      const res = await portalFetch(`/api/portal/${token}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? "Este link ya no es válido — pídenos uno nuevo.");
        return;
      }
      const { token: sesion, entidad_tipo, entidad_id } = await res.json();
      guardarTokenPortal(sesion);
      const destino = entidad_tipo && entidad_id ? RUTA_POR_ENTIDAD[entidad_tipo]?.(entidad_id) : null;
      router.replace(destino ?? "/portal");
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (error) {
    return (
      <AuthLayout title="Link no válido" subtitle="Puede haber vencido o ya haberse usado.">
        <ErrorText>{error}</ErrorText>
        <a href="/portal/login" className="mt-4 block text-center text-sm font-medium text-brand hover:underline">
          Entrar con mi RUT
        </a>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="Entrando…" subtitle="Un momento, estamos verificando tu link.">
      <div />
    </AuthLayout>
  );
}
