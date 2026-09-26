"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { EquipoAsignadoConDocumentos, Empresa, Usuario } from "@bitacora/shared";
import { supabase } from "@/lib/supabase";
import { apiFetch } from "@/lib/api";
import { DashboardShell } from "@/components/DashboardShell";
import { PageHeader } from "@/components/PageHeader";
import { DocumentoForm } from "@/components/DocumentoForm";
import { IconTruck } from "@/components/icons";
import { Card, StatusBadge } from "@bitacora/ui/web";

type UsuarioConEmpresa = Usuario & { empresa: Empresa };

// Migrada al sistema de diseño (tarea 157): Card de @bitacora/ui/web y
// PageHeader de @/components/PageHeader. Antes tenía su propio texto
// text-danger/text-warning a mano porque StatusBadge no distinguía
// vencido/por_vencer del resto (gap cerrado el 23-sep-2026 —
// MAPA_ESTADO_TONO ya los mapea a peligro/advertencia).

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
      <div className="my-ds-6">
        <Card>
          <p className="font-ds-body text-ds-small text-ds-text-secondary">
            Todavía no puedes editar tu perfil desde acá — por ahora tu nombre y rol los administra un admin desde Equipo.
          </p>
        </Card>
      </div>

      <div className="my-ds-6">
        <Card>
          <h2 className="mb-ds-3 flex items-center gap-ds-2 font-ds-body text-ds-small font-semibold text-ds-text">
            <IconTruck className="h-4 w-4 text-ds-brand" />
            Vehículo asignado
          </h2>
          {vehiculo ? (
            <>
              <p className="font-ds-body text-ds-small text-ds-text">
                {vehiculo.patente} — {[vehiculo.marca, vehiculo.modelo].filter(Boolean).join(" ") || "sin marca/modelo registrados"}
              </p>
              {vehiculo.documentos.length > 0 ? (
                <ul className="mt-ds-3 flex flex-col gap-ds-2 border-t border-ds-divider pt-ds-3">
                  {vehiculo.documentos.map((d) => (
                    <li key={d.id} className="flex items-center justify-between gap-ds-2 font-ds-body text-ds-small">
                      <span className="text-ds-text">
                        {d.tipo?.nombre ?? "Documento"}
                        {d.fecha_vencimiento ? <span className="text-ds-text-secondary"> — vence {d.fecha_vencimiento}</span> : null}
                      </span>
                      {d.estado ? <StatusBadge estado={d.estado} /> : null}
                    </li>
                  ))}
                </ul>
              ) : null}
            </>
          ) : (
            <p className="font-ds-body text-ds-small text-ds-text-secondary">No tienes un vehículo asignado por ahora.</p>
          )}
        </Card>
      </div>

      <DocumentoForm entidadTipo="colaborador" entidadId={usuario.id} />
    </DashboardShell>
  );
}
