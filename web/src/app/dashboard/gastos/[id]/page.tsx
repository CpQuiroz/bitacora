"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import type { CategoriaGasto, CentroCosto, Gasto, Proveedor, Trabajo } from "@bitacora/shared";
import { supabase } from "@/lib/supabase";
import { apiFetch } from "@/lib/api";
import { formatMoneda } from "@/lib/formatMoneda";
import { DashboardShell, type UsuarioShell } from "@/components/DashboardShell";
import { Badge, Button, Card, ErrorText, Label, PageHeader } from "@/components/ui";
import { IconChevronLeft, IconPaperclip } from "@/components/icons";

type GastoDetalle = Gasto & {
  categoria_info: Pick<CategoriaGasto, "id" | "nombre" | "color"> | null;
  centro_costo_info: Pick<CentroCosto, "id" | "nombre"> | null;
  proveedor_info: (Pick<Proveedor, "id" | "nombre"> & { telefono: string | null; correo: string | null }) | null;
  trabajo_info: Pick<Trabajo, "id" | "cliente" | "fecha"> | null;
};

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
        <ErrorText>{error}</ErrorText>
      </DashboardShell>
    );
  }
  if (!gasto) return null;

  return (
    <DashboardShell usuario={usuario}>
      <Link href="/dashboard/gastos" className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-brand hover:underline">
        <IconChevronLeft className="h-4 w-4" />
        Gastos
      </Link>

      <PageHeader
        title={gasto.descripcion || gasto.categoria}
        subtitle={formatMoneda(gasto.monto, usuario.moneda)}
        action={<Badge value={gasto.estado} />}
      />

      <div className="my-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="mb-4 text-sm font-semibold text-foreground">Información del Gasto</h2>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <Label>Monto</Label>
              <p className="text-foreground">{formatMoneda(gasto.monto, usuario.moneda)}</p>
            </div>
            <div>
              <Label>Fecha</Label>
              <p className="text-foreground">{gasto.fecha}</p>
            </div>
            <div>
              <Label>Estado</Label>
              <p className="text-foreground">
                <Badge value={gasto.estado} />
              </p>
            </div>
            <div>
              <Label>Fecha de pago</Label>
              <p className="text-foreground">{gasto.fecha_pago ?? "—"}</p>
            </div>
            {gasto.trabajo_info && (
              <div className="col-span-2">
                <Label>Orden de Servicio</Label>
                <Link href={`/dashboard/trabajos/${gasto.trabajo_info.id}`} className="text-brand hover:underline">
                  {gasto.trabajo_info.fecha} — {gasto.trabajo_info.cliente}
                </Link>
              </div>
            )}
            {gasto.comprobante_url && (
              <div className="col-span-2">
                <Label>Comprobante</Label>
                <button type="button" onClick={verComprobante} className="inline-flex items-center gap-1 text-brand hover:underline">
                  <IconPaperclip className="h-3.5 w-3.5" />
                  {gasto.comprobante_nombre ?? "Ver comprobante"}
                </button>
              </div>
            )}
          </div>
        </Card>

        <Card>
          <h2 className="mb-4 text-sm font-semibold text-foreground">Categoría</h2>
          <div className="flex flex-col gap-1 text-sm">
            {gasto.categoria_info ? (
              <span className="inline-flex items-center gap-1.5 font-medium" style={{ color: gasto.categoria_info.color }}>
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: gasto.categoria_info.color }} />
                {gasto.categoria_info.nombre}
              </span>
            ) : (
              <p className="text-foreground">{gasto.categoria}</p>
            )}
            {gasto.centro_costo_info && (
              <div className="mt-3">
                <Label>Centro de costo</Label>
                <p className="text-foreground">{gasto.centro_costo_info.nombre}</p>
              </div>
            )}
          </div>
        </Card>

        {gasto.proveedor_info && (
          <Card>
            <h2 className="mb-4 text-sm font-semibold text-foreground">Proveedor</h2>
            <div className="flex flex-col gap-1 text-sm">
              <p className="font-medium text-foreground">{gasto.proveedor_info.nombre}</p>
              {gasto.proveedor_info.correo && <p className="text-muted">{gasto.proveedor_info.correo}</p>}
              {gasto.proveedor_info.telefono && <p className="text-muted">{gasto.proveedor_info.telefono}</p>}
            </div>
          </Card>
        )}

        <Card>
          <h2 className="mb-4 text-sm font-semibold text-foreground">Información Adicional</h2>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <Label>Creado</Label>
              <p className="text-foreground">{new Date(gasto.creado_en).toLocaleString("es-CL")}</p>
            </div>
            {gasto.editado_en && (
              <div>
                <Label>Editado (post-pago)</Label>
                <p className="text-foreground">{new Date(gasto.editado_en).toLocaleString("es-CL")}</p>
              </div>
            )}
          </div>
        </Card>
      </div>

      <Button type="button" variant="outline" onClick={() => router.push("/dashboard/gastos")}>
        Volver a Gastos
      </Button>
    </DashboardShell>
  );
}
