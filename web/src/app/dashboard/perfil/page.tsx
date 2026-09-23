"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { EquipoAsignadoConDocumentos, Empresa, Usuario } from "@bitacora/shared";
import { supabase } from "@/lib/supabase";
import { apiFetch } from "@/lib/api";
import { DashboardShell } from "@/components/DashboardShell";
import { Card, PageHeader } from "@/components/ui";
import { DocumentoForm } from "@/components/DocumentoForm";
import { IconTruck } from "@/components/icons";

type UsuarioConEmpresa = Usuario & { empresa: Empresa };

// Esta página sigue con el sistema de tokens viejo (Card/PageHeader de
// @/components/ui, no @bitacora/ui/web) — a diferencia de StatusBadge
// (que no tiene un tono "rojo" propio, solo tonos por marca), este
// sistema SÍ trae danger/warning semánticos (globals.css) — se usan
// tal cual, mismo patrón que ya usa trabajos/[id]/page.tsx para sus
// alertas.
const CLASE_ESTADO_DOCUMENTO: Record<string, string> = { vencido: "text-danger", por_vencer: "text-warning", vigente: "text-muted" };
const ETIQUETA_ESTADO_DOCUMENTO: Record<string, string> = { vencido: "Vencido", por_vencer: "Por vencer", vigente: "Vigente" };

export default function PerfilPage() {
  const router = useRouter();
  const [usuario, setUsuario] = useState<UsuarioConEmpresa | null>(null);
  const [vehiculo, setVehiculo] = useState<EquipoAsignadoConDocumentos | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        router.replace("/login");
        return;
      }
      const [resMe, resVehiculo] = await Promise.all([apiFetch("/api/me"), apiFetch("/api/usuarios/me/vehiculo")]);
      if (resMe.ok) {
        const body = await resMe.json();
        if (body.usuario) setUsuario(body.usuario);
      }
      if (resVehiculo.ok) setVehiculo(await resVehiculo.json());
    })();
  }, [router]);

  if (!usuario) return null;

  return (
    <DashboardShell
      usuario={{
        nombre: usuario.nombre,
        rol: usuario.rol,
        empresaNombre: usuario.empresa.nombre,
        empresaLogoUrl: usuario.empresa.logo_url,
        colorPrimario: usuario.empresa.color_primario,
        tema: usuario.empresa.tema,
        colorPrimarioForeground: usuario.empresa.color_primario_foreground, colorSecundario: usuario.empresa.color_secundario, fuente: usuario.empresa.fuente,
        moneda: usuario.empresa.moneda,
      }}
    >
      <PageHeader title="Perfil" subtitle="Tus datos, tu vehículo asignado y tus documentos" />
      <Card className="my-6">
        <p className="text-sm text-muted">
          Todavía no puedes editar tu perfil desde acá — por ahora tu nombre y rol los administra un admin desde Equipo.
        </p>
      </Card>

      <Card className="my-6">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
          <IconTruck className="h-4 w-4 text-brand" />
          Vehículo asignado
        </h2>
        {vehiculo ? (
          <>
            <p className="text-sm text-foreground">
              {vehiculo.patente} — {[vehiculo.marca, vehiculo.modelo].filter(Boolean).join(" ") || "sin marca/modelo registrados"}
            </p>
            {vehiculo.documentos.length > 0 ? (
              <ul className="mt-3 flex flex-col gap-2 border-t border-border pt-3">
                {vehiculo.documentos.map((d) => (
                  <li key={d.id} className="flex items-center justify-between gap-2 text-sm">
                    <span className="text-foreground">
                      {d.tipo?.nombre ?? "Documento"}
                      {d.fecha_vencimiento ? <span className="text-muted"> — vence {d.fecha_vencimiento}</span> : null}
                    </span>
                    {d.estado ? <span className={`text-xs font-medium ${CLASE_ESTADO_DOCUMENTO[d.estado]}`}>{ETIQUETA_ESTADO_DOCUMENTO[d.estado]}</span> : null}
                  </li>
                ))}
              </ul>
            ) : null}
          </>
        ) : (
          <p className="text-sm text-muted">No tienes un vehículo asignado por ahora.</p>
        )}
      </Card>

      <DocumentoForm entidadTipo="colaborador" entidadId={usuario.id} />
    </DashboardShell>
  );
}
