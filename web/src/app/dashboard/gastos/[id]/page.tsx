"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ChevronLeft, Paperclip } from "lucide-react";
import type { CategoriaGasto, CentroCosto, Gasto, Proveedor, Trabajo } from "@bitacora/shared";
import { supabase } from "@/lib/supabase";
import { apiFetch } from "@/lib/api";
import { formatMoneda } from "@/lib/formatMoneda";
import { DashboardShell, type UsuarioShell } from "@/components/DashboardShell";
import { Button, Card, StatusBadge, type TonoEstado } from "@bitacora/ui/web";

type GastoDetalle = Gasto & {
  categoria_info: Pick<CategoriaGasto, "id" | "nombre" | "color"> | null;
  centro_costo_info: Pick<CentroCosto, "id" | "nombre"> | null;
  proveedor_info: (Pick<Proveedor, "id" | "nombre"> & { telefono: string | null; correo: string | null }) | null;
  trabajo_info: Pick<Trabajo, "id" | "cliente" | "fecha"> | null;
};

const TONO_ESTADO: Record<Gasto["estado"], TonoEstado> = { pendiente: "en_progreso", pagado: "completado" };

// PASO 6 (sistema de diseño) — migrado. Ver docs/design-system.md.
export default function GastoDetallePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [usuario, setUsuario] = useState<UsuarioShell | null>(null);
  const [gasto, setGasto] = useState<GastoDetalle | null>(null);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      router.replace("/login");
      return;
    }
    const [resMe, resGasto] = await Promise.all([apiFetch("/api/me"), apiFetch(`/api/gastos/${params.id}`)]);
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
    if (!resGasto.ok) {
      setError("No se pudo cargar el gasto");
      return;
    }
    setGasto(await resGasto.json());
  }, [params.id, router]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  async function verComprobante() {
    const res = await apiFetch(`/api/gastos/${params.id}/comprobante`);
    if (!res.ok) return;
    const { url } = await res.json();
    window.open(url, "_blank", "noopener,noreferrer");
  }

  if (!usuario) return null;
  if (error) {
    return (
      <DashboardShell usuario={usuario}>
        <p className="font-ds-body text-ds-small text-ds-accent-700">{error}</p>
      </DashboardShell>
    );
  }
  if (!gasto) return null;

  return (
    <DashboardShell usuario={usuario}>
      <Link href="/dashboard/gastos" className="mb-ds-4 inline-flex items-center gap-ds-1 font-ds-body text-ds-small font-medium text-ds-brand hover:underline">
        <ChevronLeft size={16} strokeWidth={2.75} />
        Gastos
      </Link>

      <div className="flex flex-wrap items-center justify-between gap-ds-3">
        <div>
          <p className="ds-heading text-ds-h2 text-ds-text">{gasto.descripcion || gasto.categoria}</p>
          <p className="mt-ds-1 font-ds-body text-ds-small text-ds-text/70">{formatMoneda(gasto.monto, usuario.moneda)}</p>
        </div>
        <StatusBadge estado={gasto.estado} tonoForzado={TONO_ESTADO[gasto.estado]} />
      </div>

      <div className="my-ds-6 grid gap-ds-6 lg:grid-cols-2">
        <Card>
          <p className="mb-ds-4 font-ds-body text-ds-small font-semibold text-ds-text">Información del Gasto</p>
          <div className="grid grid-cols-2 gap-ds-3 font-ds-body text-ds-small">
            <div>
              <p className="text-ds-caption text-ds-text/60">Monto</p>
              <p className="text-ds-text">{formatMoneda(gasto.monto, usuario.moneda)}</p>
            </div>
            <div>
              <p className="text-ds-caption text-ds-text/60">Fecha</p>
              <p className="text-ds-text">{gasto.fecha}</p>
            </div>
            <div>
              <p className="text-ds-caption text-ds-text/60">Estado</p>
              <StatusBadge estado={gasto.estado} tonoForzado={TONO_ESTADO[gasto.estado]} />
            </div>
            <div>
              <p className="text-ds-caption text-ds-text/60">Fecha de pago</p>
              <p className="text-ds-text">{gasto.fecha_pago ?? "—"}</p>
            </div>
            {gasto.trabajo_info && (
              <div className="col-span-2">
                <p className="text-ds-caption text-ds-text/60">Orden de Servicio</p>
                <Link href={`/dashboard/trabajos/${gasto.trabajo_info.id}`} className="text-ds-brand hover:underline">
                  {gasto.trabajo_info.fecha} — {gasto.trabajo_info.cliente}
                </Link>
              </div>
            )}
            {gasto.comprobante_url && (
              <div className="col-span-2">
                <p className="text-ds-caption text-ds-text/60">Comprobante</p>
                <button type="button" onClick={verComprobante} className="inline-flex items-center gap-1 text-ds-brand hover:underline">
                  <Paperclip size={14} strokeWidth={2.75} />
                  {gasto.comprobante_nombre ?? "Ver comprobante"}
                </button>
              </div>
            )}
          </div>
        </Card>

        <Card>
          <p className="mb-ds-4 font-ds-body text-ds-small font-semibold text-ds-text">Categoría</p>
          <div className="flex flex-col gap-ds-1 font-ds-body text-ds-small">
            {gasto.categoria_info ? (
              <span className="inline-flex items-center gap-1.5 font-medium" style={{ color: gasto.categoria_info.color }}>
                <span className="h-2 w-2 rounded-ds-pill" style={{ backgroundColor: gasto.categoria_info.color }} />
                {gasto.categoria_info.nombre}
              </span>
            ) : (
              <p className="text-ds-text">{gasto.categoria}</p>
            )}
            {gasto.centro_costo_info && (
              <div className="mt-ds-3">
                <p className="text-ds-caption text-ds-text/60">Centro de costo</p>
                <p className="text-ds-text">{gasto.centro_costo_info.nombre}</p>
              </div>
            )}
          </div>
        </Card>

        {gasto.proveedor_info && (
          <Card>
            <p className="mb-ds-4 font-ds-body text-ds-small font-semibold text-ds-text">Proveedor</p>
            <div className="flex flex-col gap-ds-1 font-ds-body text-ds-small">
              <p className="font-medium text-ds-text">{gasto.proveedor_info.nombre}</p>
              {gasto.proveedor_info.correo && <p className="text-ds-text/70">{gasto.proveedor_info.correo}</p>}
              {gasto.proveedor_info.telefono && <p className="text-ds-text/70">{gasto.proveedor_info.telefono}</p>}
            </div>
          </Card>
        )}

        <Card>
          <p className="mb-ds-4 font-ds-body text-ds-small font-semibold text-ds-text">Información Adicional</p>
          <div className="grid grid-cols-2 gap-ds-3 font-ds-body text-ds-small">
            <div>
              <p className="text-ds-caption text-ds-text/60">Creado</p>
              <p className="text-ds-text">{new Date(gasto.creado_en).toLocaleString("es-CL")}</p>
            </div>
            {gasto.editado_en && (
              <div>
                <p className="text-ds-caption text-ds-text/60">Editado (post-pago)</p>
                <p className="text-ds-text">{new Date(gasto.editado_en).toLocaleString("es-CL")}</p>
              </div>
            )}
          </div>
        </Card>
      </div>

      <Button variante="secundario" onPress={() => router.push("/dashboard/gastos")}>
        Volver a Gastos
      </Button>
    </DashboardShell>
  );
}
